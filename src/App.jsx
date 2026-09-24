import React, { useState, useEffect, useRef } from 'react';
import { 
  getStoredUser, saveStoredUser, getStoredContacts, saveStoredContacts, 
  getStoredStories, saveStoredStories, getSettings, saveSettings,
  broadcastChange, subscribeToBroadcast, registerUsername, cleanUsername, 
  matchesContact, AVATAR_PRESETS
} from './services/store';
import { sounds } from './services/audioEffects';
import { OnlineP2PService } from './services/onlineP2P';
import { fetchCloudUsers, publishUserToCloud, pollCloudInbox, sendCloudInboxMessage } from './services/cloudRegistry';
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

  // Merge real-time Firestore rooms with local contacts without duplicates
  const mergedContacts = React.useMemo(() => {
    if (!firestoreRooms || firestoreRooms.length === 0) {
      return contacts.map((c) => (matchesContact(c, activeContactId) ? { ...c, unreadCount: 0 } : c));
    }

    const roomContacts = firestoreRooms.map((r) => {
      if (r.type === 'group') {
        const existing = contacts.find((c) => matchesContact(c, r.id));
        return {
          id: r.id,
          roomId: r.id,
          isGroup: true,
          name: r.roomName || 'Group',
          avatar: r.roomAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${r.id}`,
          about: 'Group Chat',
          isOnline: false,
          lastSeen: 'Group',
          lastMessage: r.lastMessage || existing?.lastMessage || '',
          lastMessageTimestamp: r.lastMessageTimestamp || existing?.lastMessageTimestamp,
          unreadCount: (activeContactId && matchesContact(r, activeContactId)) ? 0 : (existing?.unreadCount || 0),
          messages: existing?.messages || []
        };
      }

      // 1-to-1 room
      const otherUid = r.participants?.find((uid) => uid !== currentUser?.uid);
      const otherProfile = r.participantProfiles?.[otherUid] || {};
      const existing = contacts.find((c) => 
        matchesContact(c, r.id) || 
        (otherUid && matchesContact(c, otherUid)) ||
        (otherProfile.username && matchesContact(c, otherProfile.username))
      );

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
        lastMessage: r.lastMessage || existing?.lastMessage || '',
        lastMessageTimestamp: r.lastMessageTimestamp || existing?.lastMessageTimestamp,
        unreadCount: (activeContactId && matchesContact(r, activeContactId)) ? 0 : (existing?.unreadCount || 0),
        messages: existing?.messages || []
      };
    });

    // Strictly eliminate any contact that matches an existing Firestore room
    const nonRoomContacts = contacts
      .filter((c) => !roomContacts.some((rc) => matchesContact(c, rc)))
      .map((c) => (matchesContact(c, activeContactId) ? { ...c, unreadCount: 0 } : c));

    return [...roomContacts, ...nonRoomContacts];
  }, [firestoreRooms, contacts, currentUser?.uid, activeContactId]);

  // Real-time listener for messages in active Firestore ChatRoom (via onSnapshot)
  useEffect(() => {
    if (!activeContactId) return;

    const target = mergedContacts.find((c) => matchesContact(c, activeContactId));
    const roomId = target?.roomId || (activeContactId.startsWith('room_') ? activeContactId : null);

    if (!roomId) return;

    if (currentUser?.uid) {
      markFirestoreRoomMessagesAsRead(roomId, currentUser.uid);
    }

    const unsubscribe = subscribeToRoomMessages(
      roomId,
      (firestoreMessages) => {
        setContacts((prev) => {
          const exists = prev.some((c) => matchesContact(c, activeContactId) || matchesContact(c, roomId));
          if (exists) {
            return prev.map((c) => {
              if (matchesContact(c, activeContactId) || matchesContact(c, roomId)) {
                // Merge firestore messages + preserve any optimistic pending sent messages in-flight
                const fsIds = new Set(firestoreMessages.map((m) => m.id));
                const pendingLocal = (c.messages || []).filter(
                  (m) => !fsIds.has(m.id) && m.status === 'sent' && (Date.now() - (m.timestamp || 0) < 15000) &&
                         !firestoreMessages.some((fm) => fm.text && fm.text === m.text)
                );
                const all = [...firestoreMessages, ...pendingLocal];
                all.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

                return {
                  ...c,
                  roomId: roomId,
                  messages: all,
                  unreadCount: 0
                };
              }
              return c;
            });
          } else if (target) {
            return [{ ...target, roomId: roomId, messages: firestoreMessages, unreadCount: 0 }, ...prev];
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

    const targetContact = mergedContacts.find((c) => matchesContact(c, id));
    const targetRoomId = targetContact?.roomId || (id.startsWith('room_') ? id : null);

    // Clear unread count for this contact immediately and mark incoming messages as read
    setContacts((prev) => {
      const updated = prev.map((c) => {
        if (matchesContact(c, id) || (targetRoomId && matchesContact(c, targetRoomId))) {
          return {
            ...c,
            unreadCount: 0,
            messages: (c.messages || []).map((m) => {
              const isMine = m.senderId === 'user' || 
                m.senderId === (currentUser?.uid || currentUser?.id) ||
                (currentUser?.username && (m.senderId === currentUser.username || m.senderId === `wa_user_${currentUser.username}`));
              return isMine ? m : { ...m, status: 'read' };
            })
          };
        }
        return c;
      });
      saveStoredContacts(updated);
      return updated;
    });

    // Mark messages as read in Firestore if roomId
    if (targetRoomId && currentUser?.uid) {
      markFirestoreRoomMessagesAsRead(targetRoomId, currentUser.uid);
    }

    // Push new history state
    if (!window.history.state || window.history.state.waView !== 'chat' || window.history.state.contactId !== id) {
      window.history.pushState({ waView: 'chat', contactId: id }, '');
    }

    // Auto-connect to partner peer over P2P Internet immediately and notify of read state
    const targetIdentifier = targetContact?.username || (id?.startsWith('wa_user_') ? id.replace('wa_user_', '') : targetContact?.phone);
    if (targetIdentifier) {
      const readSignal = {
        type: 'P2P_READ',
        readerId: currentUser?.uid || currentUser?.id,
        readerUsername: currentUser?.username
      };
      if (p2pRef.current) {
        p2pRef.current.connectToPartner(targetIdentifier);
        p2pRef.current.sendData(readSignal, `wa_user_${targetIdentifier}`);
      }
      sendCloudInboxMessage(targetIdentifier, readSignal);
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

  // Handle incoming Chat Message from any transport (MQTT Cloud Relay or WebRTC P2P)
  const handleIncomingChatMessage = (payload, sourcePeerId = null) => {
    if (!payload?.message) return;

    const senderUsername = payload.senderUsername;
    const senderPeerId = sourcePeerId || payload.senderId || (senderUsername ? `wa_user_${senderUsername}` : 'partner_live');
    const incomingMsg = {
      ...payload.message,
      senderId: payload.senderId || senderPeerId,
      senderUsername: senderUsername || null
    };

    if (senderUsername) {
      registerUsername(senderUsername, {
        id: senderPeerId,
        username: senderUsername,
        name: payload.senderName || senderUsername,
        avatar: payload.senderAvatar || AVATAR_PRESETS[0]
      });
    }

    setContacts((prev) => {
      const partner = prev.find((c) => 
        matchesContact(c, senderPeerId) || 
        (senderUsername && matchesContact(c, senderUsername))
      );

      const isCurrentlyActive = Boolean(
        activeContactId && (
          matchesContact({ id: activeContactId }, senderPeerId) ||
          (senderUsername && matchesContact({ id: activeContactId }, senderUsername)) ||
          (partner && matchesContact(partner, activeContactId))
        )
      );

      incomingMsg.status = isCurrentlyActive ? 'read' : 'delivered';

      const previewText = incomingMsg.text 
        || (incomingMsg.type === 'image' ? '📷 Photo' : null)
        || (incomingMsg.type === 'voice' ? '🎤 Voice message' : null)
        || (incomingMsg.type === 'document' ? `📄 ${incomingMsg.fileName || 'Document'}` : null)
        || 'Sent a message';

      if (partner) {
        // Prevent duplicate messages by id or text+time
        const isDuplicate = partner.messages?.some(
          (m) => m.id === incomingMsg.id || 
                 (m.text && m.text === incomingMsg.text && Math.abs((m.timestamp || 0) - (incomingMsg.timestamp || 0)) < 4000)
        );
        if (isDuplicate) {
          return prev;
        }

        const updated = prev.map((c) =>
          c.id === partner.id
            ? {
                ...c,
                username: c.username || senderUsername,
                messages: [...(c.messages || []), incomingMsg],
                unreadCount: isCurrentlyActive ? 0 : ((c.unreadCount || 0) + 1),
                lastMessage: previewText,
                lastMessageTimestamp: incomingMsg.timestamp || Date.now(),
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
          name: payload.senderName || senderUsername || 'Friend',
          avatar: payload.senderAvatar || AVATAR_PRESETS[0],
          about: 'Connected on Chatz',
          isOnline: true,
          lastSeen: 'Online',
          unreadCount: isCurrentlyActive ? 0 : 1,
          lastMessage: previewText,
          lastMessageTimestamp: incomingMsg.timestamp || Date.now(),
          messages: [incomingMsg]
        };
        const updated = [newPartner, ...prev];
        saveStoredContacts(updated);
        return updated;
      }
    });

    sounds.playMessageReceived();

    // Acknowledge delivery or read state back to sender
    const isNowActive = Boolean(
      activeContactId && (
        matchesContact({ id: activeContactId }, senderPeerId) ||
        (senderUsername && matchesContact({ id: activeContactId }, senderUsername))
      )
    );

    if (payload.message?.id) {
      const ackPayload = {
        type: isNowActive ? 'P2P_READ' : 'P2P_DELIVERED',
        messageId: payload.message.id,
        readerId: currentUser?.uid || currentUser?.id,
        readerUsername: currentUser?.username
      };
      if (senderUsername) {
        sendCloudInboxMessage(senderUsername, ackPayload);
      }
      p2pRef.current?.sendData(ackPayload, senderPeerId);
    }
  };

  // Handle Delivery Receipt (double grey ticks)
  const handleDeliveryReceipt = (messageId) => {
    if (!messageId) return;
    setContacts((prev) => {
      const updated = prev.map((c) => ({
        ...c,
        messages: (c.messages || []).map((m) =>
          m.id === messageId && m.status === 'sent' ? { ...m, status: 'delivered' } : m
        )
      }));
      saveStoredContacts(updated);
      return updated;
    });
  };

  // Handle Read Receipt (double blue ticks)
  const handleReadReceipt = (readerIdentifier) => {
    if (!readerIdentifier) return;
    setContacts((prev) => {
      const updated = prev.map((c) => {
        if (matchesContact(c, readerIdentifier)) {
          return {
            ...c,
            messages: (c.messages || []).map((m) => {
              const isMine = m.senderId === 'user' || 
                m.senderId === (currentUser?.uid || currentUser?.id) ||
                (currentUser?.username && (m.senderId === currentUser.username || m.senderId === `wa_user_${currentUser.username}`));
              return isMine ? { ...m, status: 'read' } : m;
            })
          };
        }
        return c;
      });
      saveStoredContacts(updated);
      return updated;
    });
  };

  // Global Cloud Directory Sync & Offline Inbox Delivery
  useEffect(() => {
    fetchCloudUsers();

    if (!currentUser) return;

    if (currentUser.username) {
      publishUserToCloud(currentUser);
    }

    const handleInboxMessages = (inboxMsgs) => {
      if (!Array.isArray(inboxMsgs) || inboxMsgs.length === 0) return;

      inboxMsgs.forEach((payload) => {
        if (!payload) return;
        if (payload.type === 'CHAT_MESSAGE') {
          handleIncomingChatMessage(payload);
        } else if (payload.type === 'P2P_DELIVERED') {
          handleDeliveryReceipt(payload.messageId);
        } else if (payload.type === 'P2P_READ') {
          handleReadReceipt(payload.readerUsername || payload.readerId);
        }
      });
    };

    // Listen on user channels (both username and uid)
    const userChannels = [
      currentUser.username,
      currentUser.uid,
      currentUser.email ? currentUser.email.split('@')[0] : null
    ].filter(Boolean);

    pollCloudInbox(userChannels, handleInboxMessages);

    // Poll every 6 seconds for discovery
    const interval = setInterval(() => {
      fetchCloudUsers();
      pollCloudInbox(userChannels, handleInboxMessages);
    }, 6000);

    return () => clearInterval(interval);
  }, [currentUser?.username, currentUser?.uid]);

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
          handleIncomingChatMessage(payload, peerId);
        } else if (payload?.type === 'P2P_DELIVERED') {
          handleDeliveryReceipt(payload.messageId);
        } else if (payload?.type === 'P2P_READ') {
          handleReadReceipt(payload.readerUsername || payload.readerId || peerId);
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

  // Send Message with Firestore real-time sync + Real-Time MQTT Relay + WebRTC P2P + Instant 0ms Optimistic UI
  const handleSendMessage = async (msgData) => {
    if (!activeContactId) return;

    const targetContact = mergedContacts.find((c) => matchesContact(c, activeContactId));
    const roomId = targetContact?.roomId || (activeContactId.startsWith('room_') ? activeContactId : null);

    const messageId = 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowTs = Date.now();

    const newMsg = {
      id: messageId,
      senderId: currentUser?.uid || currentUser?.id || 'user',
      senderUsername: currentUser?.username || '',
      senderName: currentUser?.displayName || currentUser?.name || 'You',
      senderAvatar: currentUser?.photoURL || currentUser?.avatar || '',
      ...msgData,
      time: nowTime,
      timestamp: nowTs,
      status: 'sent' // 1. Starts with Single Grey Tick!
    };

    // 1. Play sent audio effect immediately
    sounds.playMessageSent();

    // 2. Immediate optimistic update to local UI (0ms delay for sender!)
    const previewText = msgData.text 
      || (msgData.type === 'image' ? '📷 Photo' : null)
      || (msgData.type === 'voice' ? '🎤 Voice message' : null)
      || (msgData.type === 'document' ? `📄 ${msgData.fileName || 'Document'}` : null)
      || 'Sent a message';

    setContacts((prev) => {
      const exists = prev.some((c) => matchesContact(c, activeContactId) || (roomId && matchesContact(c, roomId)));
      let updated;
      if (exists) {
        updated = prev.map((c) => {
          if (matchesContact(c, activeContactId) || (roomId && matchesContact(c, roomId))) {
            return {
              ...c,
              messages: [...(c.messages || []), newMsg],
              lastMessage: previewText,
              lastMessageTimestamp: nowTs,
              unreadCount: 0
            };
          }
          return c;
        });
      } else if (targetContact) {
        const newEntry = {
          ...targetContact,
          messages: [newMsg],
          lastMessage: previewText,
          lastMessageTimestamp: nowTs,
          unreadCount: 0
        };
        updated = [newEntry, ...prev];
      } else {
        updated = prev;
      }
      saveStoredContacts(updated);
      return updated;
    });

    // 3. Broadcast to other local browser tabs
    broadcastChange('NEW_MESSAGE', { contactId: activeContactId, message: newMsg });

    // 4. Send to Firestore in the background if active chat has a room (WITHOUT early returning!)
    if (roomId && currentUser?.uid) {
      sendFirestoreMessage(roomId, currentUser, msgData)
        .then((savedMsg) => {
          if (savedMsg?.id) {
            setContacts((prev) => {
              const updated = prev.map((c) => {
                if (matchesContact(c, activeContactId) || matchesContact(c, roomId)) {
                  return {
                    ...c,
                    messages: (c.messages || []).map((m) => (m.id === messageId ? { ...m, id: savedMsg.id } : m))
                  };
                }
                return c;
              });
              saveStoredContacts(updated);
              return updated;
            });
          }
        })
        .catch((err) => {
          console.warn('Firestore message dispatch notice (falling back):', err);
        });
    }

    // 5. Target identifiers for Real-Time MQTT Relay & WebRTC P2P
    const targetUsername = targetContact?.username || 
      (targetContact?.id?.startsWith('wa_user_') ? targetContact.id.replace('wa_user_', '') : null) ||
      (targetContact?.otherUid ? targetContact.otherUid : null);

    const wirePayload = {
      type: 'CHAT_MESSAGE',
      message: newMsg,
      senderId: currentUser?.uid || (currentUser?.username ? `wa_user_${currentUser.username}` : 'user'),
      senderUsername: currentUser?.username || null,
      senderName: currentUser?.displayName || currentUser?.name || 'Friend',
      senderAvatar: currentUser?.photoURL || currentUser?.avatar || null
    };

    // 6. Send over Real-Time MQTT Cloud Relay (works over 4G/5G mobile data, WiFi, hotspots!)
    if (targetUsername) {
      sendCloudInboxMessage(targetUsername, wirePayload);
    }
    if (targetContact?.otherUid && targetContact.otherUid !== targetUsername) {
      sendCloudInboxMessage(targetContact.otherUid, wirePayload);
    }

    // 7. Send over WebRTC P2P (direct peer connection)
    const targetPeerId = targetUsername ? `wa_user_${targetUsername}` : activeContactId;
    p2pRef.current?.sendData(wirePayload, targetPeerId);

    // 8. Single grey tick to double grey tick progression fallback (600ms)
    setTimeout(() => {
      setContacts((prev) => {
        const updated = prev.map((c) => {
          if (matchesContact(c, activeContactId) || (roomId && matchesContact(c, roomId))) {
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
