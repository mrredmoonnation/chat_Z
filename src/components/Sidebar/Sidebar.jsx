import React, { useState, useEffect, useMemo } from 'react';
import { 
  MessageSquare, CircleDashed, Users, MoreVertical, Search, 
  Phone, Video, Sun, Moon, LogOut, CheckCheck, 
  ArrowUpRight, ArrowDownLeft, PhoneMissed, Globe, X,
  ArrowLeft, Camera, Check, User, Info, UserPlus, AtSign, Sparkles,
  Calculator
} from 'lucide-react';
import { 
  AVATAR_PRESETS, GENDER_AVATARS, generateBitmojiAvatar,
  isUsernameAvailable, cleanUsername, 
  isValidUsernameFormat, registerUsername, searchUsersByUsername,
  subscribeToBroadcast, matchesContact
} from '../../services/store';
import { fetchCloudUsers } from '../../services/cloudRegistry';
import { searchFirestoreUsers } from '../../services/firestoreChat';
import { compressAvatar } from '../../services/imageUtils';
import StatusView from '../Status/StatusView';

const DRAWER_BIO_PRESETS = [
  '📶 Available on WiFi',
  '❤️ In love',
  '💻 Busy coding',
  '😴 Sleeping',
  '📞 Urgent calls only',
  '✨ Living my best life',
  'Hey there! I am using Chatz'
];

export default function Sidebar({
  currentUser,
  contacts,
  activeContactId,
  onSelectContact,
  onOpenNewGroup,
  onOpenPartnerModal,
  onOpenDisguise,
  partnerOnlineStatus,
  onStartCall,
  stories,
  onAddStory,
  onReplyToStory,
  onDeleteStory,
  onDeleteStoryItem,
  onStorySeen,
  theme,
  onToggleTheme,
  onUpdateProfile,
  onAddContact,
  onStartChatRoom,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState('chats'); // 'chats', 'status', 'calls'
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editUsername, setEditUsername] = useState(currentUser?.username || '');
  const [editUsernameStatus, setEditUsernameStatus] = useState('');
  const [editGender, setEditGender] = useState(currentUser?.gender || 'male');
  const [editAbout, setEditAbout] = useState(currentUser?.about || '📶 Available on WiFi');
  const [editAvatar, setEditAvatar] = useState(currentUser?.avatar || AVATAR_PRESETS[0]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state if currentUser changes
  React.useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name || '');
      setEditUsername(currentUser.username || '');
      setEditGender(currentUser.gender || 'male');
      setEditAbout(currentUser.about || '📶 Available on WiFi');
      setEditAvatar(currentUser.avatar || AVATAR_PRESETS[0]);
    }
  }, [currentUser]);

  const handleEditUsernameChange = (val) => {
    const clean = cleanUsername(val);
    setEditUsername(clean);
    if (!clean) {
      setEditUsernameStatus('');
      return;
    }
    if (!isValidUsernameFormat(clean)) {
      setEditUsernameStatus('invalid');
      return;
    }
    const avail = isUsernameAvailable(clean, currentUser?.id);
    setEditUsernameStatus(avail ? 'available' : 'taken');
  };

  const handleGenderChange = (newGender) => {
    setEditGender(newGender);
    // Switch to appropriate Bitmoji preset
    if (GENDER_AVATARS[newGender]?.[0]) {
      setEditAvatar(GENDER_AVATARS[newGender][0]);
    }
  };

  const handleGenerateBitmoji = () => {
    const newBitmoji = generateBitmojiAvatar(editName || editUsername || ('User_' + Math.floor(Math.random() * 1000)), editGender);
    setEditAvatar(newBitmoji);
  };

  const handleDrawerFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressAvatar(file, 256, 0.8);
        setEditAvatar(compressed);
      } catch (err) {
        console.error('Failed to compress avatar:', err);
      }
    }
  };

  const handleSaveDrawerProfile = () => {
    if (!editName.trim() || !onUpdateProfile) return;
    const clean = cleanUsername(editUsername || currentUser?.username || '');
    if (!clean || !isValidUsernameFormat(clean)) return;
    if (!isUsernameAvailable(clean, currentUser?.id)) return;

    const updated = {
      ...currentUser,
      name: editName.trim(),
      username: clean,
      gender: editGender,
      about: editAbout.trim() || '📶 Available on WiFi',
      avatar: editAvatar
    };
    registerUsername(clean, updated);
    onUpdateProfile(updated);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsProfileDrawerOpen(false);
    }, 800);
  };

  // Add Contact Modal State (Instagram Style Username Discovery)
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactUsername, setNewContactUsername] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactAbout, setNewContactAbout] = useState('Hey there! I am using Chatz');
  const [newContactGender, setNewContactGender] = useState('female');
  const [newContactAvatar, setNewContactAvatar] = useState(GENDER_AVATARS.female[0]);
  const [isManualEntry, setIsManualEntry] = useState(false);

  // Handle Escape key to close open drawers, menus, or modals
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isProfileDrawerOpen) setIsProfileDrawerOpen(false);
        if (isAddContactOpen) setIsAddContactOpen(false);
        if (showMenu) setShowMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProfileDrawerOpen, isAddContactOpen, showMenu]);

  // Close 3-dots menu on outside touch/click
  useEffect(() => {
    if (!showMenu) return;
    const handleOutsideMenu = (e) => {
      if (!e.target.closest('.wa-sidebar-menu-dropdown') && !e.target.closest('#sidebarMenuBtn')) {
        setShowMenu(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideMenu);
    return () => document.removeEventListener('pointerdown', handleOutsideMenu);
  }, [showMenu]);

  // Manual Contact Creation
  const handleAddContactSubmit = (e) => {
    e.preventDefault();
    if (!newContactName.trim()) return;

    const cleanU = cleanUsername(newContactUsername);
    const newContact = {
      id: cleanU ? ('wa_user_' + cleanU) : ('contact_' + Date.now()),
      username: cleanU || null,
      name: newContactName.trim(),
      phone: newContactPhone.trim() || '',
      about: newContactAbout.trim() || 'Hey there! I am using Chatz',
      avatar: newContactAvatar || AVATAR_PRESETS[1],
      isOnline: true,
      lastSeen: 'Online',
      unreadCount: 0,
      messages: []
    };

    if (onAddContact) {
      onAddContact(newContact);
    }
    onSelectContact(newContact.id);
    setIsAddContactOpen(false);
    setNewContactName('');
    setNewContactUsername('');
    setNewContactPhone('');
    setNewContactAbout('Hey there! I am using Chatz');
    setModalSearchQuery('');
    setIsManualEntry(false);
  };

  // Connect directly with any discovered global user (via Firestore Room or P2P)
  const handleConnectWithGlobalUser = async (u) => {
    if (onStartChatRoom) {
      try {
        const room = await onStartChatRoom(u);
        if (room) {
          onSelectContact(room.id);
          setSearchQuery('');
          setIsAddContactOpen(false);
          setModalSearchQuery('');
          return;
        }
      } catch (e) {
        console.warn('onStartChatRoom warning:', e);
      }
    }

    const newContact = {
      id: u.uid ? `user_${u.uid}` : (u.id || ('wa_user_' + u.username)),
      uid: u.uid || null,
      username: u.username,
      name: u.displayName || u.name,
      about: u.about || 'Hey there! I am using Chatz',
      avatar: u.photoURL || u.avatar || AVATAR_PRESETS[0],
      phone: u.phone || '',
      email: u.email || '',
      isOnline: true,
      lastSeen: 'Online',
      unreadCount: 0,
      messages: []
    };
    if (onAddContact) onAddContact(newContact);
    onSelectContact(newContact.id);
    setSearchQuery('');
    setIsAddContactOpen(false);
    setModalSearchQuery('');
  };

  // Calls History (starts empty, only real calls recorded)
  const [callsHistory] = useState([]);

  // Highlight matching text helper
  const highlightMatch = (text, query) => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="wa-highlight-mark">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Filter contacts by search query (name, username, phone, about, or messages inside the chat)
  const q = searchQuery.trim().toLowerCase();
  const cleanQ = cleanUsername(searchQuery);
  const filteredContacts = contacts.filter((c) => {
    if (!q) return true;
    const nameMatch = c.name?.toLowerCase().includes(q);
    const userMatch = c.username?.toLowerCase().includes(cleanQ || q);
    const phoneMatch = c.phone?.includes(q);
    const aboutMatch = c.about?.toLowerCase().includes(q);
    const messageMatch = c.messages?.some(
      (m) =>
        (m.text && m.text.toLowerCase().includes(q)) ||
        (m.fileName && m.fileName.toLowerCase().includes(q))
    );
    return nameMatch || userMatch || phoneMatch || aboutMatch || messageMatch;
  });

  // Registry sync tick for real-time global user updates
  const [registryTick, setRegistryTick] = useState(0);
  const [firestoreSearchResults, setFirestoreSearchResults] = useState([]);

  useEffect(() => {
    const unsub = subscribeToBroadcast((data) => {
      if (data?.type === 'USERNAMES_UPDATED') {
        setRegistryTick((prev) => prev + 1);
      }
    });
    return unsub;
  }, []);

  // Modal Instagram-style user query
  const cleanModalQ = cleanUsername(modalSearchQuery);

  // Fetch latest global users on typing search (both Cloud Registry & Firestore Users collection)
  useEffect(() => {
    const currentQ = searchQuery.trim() || modalSearchQuery.trim();
    if (currentQ.length >= 2) {
      const timer = setTimeout(() => {
        fetchCloudUsers().then(() => setRegistryTick((prev) => prev + 1));
        searchFirestoreUsers(currentQ, currentUser?.uid).then((results) => {
          setFirestoreSearchResults(results || []);
        });
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setFirestoreSearchResults([]);
    }
  }, [searchQuery, modalSearchQuery, currentUser?.uid]);

  // Global Instagram-style user discovery
  const globalUserResults = React.useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const localMatches = searchUsersByUsername(searchQuery);
    
    // Combine local store and Firestore users
    const combined = [...firestoreSearchResults, ...localMatches];
    const seen = new Set();
    const deduped = [];

    combined.forEach((u) => {
      const key = u.uid || u.username?.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        deduped.push({
          uid: u.uid || null,
          id: u.uid ? `user_${u.uid}` : (u.id || ('wa_user_' + u.username)),
          username: u.username,
          name: u.displayName || u.name,
          avatar: u.photoURL || u.avatar || AVATAR_PRESETS[0],
          about: u.about || 'Hey there! I am using Chatz'
        });
      }
    });

    const existingIds = new Set(contacts.map((c) => c.id));
    const existingUsernames = new Set(contacts.map((c) => c.username?.toLowerCase()).filter(Boolean));
    return deduped.filter((u) => 
      u.uid !== currentUser?.uid &&
      u.username?.toLowerCase() !== currentUser?.username?.toLowerCase() &&
      !existingIds.has(u.id) &&
      !existingUsernames.has(u.username?.toLowerCase())
    );
  }, [searchQuery, contacts, currentUser, registryTick, firestoreSearchResults]);

  // Modal Instagram-style user discovery
  const modalSearchResults = React.useMemo(() => {
    if (!cleanModalQ) return [];
    const localMatches = searchUsersByUsername(cleanModalQ);
    const combined = [...firestoreSearchResults, ...localMatches];
    const seen = new Set();
    const deduped = [];

    combined.forEach((u) => {
      const key = u.uid || u.username?.toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        deduped.push({
          uid: u.uid || null,
          id: u.uid ? `user_${u.uid}` : (u.id || ('wa_user_' + u.username)),
          username: u.username,
          name: u.displayName || u.name,
          avatar: u.photoURL || u.avatar || AVATAR_PRESETS[0],
          about: u.about || 'Hey there! I am using Chatz'
        });
      }
    });

    return deduped.filter((u) => 
      u.uid !== currentUser?.uid &&
      u.username?.toLowerCase() !== currentUser?.username?.toLowerCase()
    );
  }, [cleanModalQ, currentUser, registryTick, firestoreSearchResults]);

  // Check if search query matches user's own identity or an exact existing contact
  const hasExactContact = contacts.some(
    (c) => c.username?.toLowerCase() === cleanQ || c.name?.toLowerCase() === cleanQ || c.id === ('wa_user_' + cleanQ)
  );
  const isSelf = currentUser?.username?.toLowerCase() === cleanQ || currentUser?.id === ('wa_user_' + cleanQ);
  const showDirectChatOption = Boolean(cleanQ && cleanQ.length >= 2 && !hasExactContact && !isSelf);

  return (
    <aside className="wa-sidebar">
      {/* Top Header */}
      <div className="wa-sidebar-header">
        <div 
          className="wa-avatar" 
          title="Click to view & edit your Profile (Name & Bio)"
          onClick={() => setIsProfileDrawerOpen(true)}
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          <img src={currentUser?.avatar} alt={currentUser?.name} />
          <div 
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: 'var(--wa-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#111b21',
              border: '1.5px solid var(--wa-bg-header)'
            }}
            title="Edit Profile"
          >
            <Camera size={9} />
          </div>
        </div>

        <div className="wa-header-actions">
          {/* Internet P2P Partner Connect Button */}
          <button
            id="connectPartnerBtn"
            className={`wa-icon-btn ${partnerOnlineStatus === 'connected' ? 'active' : ''}`}
            onClick={onOpenPartnerModal}
            title={partnerOnlineStatus === 'connected' ? 'Connected Live with Partner over Internet' : 'Connect with Partner over Internet'}
            style={{
              color: partnerOnlineStatus === 'connected' ? 'var(--wa-green-light)' : 'var(--wa-text-secondary)',
              position: 'relative'
            }}
          >
            <Globe size={20} />
            {partnerOnlineStatus === 'connected' && (
              <div style={{ position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--wa-green)', border: '1.5px solid var(--wa-bg-header)' }} />
            )}
          </button>

          {/* New Chat / Add Contact button */}
          <button
            id="newChatBtn"
            className="wa-icon-btn"
            onClick={() => setIsAddContactOpen(true)}
            title="New Chat / Add Contact"
          >
            <UserPlus size={20} />
          </button>

          {/* Communities / Group button */}
          <button
            id="newGroupBtn"
            className="wa-icon-btn"
            onClick={onOpenNewGroup}
            title="New Group"
          >
            <Users size={20} />
          </button>

          {/* Status Tab shortcut */}
          <button
            className={`wa-icon-btn ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab(activeTab === 'status' ? 'chats' : 'status')}
            title="Status"
          >
            <CircleDashed size={20} />
          </button>

          {/* Stealth Disguise Lock Button */}
          <button
            id="stealthLockBtn"
            type="button"
            className="wa-icon-btn wa-stealth-trigger"
            onClick={onOpenDisguise}
            title="Calculator Disguise Lock (Ctrl+Shift+L)"
          >
            <Calculator size={18} />
          </button>

          {/* 3 Dots Menu */}
          <div style={{ position: 'relative' }}>
            <button
              id="sidebarMenuBtn"
              type="button"
              className="wa-icon-btn"
              onClick={() => setShowMenu(!showMenu)}
              title="Menu"
            >
              <MoreVertical size={20} />
            </button>

            {showMenu && (
              <div
                className="wa-sidebar-menu-dropdown"
                style={{
                  position: 'absolute',
                  top: '44px',
                  right: 0,
                  backgroundColor: 'var(--wa-bg-panel-secondary)',
                  borderRadius: 8,
                  boxShadow: 'var(--wa-shadow-lg)',
                  border: '1px solid var(--wa-border)',
                  width: 180,
                  zIndex: 200,
                  overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => {
                    setIsAddContactOpen(true);
                    setShowMenu(false);
                  }}
                  style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <UserPlus size={16} />
                  <span>New contact</span>
                </div>

                <div
                  onClick={() => {
                    onOpenNewGroup();
                    setShowMenu(false);
                  }}
                  style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <Users size={16} />
                  <span>New group</span>
                </div>

                <div
                  onClick={() => {
                    onOpenDisguise && onOpenDisguise();
                    setShowMenu(false);
                  }}
                  style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: '#f59e0b' }}
                >
                  <Calculator size={16} />
                  <span>Disguise mode</span>
                </div>

                <div
                  onClick={() => {
                    onToggleTheme();
                    setShowMenu(false);
                  }}
                  style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                </div>

                <div
                  onClick={() => {
                    onLogout();
                    setShowMenu(false);
                  }}
                  style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--wa-danger)', display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <LogOut size={16} />
                  <span>Log out</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="wa-sidebar-tabs">
        <button
          className={`wa-sidebar-tab ${activeTab === 'chats' ? 'active' : ''}`}
          onClick={() => setActiveTab('chats')}
        >
          <MessageSquare size={16} />
          <span>Chats</span>
        </button>

        <button
          className={`wa-sidebar-tab ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          <CircleDashed size={16} />
          <span>Status</span>
        </button>

        <button
          className={`wa-sidebar-tab ${activeTab === 'calls' ? 'active' : ''}`}
          onClick={() => setActiveTab('calls')}
        >
          <Phone size={16} />
          <span>Calls</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'chats' && (
        <>
          {/* Search Box */}
          <div className="wa-search-container">
            <div className="wa-search-input-box">
              <Search size={16} />
              <input
                id="searchChatsInput"
                type="text"
                placeholder="Search contacts, @usernames, or messages"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredContacts.length === 1) {
                      onSelectContact(filteredContacts[0].id);
                      setSearchQuery('');
                    } else if (showDirectChatOption) {
                      handleConnectWithGlobalUser({ username: cleanQ, name: cleanQ });
                    }
                  }
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="wa-search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--wa-text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Chat List */}
          <div className="wa-chat-list">
            {filteredContacts.length === 0 ? (
              !searchQuery.trim() ? (
                <div className="wa-empty-contacts-state">
                  <div className="wa-empty-contacts-icon">
                    <MessageSquare size={38} color="var(--wa-green)" />
                  </div>
                  <div className="wa-empty-contacts-title">
                    No chats yet
                  </div>
                  <div className="wa-empty-contacts-desc">
                    Only contacts you add or connect with will appear here. Start your private conversation now!
                  </div>
                  <div className="wa-empty-contacts-actions">
                    <button
                      type="button"
                      className="wa-empty-btn-primary"
                      onClick={() => setIsAddContactOpen(true)}
                    >
                      <UserPlus size={16} />
                      <span>New Chat / Add Contact</span>
                    </button>
                    <button
                      type="button"
                      className="wa-empty-btn-secondary"
                      onClick={onOpenPartnerModal}
                    >
                      <Globe size={16} />
                      <span>Connect Partner Online</span>
                    </button>
                  </div>
                </div>
              ) : (globalUserResults.length > 0 || showDirectChatOption) ? (
                <div className="wa-global-search-section" style={{ padding: '8px 12px' }}>
                  {globalUserResults.length > 0 && (
                    <>
                      <div className="wa-global-search-header">
                        <AtSign size={14} />
                        <span>Registered Users Found (@users)</span>
                      </div>
                      {globalUserResults.map((u) => (
                        <div key={u.id || u.username} className="wa-global-user-item">
                          <div className="wa-avatar" style={{ width: 42, height: 42 }}>
                            <img src={u.avatar || AVATAR_PRESETS[0]} alt={u.name} />
                          </div>
                          <div className="wa-global-user-info">
                            <div className="wa-global-user-name">{u.name}</div>
                            <div className="wa-global-user-handle">@{u.username}</div>
                            {u.about && <div className="wa-global-user-about">{u.about}</div>}
                          </div>
                          <button 
                            type="button" 
                            className="wa-global-user-chat-btn"
                            onClick={() => handleConnectWithGlobalUser(u)}
                          >
                            <MessageSquare size={14} />
                            <span>Chat</span>
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {/* Direct Connect Option for any entered username */}
                  {showDirectChatOption && !globalUserResults.some(u => u.username?.toLowerCase() === cleanQ) && (
                    <div style={{ marginTop: globalUserResults.length > 0 ? 12 : 4 }}>
                      <div className="wa-global-search-header" style={{ color: 'var(--wa-green-light)' }}>
                        <Sparkles size={14} />
                        <span>Start Direct P2P Chat</span>
                      </div>
                      <div 
                        className="wa-global-user-item" 
                        style={{ 
                          backgroundColor: 'var(--wa-bg-panel)', 
                          border: '1.5px solid var(--wa-green)',
                          boxShadow: 'var(--wa-shadow-sm)'
                        }}
                      >
                        <div className="wa-avatar" style={{ width: 42, height: 42 }}>
                          <img src={generateBitmojiAvatar(cleanQ, 'male')} alt={cleanQ} />
                          <div className="wa-avatar-badge" style={{ backgroundColor: 'var(--wa-green)' }} />
                        </div>
                        <div className="wa-global-user-info">
                          <div className="wa-global-user-name">@{cleanQ}</div>
                          <div className="wa-global-user-handle" style={{ color: 'var(--wa-green-light)', fontWeight: 500 }}>
                            ⚡ Connect Live over Internet
                          </div>
                          <div className="wa-global-user-about">Press Enter or click Chat to begin</div>
                        </div>
                        <button 
                          type="button" 
                          className="wa-global-user-chat-btn"
                          onClick={() => handleConnectWithGlobalUser({ username: cleanQ, name: cleanQ })}
                          style={{ 
                            backgroundColor: 'var(--wa-green)', 
                            color: '#111b21', 
                            fontWeight: 600,
                            padding: '8px 16px',
                            borderRadius: 20
                          }}
                        >
                          <MessageSquare size={14} />
                          <span>Chat</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="wa-no-chats-found">
                  <div className="wa-no-chats-icon">
                    <Search size={32} />
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--wa-text-primary)', marginBottom: '4px' }}>
                    No chats found
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--wa-text-secondary)', marginBottom: '8px' }}>
                    Type at least 2 characters of @username to start a chat
                  </div>
                  <button
                    type="button"
                    className="wa-clear-search-btn"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear Search
                  </button>
                </div>
              )
            ) : (
              <>
                {filteredContacts.map((contact) => {
                  const lastMsg = contact.messages?.[contact.messages.length - 1];
                  const isSelected = Boolean(activeContactId && matchesContact(contact, activeContactId));

                  const isLastMsgOutgoing = lastMsg && (
                    lastMsg.senderId === 'user' ||
                    (currentUser?.uid && (lastMsg.senderId === currentUser.uid || lastMsg.senderId === `user_${currentUser.uid}`)) ||
                    (currentUser?.username && (
                      lastMsg.senderId === currentUser.username ||
                      lastMsg.senderId === `wa_user_${currentUser.username}` ||
                      (lastMsg.senderUsername && lastMsg.senderUsername.toLowerCase() === currentUser.username.toLowerCase())
                    ))
                  );

                  // Check if any message in this chat matches the query
                  const matchedMsg = q
                    ? contact.messages
                        ?.slice()
                        .reverse()
                        .find(
                          (m) =>
                            (m.text && m.text.toLowerCase().includes(q)) ||
                            (m.fileName && m.fileName.toLowerCase().includes(q))
                        )
                    : null;

                  return (
                    <div
                      key={contact.id}
                      className={`wa-chat-item ${isSelected ? 'active' : ''} ${!isSelected && contact.unreadCount > 0 ? 'unread' : ''}`}
                      onClick={() => onSelectContact(contact.id)}
                      id={`chatItem_${contact.id}`}
                    >
                      <div className="wa-avatar">
                        <img src={contact.avatar} alt={contact.name} />
                        {contact.isOnline && <div className="wa-avatar-badge" />}
                      </div>

                      <div className="wa-chat-info">
                        <div className="wa-chat-header-row">
                          <div className="wa-chat-name" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>{highlightMatch(contact.name, q)}</span>
                            {contact.username && (
                              <span className="wa-chat-username-pill">@{contact.username}</span>
                            )}
                          </div>
                          <div className="wa-chat-time">{lastMsg?.time || 'Yesterday'}</div>
                        </div>

                        <div className="wa-chat-preview-row">
                          <div className={`wa-chat-preview-text ${contact.isTyping ? 'typing' : ''}`}>
                            {contact.isTyping ? (
                              'typing...'
                            ) : (
                              <>
                                {isLastMsgOutgoing && !matchedMsg && (
                                  <CheckCheck 
                                    size={14} 
                                    color={lastMsg?.status === 'read' ? "#53bdeb" : "var(--wa-text-secondary)"} 
                                    style={{ flexShrink: 0 }} 
                                  />
                                )}
                                <span>
                                  {matchedMsg ? (
                                    <>
                                      <span style={{ color: 'var(--wa-green-light)', fontWeight: 500, marginRight: 4 }}>
                                        Matched:
                                      </span>
                                      {highlightMatch(matchedMsg.text || matchedMsg.fileName, q)}
                                    </>
                                  ) : lastMsg?.text ? (
                                    highlightMatch(lastMsg.text, q)
                                  ) : lastMsg?.type === 'image' ? (
                                    '📷 Photo'
                                  ) : lastMsg?.type === 'voice' ? (
                                    '🎤 Voice message'
                                  ) : (
                                    'Draft'
                                  )}
                                </span>
                              </>
                            )}
                          </div>

                          {!isSelected && contact.unreadCount > 0 && (
                            <div className="wa-unread-badge">{contact.unreadCount}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* If searching and global registered users match */}
                {globalUserResults.length > 0 && (
                  <div className="wa-global-search-section" style={{ padding: '12px 12px 6px 12px', borderTop: '1px solid var(--wa-border)' }}>
                    <div className="wa-global-search-header">
                      <AtSign size={14} />
                      <span>Other users on Chatz (@users)</span>
                    </div>
                    {globalUserResults.map((u) => (
                      <div key={u.id || u.username} className="wa-global-user-item">
                        <div className="wa-avatar" style={{ width: 40, height: 40 }}>
                          <img src={u.avatar || AVATAR_PRESETS[0]} alt={u.name} />
                        </div>
                        <div className="wa-global-user-info">
                          <div className="wa-global-user-name">{u.name}</div>
                          <div className="wa-global-user-handle">@{u.username}</div>
                          {u.about && <div className="wa-global-user-about">{u.about}</div>}
                        </div>
                        <button 
                          type="button" 
                          className="wa-global-user-chat-btn"
                          onClick={() => handleConnectWithGlobalUser(u)}
                        >
                          <MessageSquare size={14} />
                          <span>Chat</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct Connect option if user searches for an unadded @username */}
                {showDirectChatOption && !globalUserResults.some(u => u.username?.toLowerCase() === cleanQ) && (
                  <div style={{ padding: '10px 12px', borderTop: '1px solid var(--wa-border)' }}>
                    <div 
                      className="wa-global-user-item" 
                      style={{ 
                        backgroundColor: 'var(--wa-bg-panel-secondary)', 
                        border: '1.5px solid var(--wa-green)',
                        borderRadius: 10,
                        cursor: 'pointer' 
                      }}
                      onClick={() => handleConnectWithGlobalUser({ username: cleanQ, name: cleanQ })}
                    >
                      <div className="wa-avatar" style={{ width: 40, height: 40 }}>
                        <img src={generateBitmojiAvatar(cleanQ, 'male')} alt={cleanQ} />
                        <div className="wa-avatar-badge" style={{ backgroundColor: 'var(--wa-green)' }} />
                      </div>
                      <div className="wa-global-user-info" style={{ flex: 1 }}>
                        <div className="wa-global-user-name" style={{ fontSize: '13.5px' }}>Start new chat with @{cleanQ}</div>
                        <div className="wa-global-user-handle" style={{ color: 'var(--wa-green-light)', fontSize: '12px' }}>
                          ⚡ Connect Live over Internet P2P
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="wa-global-user-chat-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConnectWithGlobalUser({ username: cleanQ, name: cleanQ });
                        }}
                      >
                        <MessageSquare size={14} />
                        <span>Chat</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Status Tab */}
      {activeTab === 'status' && (
        <StatusView
          currentUser={currentUser}
          stories={stories}
          onAddStory={onAddStory}
          onReplyToStory={onReplyToStory}
          onDeleteStory={onDeleteStory}
          onDeleteStoryItem={onDeleteStoryItem}
          onStorySeen={onStorySeen}
        />
      )}

      {/* Calls Tab */}
      {activeTab === 'calls' && (
        <div className="wa-chat-list">
          {callsHistory.length === 0 ? (
            <div className="wa-empty-contacts-state">
              <div className="wa-empty-contacts-icon">
                <Phone size={36} color="var(--wa-green)" />
              </div>
              <div className="wa-empty-contacts-title">No recent calls</div>
              <div className="wa-empty-contacts-desc">
                When you make or receive audio and video calls, they will appear here.
              </div>
            </div>
          ) : (
            <>
              <div style={{ padding: '12px 16px 6px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--wa-green-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Recent Calls
              </div>
              {callsHistory.map((call) => (
                <div key={call.id} className="wa-chat-item">
                  <div className="wa-avatar">
                    <img src={call.avatar} alt={call.contactName} />
                  </div>

                  <div className="wa-chat-info">
                    <div className="wa-chat-name">{call.contactName}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12.5px', color: 'var(--wa-text-secondary)' }}>
                      {call.direction === 'outgoing' && <ArrowUpRight size={14} color="var(--wa-green)" />}
                      {call.direction === 'incoming' && <ArrowDownLeft size={14} color="var(--wa-green)" />}
                      {call.direction === 'missed' && <PhoneMissed size={14} color="var(--wa-danger)" />}
                      <span>{call.time}</span>
                    </div>
                  </div>

                  <button
                    className="wa-icon-btn"
                    onClick={() => {
                      const target = contacts.find((c) => c.name === call.contactName) || contacts[0];
                      if (target) onStartCall(target, call.type === 'video');
                    }}
                    title={`Call ${call.contactName}`}
                  >
                    {call.type === 'video' ? <Video size={18} color="var(--wa-green)" /> : <Phone size={18} color="var(--wa-green)" />}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Slide-out Profile Drawer (Edit Name, Bio & Avatar) */}
      {isProfileDrawerOpen && (
        <div className="wa-profile-drawer">
          <div className="wa-profile-drawer-header">
            <button 
              className="wa-icon-btn" 
              onClick={() => setIsProfileDrawerOpen(false)}
              style={{ color: 'var(--wa-text-primary)' }}
              title="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <span>Profile</span>
          </div>

          <div className="wa-profile-drawer-body">
            {/* Avatar Uploader & Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label 
                htmlFor="drawerAvatarInput" 
                className="wa-profile-upload-circle"
                style={{ width: 120, height: 120, marginBottom: 14 }}
                title="Click to change profile picture"
              >
                <img src={editAvatar} alt="Profile preview" />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}>
                  <Camera size={26} />
                </div>
              </label>
              <input 
                id="drawerAvatarInput" 
                type="file" 
                accept="image/*" 
                onChange={handleDrawerFileUpload} 
                style={{ display: 'none' }} 
              />
              
              {/* Gender Selection & Bitmoji Picker */}
              <div style={{ width: '100%', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--wa-green-light)' }}>
                    Select Gender for Bitmoji:
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateBitmoji}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'none',
                      border: 'none',
                      color: 'var(--wa-blue-ticks)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                    title="Generate a unique Bitmoji avatar"
                  >
                    <Sparkles size={13} />
                    <span>🎲 Roll Bitmoji</span>
                  </button>
                </div>

                {/* Male / Female Segmented Pill Buttons */}
                <div className="wa-gender-selector-group">
                  <button
                    type="button"
                    className={`wa-gender-btn ${editGender === 'male' ? 'active' : ''}`}
                    onClick={() => handleGenderChange('male')}
                  >
                    <span>👨 Male</span>
                  </button>
                  <button
                    type="button"
                    className={`wa-gender-btn ${editGender === 'female' ? 'active' : ''}`}
                    onClick={() => handleGenderChange('female')}
                  >
                    <span>👩 Female</span>
                  </button>
                </div>

                <div style={{ fontSize: '11.5px', color: 'var(--wa-text-muted)', margin: '8px 0 6px 0' }}>
                  Pick your {editGender === 'female' ? 'Female 👩' : 'Male 👨'} Bitmoji:
                </div>
                <div className="wa-avatar-picker-chips">
                  {(GENDER_AVATARS[editGender] || AVATAR_PRESETS).map((p, i) => (
                    <div 
                      key={i} 
                      className={`wa-avatar-chip ${editAvatar === p ? 'selected' : ''}`}
                      onClick={() => setEditAvatar(p)}
                      title={`Bitmoji ${i + 1}`}
                    >
                      <img src={p} alt={`Bitmoji ${i}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Username Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--wa-green-light)' }}>
                  Your Username (@handle)
                </label>
                {editUsernameStatus === 'available' && (
                  <span style={{ fontSize: '11px', color: '#00a884', fontWeight: 600 }}>✓ Available</span>
                )}
                {editUsernameStatus === 'taken' && (
                  <span style={{ fontSize: '11px', color: '#ea4335', fontWeight: 600 }}>✕ Taken</span>
                )}
                {editUsernameStatus === 'invalid' && (
                  <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>3-20 chars (a-z, 0-9, _, .)</span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: 11, color: 'var(--wa-text-secondary)', fontWeight: 600, fontSize: '14px' }}>
                  @
                </span>
                <input 
                  type="text" 
                  className="wa-phone-number-field" 
                  value={editUsername}
                  onChange={(e) => handleEditUsernameChange(e.target.value)}
                  placeholder="username"
                  style={{ width: '100%', height: 42, fontSize: '14px', paddingLeft: 28 }}
                />
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--wa-text-muted)', marginTop: 4, display: 'block' }}>
                Unique handle like Instagram. People can search and connect with you using this.
              </span>
            </div>

            {/* Name Field */}
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--wa-green-light)', display: 'block', marginBottom: 6 }}>
                Your Name
              </label>
              <input 
                type="text" 
                className="wa-phone-number-field" 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter your name"
                style={{ width: '100%', height: 42, fontSize: '14.5px' }}
              />
              <span style={{ fontSize: '11.5px', color: 'var(--wa-text-muted)', marginTop: 4, display: 'block' }}>
                This name will be displayed in your partner's chat.
              </span>
            </div>

            {/* Bio / About Field */}
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--wa-green-light)', display: 'block', marginBottom: 6 }}>
                About / Bio Status
              </label>
              <input 
                type="text" 
                className="wa-phone-number-field" 
                value={editAbout}
                onChange={(e) => setEditAbout(e.target.value)}
                placeholder="Status"
                style={{ width: '100%', height: 42, fontSize: '14px' }}
              />

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: '11.5px', color: 'var(--wa-text-muted)', marginBottom: 6 }}>
                  Quick Suggestions:
                </div>
                <div className="wa-bio-chips" style={{ marginBottom: 0 }}>
                  {DRAWER_BIO_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`wa-bio-chip ${editAbout === preset ? 'selected' : ''}`}
                      onClick={() => setEditAbout(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Account Info Badge */}
            <div style={{ padding: '12px 14px', backgroundColor: 'var(--wa-bg-input)', borderRadius: 8, border: '1px solid var(--wa-border)' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--wa-text-muted)', marginBottom: 2 }}>
                {currentUser?.phone ? 'Linked Phone Number' : 'Linked Gmail / Email'}
              </div>
              <div style={{ fontSize: '13.5px', color: 'var(--wa-text-primary)', fontWeight: 500 }}>
                {currentUser?.phone || currentUser?.email || 'Active Account'}
              </div>
            </div>

            {/* Save Button */}
            <button 
              className="wa-login-cta-btn"
              onClick={handleSaveDrawerProfile}
              disabled={!editName.trim() || editUsernameStatus === 'taken' || editUsernameStatus === 'invalid'}
              style={{ marginTop: 8 }}
            >
              {saveSuccess ? (
                <>
                  <Check size={18} />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Profile</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Add New Contact / Start Chat Modal (Instagram Discovery) */}
      {isAddContactOpen && (
        <div className="wa-modal-backdrop" onClick={() => setIsAddContactOpen(false)}>
          <div className="wa-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 168, 132, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--wa-green)'
                }}>
                  <UserPlus size={20} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--wa-text-primary)' }}>New Chat</h3>
              </div>
              <button 
                onClick={() => setIsAddContactOpen(false)}
                className="wa-icon-btn"
                style={{ width: 32, height: 32 }}
              >
                <X size={18} color="var(--wa-text-secondary)" />
              </button>
            </div>

            {/* Instagram Style Username Search Box */}
            <div className="wa-modal-search-box">
              <Search size={16} color="var(--wa-text-secondary)" />
              <input
                type="text"
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (modalSearchResults.length === 1) {
                      handleConnectWithGlobalUser(modalSearchResults[0]);
                    } else if (cleanModalQ && cleanModalQ.length >= 2) {
                      handleConnectWithGlobalUser({ username: cleanModalQ, name: cleanModalQ });
                    }
                  }
                }}
                placeholder="Search by @username or contact name..."
                className="wa-modal-search-input"
                autoFocus
              />
              {modalSearchQuery && (
                <button 
                  type="button" 
                  onClick={() => setModalSearchQuery('')}
                  style={{ background: 'none', border: 'none', color: 'var(--wa-text-secondary)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Live Search Results */}
            {modalSearchResults.length > 0 && (
              <div className="wa-modal-user-results">
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--wa-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Registered Users ({modalSearchResults.length})
                </div>
                {modalSearchResults.map((u) => (
                  <div key={u.id || u.username} className="wa-modal-user-item">
                    <div className="wa-avatar" style={{ width: 44, height: 44 }}>
                      <img src={u.avatar || AVATAR_PRESETS[0]} alt={u.name} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--wa-text-primary)' }}>{u.name}</div>
                      <div style={{ fontSize: '12.5px', color: 'var(--wa-green-light)', fontWeight: 500 }}>@{u.username}</div>
                      {u.about && (
                        <div style={{ fontSize: '12px', color: 'var(--wa-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.about}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="wa-global-user-chat-btn"
                      onClick={() => handleConnectWithGlobalUser(u)}
                    >
                      <MessageSquare size={14} />
                      <span>Chat</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Direct Connect Option for searched @username */}
            {cleanModalQ && cleanModalQ.length >= 2 && !modalSearchResults.some(u => u.username?.toLowerCase() === cleanModalQ) && (
              <div className="wa-modal-user-results" style={{ marginTop: modalSearchResults.length > 0 ? 10 : 0 }}>
                <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--wa-green-light)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} />
                  <span>Start Chat with @{cleanModalQ}</span>
                </div>
                <div className="wa-modal-user-item" style={{ border: '1.5px solid var(--wa-green)', backgroundColor: 'var(--wa-bg-panel-secondary)' }}>
                  <div className="wa-avatar" style={{ width: 44, height: 44 }}>
                    <img src={generateBitmojiAvatar(cleanModalQ, 'male')} alt={cleanModalQ} />
                    <div className="wa-avatar-badge" style={{ backgroundColor: 'var(--wa-green)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--wa-text-primary)' }}>@{cleanModalQ}</div>
                    <div style={{ fontSize: '12px', color: 'var(--wa-green-light)', fontWeight: 500 }}>
                      ⚡ Connect Live on Internet P2P
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--wa-text-secondary)' }}>
                      Press Enter or click Chat to begin conversation
                    </div>
                  </div>
                  <button
                    type="button"
                    className="wa-global-user-chat-btn"
                    onClick={() => handleConnectWithGlobalUser({ username: cleanModalQ, name: cleanModalQ })}
                    style={{ backgroundColor: 'var(--wa-green)', color: '#111b21', fontWeight: 600, padding: '8px 16px', borderRadius: 20 }}
                  >
                    <MessageSquare size={14} />
                    <span>Chat</span>
                  </button>
                </div>
              </div>
            )}

            {modalSearchQuery.trim() && !cleanModalQ && (
              <div style={{ textAlign: 'center', padding: '14px 8px', color: 'var(--wa-text-secondary)', fontSize: '13px' }}>
                Type at least 2 characters of @username to start a chat.
              </div>
            )}

            {/* Manual Form Header / Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 4px 0', borderTop: '1px solid var(--wa-border)', paddingTop: 10 }}>
              <span style={{ fontSize: '12px', color: 'var(--wa-text-muted)' }}>
                {isManualEntry ? 'Custom Contact Details' : "Can't find via @username?"}
              </span>
              <button
                type="button"
                onClick={() => setIsManualEntry(!isManualEntry)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--wa-green-light)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isManualEntry ? 'Hide form' : '+ Add custom contact'}
              </button>
            </div>

            {isManualEntry && (
              <form onSubmit={handleAddContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
                {/* Avatar Selection with Gender */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <div 
                    className="wa-avatar" 
                    style={{ width: 56, height: 56, border: '2px solid var(--wa-green)', boxShadow: 'var(--wa-shadow-md)' }}
                  >
                    <img src={newContactAvatar} alt="Contact Avatar" />
                  </div>

                  {/* Male / Female Segmented Pill for Contact */}
                  <div className="wa-gender-selector-group" style={{ width: '100%', maxWidth: 260 }}>
                    <button
                      type="button"
                      className={`wa-gender-btn ${newContactGender === 'female' ? 'active' : ''}`}
                      onClick={() => {
                        setNewContactGender('female');
                        setNewContactAvatar(GENDER_AVATARS.female[0]);
                      }}
                      style={{ height: 32, fontSize: '12px' }}
                    >
                      <span>👩 Female</span>
                    </button>
                    <button
                      type="button"
                      className={`wa-gender-btn ${newContactGender === 'male' ? 'active' : ''}`}
                      onClick={() => {
                        setNewContactGender('male');
                        setNewContactAvatar(GENDER_AVATARS.male[0]);
                      }}
                      style={{ height: 32, fontSize: '12px' }}
                    >
                      <span>👨 Male</span>
                    </button>
                  </div>

                  <span style={{ fontSize: '11.5px', color: 'var(--wa-text-muted)' }}>
                    Pick {newContactGender === 'female' ? 'Female' : 'Male'} Bitmoji:
                  </span>
                  <div className="wa-avatar-picker-chips" style={{ marginBottom: 0 }}>
                    {(GENDER_AVATARS[newContactGender] || AVATAR_PRESETS).map((p, idx) => (
                      <div
                        key={idx}
                        className={`wa-avatar-chip ${newContactAvatar === p ? 'selected' : ''}`}
                        onClick={() => setNewContactAvatar(p)}
                        style={{ width: 34, height: 34 }}
                        title={`Bitmoji ${idx + 1}`}
                      >
                        <img src={p} alt={`Avatar ${idx}`} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Name Field */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--wa-green-light)', display: 'block', marginBottom: 4 }}>
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter name (e.g. Rahul, Priya)"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="wa-phone-number-field"
                    style={{ width: '100%', height: 40, fontSize: '14px' }}
                  />
                </div>

                {/* Username Field */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--wa-green-light)', display: 'block', marginBottom: 4 }}>
                    @Username (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. rahul_99"
                    value={newContactUsername}
                    onChange={(e) => setNewContactUsername(e.target.value)}
                    className="wa-phone-number-field"
                    style={{ width: '100%', height: 40, fontSize: '14px' }}
                  />
                </div>

                {/* Phone or Email Field */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--wa-green-light)', display: 'block', marginBottom: 4 }}>
                    Phone Number or Email (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +91 98765 43210 or user@gmail.com"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="wa-phone-number-field"
                    style={{ width: '100%', height: 40, fontSize: '14px' }}
                  />
                </div>

                {/* About / Bio Status */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--wa-green-light)', display: 'block', marginBottom: 4 }}>
                    About / Status
                  </label>
                  <input
                    type="text"
                    placeholder="Status (e.g. Available, Busy)"
                    value={newContactAbout}
                    onChange={(e) => setNewContactAbout(e.target.value)}
                    className="wa-phone-number-field"
                    style={{ width: '100%', height: 40, fontSize: '14px' }}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => setIsAddContactOpen(false)}
                    style={{
                      flex: 1,
                      height: 40,
                      borderRadius: 8,
                      border: '1px solid var(--wa-border)',
                      backgroundColor: 'var(--wa-bg-input)',
                      color: 'var(--wa-text-primary)',
                      fontSize: '13.5px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newContactName.trim()}
                    className="wa-login-cta-btn"
                    style={{ flex: 1, height: 40, marginTop: 0 }}
                  >
                    <Check size={16} />
                    <span>Start Chat</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </aside>
  );
}
