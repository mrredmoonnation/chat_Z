import React, { useState, useEffect, useRef } from 'react';
import { 
  getStoredUser, saveStoredUser, getStoredContacts, saveStoredContacts, 
  getStoredStories, saveStoredStories, getSettings, saveSettings,
  broadcastChange, subscribeToBroadcast, registerUsername, cleanUsername, AVATAR_PRESETS
} from './services/store';
import { sounds } from './services/audioEffects';
import { OnlineP2PService } from './services/onlineP2P';
import { fetchCloudUsers, publishUserToCloud, pollCloudInbox } from './services/cloudRegistry';
import { useAuth } from './context/AuthContext';
import { 
  getOrCreateOneToOneRoom, 
  createFirestoreGroupRoom, 
  subscribeToUserRooms, 
  sendFirestoreMessage, 
  subscribeToRoomMessages,
  markFirestoreRoomMessagesAsRead,
  publishFirestoreStory,
  subscribeToFirestoreStories,
  deleteFirestoreStory,
  deleteFirestoreStoryItem,
  markFirestoreStorySeen
} from './services/firestoreChat';
import PhoneLogin from './components/Auth/PhoneLogin';
import Sidebar from './components/Sidebar/Sidebar';
import ChatArea from './components/Chat/ChatArea';
import CallModal from './components/Call/CallModal';
import NewGroupModal from './components/Groups/NewGroupModal';
import PartnerConnectModal from './components/Privacy/PartnerConnectModal';
import DisguiseModal from './components/Privacy/DisguiseModal';

export default function App() {
  const { currentUser: authUser, logout: authLogout } = useAuth();
  const [currentUser, setCurrentUser] = useState(() => {
    const u = getStoredUser();
    if (u && !u.username) {
      const derived = cleanUsername((u.email || u.name || '').split('@')[0]) || ('user_' + Math.floor(Math.random() * 1000));
      u.username = derived;
      saveStoredUser(u);
    }
    return u;
  });

  // Sync authUser from Firebase AuthContext to currentUser
  useEffect(() => {
    if (authUser) {
      setCurrentUser(authUser);
      saveStoredUser(authUser);
    }
  }, [authUser]);

  const [firestoreRooms, setFirestoreRooms] = useState([]);
  const [contacts, setContacts] = useState(() => getStoredContacts());
  const [activeContactId, setActiveContactId] = useState(null);
  const [stories, setStories] = useState(() => getStoredStories());
  const [settings, setSettings] = useState(() => getSettings());

  // Real-time Firestore ChatRooms subscription for current user
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubscribe = subscribeToUserRooms(
      currentUser.uid,
      (rooms) => {
        setFirestoreRooms(rooms);
      },
      (err) => {
        console.warn('Firestore rooms listen notice:', err);
      }
    );
    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Real-time Firestore Stories / Status sync across all devices & users
  useEffect(() => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid) return;

    const unsubscribe = subscribeToFirestoreStories(
      uid,
      (syncedStories) => {
        if (syncedStories) {
          setStories(syncedStories);
          saveStoredStories(syncedStories);
        }
      },
      (err) => {
        console.warn('Firestore stories sync notice:', err);
      }
    );
    return () => unsubscribe();
  }, [currentUser?.uid, currentUser?.id]);

  // Merge real-time Firestore rooms with local contacts
  const mergedContacts = React.useMemo(() => {
    if (!firestoreRooms || firestoreRooms.length === 0) {
      return contacts.map((c) => (c.id === activeContactId ? { ...c, unreadCount: 0 } : c));
    }

    const roomContacts = firestoreRooms.map((r) => {
      if (r.type === 'group') {
        const existing = contacts.find((c) => c.id === r.id);
        return {
          id: r.id,
          roomId: r.id,
          isGroup: true,
          name: r.roomName || 'Group',
          avatar: r.roomAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${r.id}`,
          about: 'Group Chat',
          isOnline: false,
          lastSeen: 'Group',
          lastMessage: r.lastMessage || '',
          lastMessageTimestamp: r.lastMessageTimestamp,
          unreadCount: activeContactId === r.id ? 0 : (existing?.unreadCount || 0),
          messages: existing?.messages || []
        };
      }

      // 1-to-1 room
      const otherUid = r.participants?.find((uid) => uid !== currentUser?.uid);
      const otherProfile = r.participantProfiles?.[otherUid] || {};
      const existing = contacts.find((c) => c.id === r.id || (otherUid && c.otherUid === otherUid));

      return {
        id: r.id,
        roomId: r.id,
        otherUid: otherUid,
        username: otherProfile.username || existing?.username || null,
        name: otherProfile.displayName || otherProfile.name || existing?.name || otherProfile.username || 'Friend',
        avatar: otherProfile.photoURL || otherProfile.avatar || existing?.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${otherUid || 'User'}`,
        about: otherProfile.about || existing?.about || 'Connected on Chatz',
        isOnline: true,
        lastSeen: 'Online',
        lastMessage: r.lastMessage || '',
        lastMessageTimestamp: r.lastMessageTimestamp,
        unreadCount: activeContactId === r.id ? 0 : (existing?.unreadCount || 0),
        messages: existing?.messages || []
      };
    });

    const roomIds = new Set(roomContacts.map((c) => c.id));
    const nonRoomContacts = contacts
      .filter((c) => !roomIds.has(c.id))
      .map((c) => (c.id === activeContactId ? { ...c, unreadCount: 0 } : c));

    return [...roomContacts, ...nonRoomContacts];
  }, [firestoreRooms, contacts, currentUser?.uid, activeContactId]);

  // Real-time listener for messages in active Firestore ChatRoom (via onSnapshot)
  useEffect(() => {
    if (!activeContactId) return;

    const target = mergedContacts.find((c) => c.id === activeContactId);
    const roomId = target?.roomId || (activeContactId.startsWith('room_') ? activeContactId : null);

    if (!roomId) return;

    if (currentUser?.uid) {
      markFirestoreRoomMessagesAsRead(roomId, currentUser.uid);
    }

    const unsubscribe = subscribeToRoomMessages(
      roomId,
      (firestoreMessages) => {
        setContacts((prev) => {
          const exists = prev.some((c) => c.id === activeContactId);
          if (exists) {
            return prev.map((c) => (c.id === activeContactId ? { ...c, messages: firestoreMessages, unreadCount: 0 } : c));
          } else if (target) {
            return [{ ...target, messages: firestoreMessages, unreadCount: 0 }, ...prev];
          }
          return prev;
        });
      },
      (err) => {
        console.warn('Firestore messages listener notice:', err);
      }
    );

    return () => unsubscribe();
  }, [activeContactId]);

  // Online P2P state
  const p2pRef = useRef(null);
  const [partnerOnlineStatus, setPartnerOnlineStatus] = useState('disconnected'); // 'connected' | 'disconnected'
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [isDisguiseOpen, setIsDisguiseOpen] = useState(false);

  // Modals state
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [callState, setCallState] = useState({
    isOpen: false,
    isIncoming: false,
    contact: null,
    isVideo: false
  });

  // Mobile navigation state
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Select contact & push history state so browser/hardware back button works seamlessly
  const handleSelectContact = (id) => {
    setActiveContactId(id);
    setShowMobileChat(true);

    // Clear unread count for this contact immediately and mark messages as read
    setContacts((prev) => {
      const updated = prev.map((c) => {
        if (c.id === id || c.roomId === id) {
          return {
            ...c,
            unreadCount: 0,
            messages: (c.messages || []).map((m) =>
              m.senderId !== (currentUser?.uid || currentUser?.id || 'user')
                ? { ...m, status: 'read' }
                : m
            )
          };
        }
        return c;
      });
      saveStoredContacts(updated);
      return updated;
    });

    // Mark messages as read in Firestore if roomId
    const targetRoomId = id.startsWith('room_') ? id : mergedContacts.find((c) => c.id === id)?.roomId;
    if (targetRoomId && currentUser?.uid) {
      markFirestoreRoomMessagesAsRead(targetRoomId, currentUser.uid);
    }

    // Push new history state
    if (!window.history.state || window.history.state.waView !== 'chat' || window.history.state.contactId !== id) {
      window.history.pushState({ waView: 'chat', contactId: id }, '');
    }

    // Auto-connect to partner peer over P2P Internet immediately
    const targetContact = contacts.find((c) => c.id === id);
    const targetIdentifier = targetContact?.username || (id?.startsWith('wa_user_') ? id.replace('wa_user_', '') : targetContact?.phone);
    if (targetIdentifier && p2pRef.current) {
      p2pRef.current.connectToPartner(targetIdentifier);
      p2pRef.current.sendData({
        type: 'P2P_READ',
        readerId: currentUser?.uid || currentUser?.id,
        readerUsername: currentUser?.username
      }, `wa_user_${targetIdentifier}`);
    }
  };

  // Back to contacts handler
  const handleBackToContacts = () => {
    setShowMobileChat(false);
    if (window.innerWidth >= 768) {
      setActiveContactId(null);
    }

    if (window.history.state?.waView === 'chat') {
      window.history.back();
    } else {
      window.history.replaceState({ waView: 'contacts' }, '');
    }
  };

  // Browser / Phone Back Button Navigation Handling (Prevents exiting website)
  useEffect(() => {
    // Set initial state
    if (!window.history.state) {
      window.history.replaceState({ waView: 'contacts' }, '');
    }

    const handlePopState = (event) => {
      const state = event.state;

      // 1. If any modal is open, close modal first
      if (isNewGroupOpen) {
        setIsNewGroupOpen(false);
        return;
      }
      if (isPartnerModalOpen) {
        setIsPartnerModalOpen(false);
        return;
      }
      if (isDisguiseOpen) {
        setIsDisguiseOpen(false);
        return;
      }
      if (callState.isOpen) {
        handleEndCall();
        return;
      }

      // 2. If back was pressed from chat, return to contacts view
      if (state?.waView === 'chat' && state?.contactId) {
        setActiveContactId(state.contactId);
        setShowMobileChat(true);
      } else {
        setShowMobileChat(false);
        if (window.innerWidth >= 768) {
          setActiveContactId(null);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isNewGroupOpen, isPartnerModalOpen, isDisguiseOpen, callState.isOpen]);

  // Stealth Panic Hotkey: Ctrl+Shift+L or Alt+C toggles disguise calculator
  useEffect(() => {
    const handleStealthKey = (e) => {
      if ((e.ctrlKey && e.shiftKey && e.key?.toLowerCase() === 'l') || (e.altKey && e.key?.toLowerCase() === 'c')) {
        e.preventDefault();
        setIsDisguiseOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleStealthKey);
    return () => window.removeEventListener('keydown', handleStealthKey);
  }, []);

  // Apply theme
  useEffect(() => {
    if (settings.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [settings.theme]);

  // Global Cloud Directory Sync & Offline Inbox Delivery
  useEffect(() => {
    // Initial fetch of all global registered users
    fetchCloudUsers();

    if (!currentUser?.username) return;

    // Publish current user to cloud directory so everyone can find them
    publishUserToCloud(currentUser);

    // Incoming cloud messages delivery handler
    const handleInboxMessages = (inboxMsgs) => {
      if (!Array.isArray(inboxMsgs) || inboxMsgs.length === 0) return;

      inboxMsgs.forEach((payload) => {
        if (payload?.type === 'CHAT_MESSAGE' && payload.message) {
          const senderUsername = payload.senderUsername;
          const senderPeerId = payload.senderId || (senderUsername ? `wa_user_${senderUsername}` : 'partner_live');
          const incomingMsg = {
            ...payload.message,
            senderId: senderPeerId
          };

          setContacts((prev) => {
            const partner = prev.find((c) => c.id === senderPeerId || (senderUsername && c.username === senderUsername));
            const isCurrentlyActive = activeContactId === senderPeerId || (partner && activeContactId === partner.id);
            if (isCurrentlyActive) {
              incomingMsg.status = 'read';
            }

            if (partner) {
              if (partner.messages?.some((m) => m.id === incomingMsg.id)) {
                return prev;
              }
              const updated = prev.map((c) =>
                c.id === partner.id
                  ? {
                      ...c,
                      messages: [...(c.messages || []), incomingMsg],
                      unreadCount: isCurrentlyActive ? 0 : ((c.unreadCount || 0) + 1),
                      isOnline: true,
                      lastSeen: 'Online'
                    }
                  : c
              );
              saveStoredContacts(updated);
              return updated;
            } else {
              const newPartner = {
                id: senderPeerId,
                username: senderUsername || null,
                isPartner: true,
                name: payload.senderName || senderUsername || 'Friend',
                avatar: payload.senderAvatar || AVATAR_PRESETS[0],
                about: 'Connected on Chatz',
                isOnline: true,
                lastSeen: 'Online',
                unreadCount: isCurrentlyActive ? 0 : 1,
                messages: [incomingMsg]
              };
              const updated = [newPartner, ...prev];
              saveStoredContacts(updated);
              return updated;
            }
          });
          sounds.playMessageReceived();
        }
      });
    };

    // Immediate check
    pollCloudInbox(currentUser.username, handleInboxMessages);

    // Poll every 6 seconds
    const interval = setInterval(() => {
      fetchCloudUsers();
      pollCloudInbox(currentUser.username, handleInboxMessages);
    }, 6000);

    return () => clearInterval(interval);
  }, [currentUser?.username]);

  // Initialize Online P2P Internet Connection when logged in
  useEffect(() => {
    const userIdentifier = currentUser?.username || currentUser?.phone || currentUser?.email || currentUser?.id;
    if (!userIdentifier) return;

    const p2p = new OnlineP2PService({
      myIdentifier: userIdentifier,
      myProfile: currentUser,
      onStatusChange: ({ status, partnerId }) => {
        if (status === 'partner_connected') {
          setPartnerOnlineStatus('connected');
          setContacts((prev) => {
            const existing = prev.find((c) => c.isPartner || c.id === partnerId);
            if (existing) {
              const updated = prev.map((c) =>
                c.id === existing.id
                  ? { ...c, isOnline: true, lastSeen: 'Online (Live P2P)' }
                  : c
              );
              saveStoredContacts(updated);
              return updated;
            } else {
              const cleanPartnerName = partnerId ? partnerId.replace('wa_user_', '') : 'Partner';
              const newPartner = {
                id: partnerId || 'partner_live',
                isPartner: true,
                name: cleanPartnerName,
                avatar: AVATAR_PRESETS[0],
                about: 'Connected Live on Chatz',
                isOnline: true,
                lastSeen: 'Online (Live P2P)',
                messages: []
              };
              const updated = [newPartner, ...prev];
              saveStoredContacts(updated);
              return updated;
            }
          });
        } else if (status === 'partner_disconnected') {
          setPartnerOnlineStatus('disconnected');
          setContacts((prev) => {
            const updated = prev.map((c) =>
              c.isPartner || c.id === partnerId
                ? { ...c, isOnline: false, lastSeen: 'Offline' }
                : c
            );
            saveStoredContacts(updated);
            return updated;
          });
        }
      },
      onMessageReceived: (payload, peerId) => {
        if (payload?.type === 'PEER_HANDSHAKE' && payload.profile) {
          const prof = payload.profile;
          if (prof.username) {
            registerUsername(prof.username, prof);
          }
          setContacts((prev) => {
            const cleanPeerId = peerId || (prof.username ? `wa_user_${prof.username}` : null);
            const existing = prev.find((c) => (cleanPeerId && c.id === cleanPeerId) || (prof.username && c.username === prof.username));
            if (existing) {
              const updated = prev.map((c) =>
                c.id === existing.id
                  ? {
                      ...c,
                      name: prof.name || c.name,
                      avatar: prof.avatar || c.avatar,
                      about: prof.about || c.about,
                      isOnline: true,
                      lastSeen: 'Online (Live P2P)'
                    }
                  : c
              );
              saveStoredContacts(updated);
              return updated;
            } else if (cleanPeerId) {
              const newContact = {
                id: cleanPeerId,
                username: prof.username || null,
                isPartner: true,
                name: prof.name || prof.username || 'Partner',
                avatar: prof.avatar || AVATAR_PRESETS[0],
                about: prof.about || 'Connected Live on Chatz',
                isOnline: true,
                lastSeen: 'Online (Live P2P)',
                unreadCount: 0,
                messages: []
              };
              const updated = [newContact, ...prev];
              saveStoredContacts(updated);
              return updated;
            }
            return prev;
          });
          return;
        }

        if (payload?.type === 'CHAT_MESSAGE') {
          const senderUsername = payload.senderUsername;
          const senderPeerId = peerId || payload.senderId || (senderUsername ? `wa_user_${senderUsername}` : 'partner_live');
          if (senderUsername) {
            registerUsername(senderUsername, {
              id: senderPeerId,
              username: senderUsername,
              name: payload.senderName || senderUsername,
              avatar: payload.senderAvatar || AVATAR_PRESETS[0]
            });
          }

          const partner = contacts.find((c) => c.isPartner || c.id === senderPeerId || (senderUsername && c.username === senderUsername));
          const targetId = partner ? partner.id : senderPeerId;
          const isCurrentlyActive = activeContactId === targetId || activeContactId === senderPeerId || (partner && activeContactId === partner.id);

          const incomingMsg = {
            ...payload.message,
            id: 'p2p_' + Date.now(),
            senderId: targetId,
            status: isCurrentlyActive ? 'read' : 'delivered'
          };

          setContacts((prev) => {
            const existingPartner = prev.find((c) => c.isPartner || c.id === senderPeerId || (senderUsername && c.username === senderUsername));
            if (existingPartner) {
              const updated = prev.map((c) => {
                if (c.id === existingPartner.id) {
                  return {
                    ...c,
                    messages: [...(c.messages || []), incomingMsg],
                    unreadCount: isCurrentlyActive ? 0 : ((c.unreadCount || 0) + 1),
                    isOnline: true,
                    lastSeen: 'Online (Live P2P)'
                  };
                }
                return c;
              });
              saveStoredContacts(updated);
              return updated;
            } else {
              const newPartner = {
                id: targetId,
                username: senderUsername || null,
                isPartner: true,
                name: payload.senderName || senderUsername || 'Friend',
                avatar: payload.senderAvatar || AVATAR_PRESETS[0],
                about: 'Connected Live on Chatz',
                isOnline: true,
                lastSeen: 'Online (Live P2P)',
                unreadCount: isCurrentlyActive ? 0 : 1,
                messages: [incomingMsg]
              };
              const updated = [newPartner, ...prev];
              saveStoredContacts(updated);
              return updated;
            }
          });
          sounds.playMessageReceived();

          // Acknowledge delivery over P2P
          if (payload.message?.id) {
            p2pRef.current?.sendData({
              type: isCurrentlyActive ? 'P2P_READ' : 'P2P_DELIVERED',
              messageId: payload.message.id,
              readerId: currentUser?.uid || currentUser?.id,
              readerUsername: currentUser?.username
            }, senderPeerId);
          }
        } else if (payload?.type === 'P2P_DELIVERED') {
          // Double grey tick delivery update
          setContacts((prev) => {
            const updated = prev.map((c) => ({
              ...c,
              messages: (c.messages || []).map((m) =>
                m.id === payload.messageId && m.status === 'sent' ? { ...m, status: 'delivered' } : m
              )
            }));
            saveStoredContacts(updated);
            return updated;
          });
        } else if (payload?.type === 'P2P_READ') {
          // Double blue ticks seen update
          setContacts((prev) => {
            const updated = prev.map((c) => {
              if (c.id === peerId || (payload.readerUsername && c.username === payload.readerUsername)) {
                return {
                  ...c,
                  messages: (c.messages || []).map((m) =>
                    m.senderId === (currentUser?.uid || currentUser?.id || 'user') ? { ...m, status: 'read' } : m
                  )
                };
              }
              return c;
            });
            saveStoredContacts(updated);
            return updated;
          });
        }
      },
      onIncomingCall: (mediaCall) => {
        const partnerContact = contacts.find((c) => c.isPartner) || contacts[0] || {
          name: 'Partner',
          avatar: AVATAR_PRESETS[0]
        };
        setCallState({
          isOpen: true,
          isIncoming: true,
          contact: partnerContact,
          isVideo: mediaCall.metadata?.isVideo ?? true
        });
      }
    });

    p2p.init();
    p2pRef.current = p2p;

    // Check if URL has ?partner=XXXXX to auto-connect immediately!
    const params = new URLSearchParams(window.location.search);
    const partnerFromUrl = params.get('partner');
    if (partnerFromUrl) {
      setTimeout(() => {
        p2p.connectToPartner(partnerFromUrl);
      }, 1500);
    }

    return () => {
      p2p.destroy();
      p2pRef.current = null;
    };
  }, [currentUser?.username, currentUser?.phone, currentUser?.email, currentUser?.id]);

  // Handle manual partner connection
  const handleConnectPartner = (phoneOrId) => {
    if (p2pRef.current) {
      p2pRef.current.connectToPartner(phoneOrId);
    }
  };

  // Listen to real-time events across tabs
  useEffect(() => {
    const unsubscribe = subscribeToBroadcast((data) => {
      if (!data) return;

      if (data.type === 'USER_UPDATED') {
        setCurrentUser(data.payload);
      } else if (data.type === 'NEW_MESSAGE') {
        const { contactId, message } = data.payload;
        setContacts((prev) => {
          const updated = prev.map((c) => {
            if (c.id === contactId) {
              return {
                ...c,
                messages: [...(c.messages || []), message]
              };
            }
            return c;
          });
          saveStoredContacts(updated);
          return updated;
        });
        sounds.playMessageReceived();

        // If this tab currently has this chat open, mark as read, otherwise acknowledge delivered
        if (activeContactId === contactId) {
          broadcastChange('MESSAGES_READ', { contactId });
        } else {
          broadcastChange('MESSAGE_DELIVERED', { contactId, messageId: message.id });
        }
      } else if (data.type === 'MESSAGE_DELIVERED') {
        const { contactId, messageId } = data.payload;
        setContacts((prev) => {
          const updated = prev.map((c) => {
            if (c.id === contactId) {
              return {
                ...c,
                messages: (c.messages || []).map((m) => 
                  m.id === messageId && m.status === 'sent' ? { ...m, status: 'delivered' } : m
                )
              };
            }
            return c;
          });
          saveStoredContacts(updated);
          return updated;
        });
      } else if (data.type === 'MESSAGES_READ') {
        const { contactId } = data.payload;
        setContacts((prev) => {
          const updated = prev.map((c) => {
            if (c.id === contactId) {
              return {
                ...c,
                messages: (c.messages || []).map((m) => ({ ...m, status: 'read' }))
              };
            }
            return c;
          });
          saveStoredContacts(updated);
          return updated;
        });
      } else if (data.type === 'TYPING_STATUS') {
        const { contactId, isTyping } = data.payload;
        setContacts((prev) => 
          prev.map((c) => (c.id === contactId ? { ...c, isTyping } : c))
        );
      } else if (data.type === 'START_CALL') {
        setCallState({
          isOpen: true,
          isIncoming: true,
          contact: data.payload.contact,
          isVideo: data.payload.isVideo
        });
      } else if (data.type === 'END_CALL') {
        setCallState({ isOpen: false, isIncoming: false, contact: null, isVideo: false });
      } else if (data.type === 'STORIES_UPDATED') {
        setStories(data.payload);
      }
    });

    return () => unsubscribe();
  }, [activeContactId]);

  // Handle Login Success
  const handleLoginSuccess = (profile) => {
    setCurrentUser(profile);
    saveStoredUser(profile);
    if (profile?.username) {
      publishUserToCloud(profile);
    }
  };

  // Handle Profile Updates (Name, Bio, Avatar)
  const handleUpdateProfile = (updatedProfile) => {
    setCurrentUser(updatedProfile);
    saveStoredUser(updatedProfile);
    if (updatedProfile?.username) {
      publishUserToCloud(updatedProfile);
    }
  };

  // Handle Adding a New Contact
  const handleAddContact = (newContact) => {
    setContacts((prev) => {
      const exists = prev.some((c) => c.id === newContact.id);
      if (exists) return prev;
      const updated = [newContact, ...prev];
      saveStoredContacts(updated);
      return updated;
    });
    setActiveContactId(newContact.id);
    setShowMobileChat(true);
  };

  // Handle Logout
  const handleLogout = () => {
    if (p2pRef.current) {
      p2pRef.current.destroy();
      p2pRef.current = null;
    }
    if (authLogout) {
      authLogout();
    }
    localStorage.removeItem('chatz_user_v1');
    localStorage.removeItem('wa_clone_current_user_v2');
    setCurrentUser(null);
  };

  // Toggle Theme
  const handleToggleTheme = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = { ...settings, theme: newTheme };
    setSettings(updated);
    saveSettings(updated);
  };

  // Start / Open 1-to-1 Firestore Chat Room
  const handleStartChatRoom = async (targetUser) => {
    if (currentUser?.uid && (targetUser?.uid || targetUser?.id?.startsWith('user_'))) {
      const cleanUid = targetUser.uid || targetUser.id.replace('user_', '');
      try {
        const room = await getOrCreateOneToOneRoom(currentUser, { ...targetUser, uid: cleanUid });
        if (room) {
          handleSelectContact(room.id);
          return room;
        }
      } catch (err) {
        console.warn('getOrCreateOneToOneRoom warning:', err);
      }
    }
    return null;
  };

  // Send Message with Firestore real-time sync + WhatsApp realistic tick progression
  const handleSendMessage = async (msgData) => {
    if (!activeContactId) return;

    const targetContact = mergedContacts.find((c) => c.id === activeContactId);
    const roomId = targetContact?.roomId || (activeContactId.startsWith('room_') ? activeContactId : null);

    // 1. If active chat is a Firestore room, dispatch directly to Firestore!
    if (roomId && currentUser?.uid) {
      try {
        await sendFirestoreMessage(roomId, currentUser, msgData);
        sounds.playMessageSent();
        return;
      } catch (err) {
        console.warn('Firestore message dispatch notice (falling back):', err);
      }
    }

    const messageId = 'm_' + Date.now();
    const newMsg = {
      id: messageId,
      senderId: currentUser?.uid || currentUser?.id || 'user',
      ...msgData,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      status: 'sent' // 1. Starts with Single Grey Tick!
    };

    sounds.playMessageSent();

    setContacts((prev) => {
      const updated = prev.map((c) => {
        if (c.id === activeContactId) {
          return {
            ...c,
            messages: [...(c.messages || []), newMsg]
          };
        }
        return c;
      });
      saveStoredContacts(updated);
      return updated;
    });

    // Send over BroadcastChannel (local tabs)
    broadcastChange('NEW_MESSAGE', { contactId: activeContactId, message: newMsg });

    // Target peer ID for this specific contact
    const targetPeerId = targetContact?.username 
      ? `wa_user_${targetContact.username}` 
      : (activeContactId.startsWith('wa_user_') ? activeContactId : targetContact?.phone);

    // Send over Internet P2P & MQTT directly to recipient's phone if connected!
    p2pRef.current?.sendData({
      type: 'CHAT_MESSAGE',
      message: newMsg,
      senderId: currentUser?.username ? `wa_user_${currentUser.username}` : currentUser?.id,
      senderUsername: currentUser?.username || null,
      senderName: currentUser?.displayName || currentUser?.name || 'Friend',
      senderAvatar: currentUser?.photoURL || currentUser?.avatar || null
    }, targetPeerId);

    // 2. Progression: Transition from 'sent' to 'delivered' (double grey tick) after network ping (600ms)
    setTimeout(() => {
      setContacts((prev) => {
        const updated = prev.map((c) => {
          if (c.id === activeContactId) {
            return {
              ...c,
              messages: (c.messages || []).map((m) => 
                m.id === messageId && m.status === 'sent' ? { ...m, status: 'delivered' } : m
              )
            };
          }
          return c;
        });
        saveStoredContacts(updated);
        return updated;
      });
    }, 600);
  };

  // Support typing indicator broadcast from ChatInput to P2P peer
  handleSendMessage.onTyping = (isTyping) => {
    if (!activeContactId) return;
    broadcastChange('TYPING_STATUS', { contactId: activeContactId, isTyping });
    p2pRef.current?.sendData({
      type: 'TYPING_STATUS',
      isTyping
    });
  };

  // Clear chat history
  const handleClearChat = (contactId) => {
    setContacts((prev) => {
      const updated = prev.map((c) => (c.id === contactId ? { ...c, messages: [] } : c));
      saveStoredContacts(updated);
      return updated;
    });
  };

  // Add new Story (supports multiple slides / updates + Firestore real-time sync)
  const handleAddStory = async (item) => {
    const existingIndex = stories.findIndex((s) => s.contactId === 'user');
    let updated;
    if (existingIndex >= 0) {
      const existing = stories[existingIndex];
      const updatedUserStory = {
        ...existing,
        contactName: currentUser?.displayName || currentUser?.name || 'My Status',
        avatar: currentUser?.photoURL || currentUser?.avatar,
        timestamp: Date.now(),
        timeText: 'Just now',
        items: [...(existing.items || []), item]
      };
      updated = [...stories];
      updated[existingIndex] = updatedUserStory;
    } else {
      const newStory = {
        id: 'story_user_' + Date.now(),
        contactId: 'user',
        contactName: currentUser?.displayName || currentUser?.name || 'My Status',
        avatar: currentUser?.photoURL || currentUser?.avatar,
        timestamp: Date.now(),
        timeText: 'Just now',
        items: [item]
      };
      updated = [newStory, ...stories];
    }
    setStories(updated);
    saveStoredStories(updated);

    // Sync to Firestore so ALL other users on all devices can see it in real-time!
    if (currentUser) {
      try {
        await publishFirestoreStory(currentUser, item);
      } catch (err) {
        console.warn('Firestore story publish error:', err);
      }
    }
  };

  // Delete entire story
  const handleDeleteStory = async (storyId) => {
    const updated = stories.filter((s) => s.id !== storyId);
    setStories(updated);
    saveStoredStories(updated);
    const uid = currentUser?.uid || currentUser?.id;
    if (uid) {
      deleteFirestoreStory(uid);
    }
  };

  // Delete specific item (slide) within a story
  const handleDeleteStoryItem = async (storyId, itemId) => {
    const updated = stories
      .map((s) => {
        if (s.id === storyId) {
          const remainingItems = (s.items || []).filter((item) => item.id !== itemId);
          return {
            ...s,
            items: remainingItems
          };
        }
        return s;
      })
      .filter((s) => s.items && s.items.length > 0);

    setStories(updated);
    saveStoredStories(updated);
    const uid = currentUser?.uid || currentUser?.id;
    if (uid) {
      deleteFirestoreStoryItem(uid, itemId);
    }
  };

  // Mark story as seen
  const handleStorySeen = (storyDocId) => {
    const uid = currentUser?.uid || currentUser?.id;
    if (!uid || !storyDocId) return;
    markFirestoreStorySeen(
      storyDocId,
      uid,
      currentUser?.displayName || currentUser?.name || currentUser?.username
    );
  };

  // Reply to story
  const handleReplyToStory = (contactId, replyText) => {
    handleSelectContact(contactId);
    handleSendMessage({
      type: 'text',
      text: replyText
    });
  };

  // Create new Group
  const handleCreateGroup = async ({ name, avatar, members }) => {
    if (currentUser?.uid) {
      try {
        const room = await createFirestoreGroupRoom(currentUser, name, avatar, members);
        if (room) {
          handleSelectContact(room.id);
          setIsNewGroupOpen(false);
          return;
        }
      } catch (e) {
        console.warn('Firestore group room fallback:', e);
      }
    }

    const newGroup = {
      id: 'group_' + Date.now(),
      isGroup: true,
      name,
      avatar,
      about: 'Group created by ' + (currentUser?.displayName || currentUser?.name || 'You'),
      isOnline: false,
      lastSeen: 'Group',
      unreadCount: 0,
      members,
      messages: [
        {
          id: 'gm_' + Date.now(),
          senderId: currentUser?.uid || 'user',
          senderName: currentUser?.displayName || currentUser?.name,
          text: `Hey everyone! Welcome to ${name} 🎉`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now(),
          status: 'read'
        }
      ]
    };

    const updated = [newGroup, ...contacts];
    setContacts(updated);
    saveStoredContacts(updated);
    handleSelectContact(newGroup.id);
    setIsNewGroupOpen(false);
  };

  // Start Call
  const handleStartCall = (contact, isVideo) => {
    setCallState({
      isOpen: true,
      isIncoming: false,
      contact,
      isVideo
    });
    broadcastChange('START_CALL', { contact: currentUser, isVideo });
  };

  const handleEndCall = () => {
    setCallState({ isOpen: false, isIncoming: false, contact: null, isVideo: false });
    broadcastChange('END_CALL', {});
    p2pRef.current?.endCall();
  };

  // If user is not logged in, render WhatsApp Phone Onboarding
  if (!currentUser) {
    return <PhoneLogin onLoginSuccess={handleLoginSuccess} />;
  }

  const activeContact = activeContactId ? (mergedContacts.find((c) => c.id === activeContactId) || null) : null;

  return (
    <div className="wa-app-wrapper">
      <div className="wa-app-container">
        {/* Sidebar */}
        <div className={`wa-sidebar-wrapper ${showMobileChat ? 'mobile-hidden' : ''}`}>
          <Sidebar
            currentUser={currentUser}
            contacts={mergedContacts}
            activeContactId={activeContactId}
            onSelectContact={handleSelectContact}
            onOpenNewGroup={() => setIsNewGroupOpen(true)}
            onOpenPartnerModal={() => setIsPartnerModalOpen(true)}
            partnerOnlineStatus={partnerOnlineStatus}
            onStartCall={handleStartCall}
            stories={stories}
            onAddStory={handleAddStory}
            onReplyToStory={handleReplyToStory}
            onDeleteStory={handleDeleteStory}
            onDeleteStoryItem={handleDeleteStoryItem}
            onStorySeen={handleStorySeen}
            theme={settings.theme}
            onToggleTheme={handleToggleTheme}
            onUpdateProfile={handleUpdateProfile}
            onAddContact={handleAddContact}
            onStartChatRoom={handleStartChatRoom}
            onOpenDisguise={() => setIsDisguiseOpen(true)}
            onLogout={handleLogout}
          />
        </div>

        {/* Chat View Area */}
        <div className={`wa-chat-area-wrapper ${!showMobileChat ? 'mobile-hidden' : ''}`}>
          <ChatArea
            activeContact={activeContact}
            currentUser={currentUser}
            partnerOnlineStatus={partnerOnlineStatus}
            onBack={handleBackToContacts}
            onStartCall={handleStartCall}
            onSendMessage={handleSendMessage}
            onClearChat={handleClearChat}
          />
        </div>
      </div>

      {/* Audio & Video Calling Screen */}
      <CallModal
        callState={callState}
        onEndCall={handleEndCall}
        onAcceptCall={() => {}}
      />

      {/* Create New Group Modal */}
      <NewGroupModal
        isOpen={isNewGroupOpen}
        onClose={() => setIsNewGroupOpen(false)}
        contacts={contacts}
        onCreateGroup={handleCreateGroup}
      />

      {/* Connect Partner Over Internet Modal */}
      <PartnerConnectModal
        isOpen={isPartnerModalOpen}
        onClose={() => setIsPartnerModalOpen(false)}
        currentUser={currentUser}
        partnerOnlineStatus={partnerOnlineStatus}
        onConnectPartner={handleConnectPartner}
      />

      {/* Disguise / Secret Calculator Screen */}
      <DisguiseModal
        isOpen={isDisguiseOpen}
        onClose={() => setIsDisguiseOpen(false)}
        secretPin={settings.disguisePin || '1234'}
      />
    </div>
  );
}
