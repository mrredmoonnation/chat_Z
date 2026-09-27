import React, { useRef, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  Phone, Video, Search, MoreVertical, Check, CheckCheck,
  Lock, ArrowLeft, Play, Pause, FileText, Download, X, Eye,
  ChevronUp, ChevronDown, Sparkles, MapPin, ExternalLink, Trash2, Copy, Bot, RotateCw,
  Info, ShieldAlert, ShieldCheck, User, Palette
} from 'lucide-react';
import ChatInput from './ChatInput';
import ContactDetailModal from '../Contact/ContactDetailModal';
import WallpaperModal from './WallpaperModal';
import { sounds } from '../../services/audioEffects';
import { GENDER_AVATARS, cleanUsername } from '../../services/store';

export default function ChatArea({
  activeContact,
  currentUser,
  partnerOnlineStatus = 'connected',
  isBlocked = false,
  onToggleBlock,
  onBack,
  onStartCall,
  onRefreshChat,
  onSendMessage,
  onClearChat,
  onDeleteMessage,
  onDeleteChat,
  onUpdateChatWallpaper
}) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatAreaRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [previewImage, setPreviewImage] = useState(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [optionsMenuPos, setOptionsMenuPos] = useState({ top: 0, right: 0 });
  const optionsMenuBtnRef = React.useRef(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [partnerReaction, setPartnerReaction] = useState(null);
  const [activeBubbleMenuId, setActiveBubbleMenuId] = useState(null);
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [localWallpaper, setLocalWallpaper] = useState(activeContact?.wallpaper || null);

  useEffect(() => {
    setLocalWallpaper(activeContact?.wallpaper || null);
  }, [activeContact?.id, activeContact?.wallpaper]);

  // Close bubble menu and options menu on outside pointerdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.wa-bubble-menu-popover') && !e.target.closest('.wa-bubble-menu-trigger')) {
        setActiveBubbleMenuId(null);
      }
      if (!e.target.closest('.wa-chat-header-actions') && !e.target.closest('.wa-chat-options-portal')) {
        setShowOptionsMenu(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  const handlePartnerBitmojiClick = () => {
    sounds.playMessageReceived?.();
    const emojis = ['❤️', '👋', '✨', '🔥', '🥰', '👀'];
    const chosen = emojis[Math.floor(Math.random() * emojis.length)];
    setPartnerReaction(chosen);
    setTimeout(() => setPartnerReaction(null), 1200);
  };

  // In-Chat Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const inChatSearchInputRef = useRef(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inChatSearchInputRef.current?.focus(), 80);
    } else {
      setInChatSearchQuery('');
    }
  }, [isSearchOpen]);

  // Reset search when active contact changes
  useEffect(() => {
    setIsSearchOpen(false);
    setInChatSearchQuery('');
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = 0;
    }
  }, [activeContact?.id]);

  // Global Ctrl+F shortcut to open in-chat search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Deduplicate and filter active contact messages for clean, single-bubble rendering
  const renderedMessages = React.useMemo(() => {
    if (!activeContact?.messages || !Array.isArray(activeContact.messages)) return [];
    const seenIds = new Set();
    const seenSignatures = new Set();
    const unique = [];

    for (const msg of activeContact.messages) {
      if (!msg) continue;
      const msgId = msg.id || msg.clientMsgId;
      if (msgId && seenIds.has(msgId)) continue;

      // Group nearby identical messages (sent within 4 seconds) to eliminate duplicate bubbles
      const body = msg.text || msg.caption || msg.url || msg.fileUrl || msg.fileName || '';
      const timeBucket = Math.floor((msg.timestamp || 0) / 4000);
      const sig = `${msg.senderId || msg.senderUsername || ''}_${body}_${timeBucket}`;
      if (body && seenSignatures.has(sig)) continue;

      if (msgId) seenIds.add(msgId);
      if (body) seenSignatures.add(sig);
      unique.push(msg);
    }
    return unique;
  }, [activeContact?.messages]);

  // Compute matching message IDs in current chat
  const matchingMsgIds = React.useMemo(() => {
    const q = inChatSearchQuery.trim().toLowerCase();
    if (!q || !renderedMessages.length) return [];
    return renderedMessages
      .filter(
        (m) =>
          (m.text && m.text.toLowerCase().includes(q)) ||
          (m.fileName && m.fileName.toLowerCase().includes(q))
      )
      .map((m) => m.id);
  }, [inChatSearchQuery, renderedMessages]);

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [inChatSearchQuery]);

  // Scroll to currently active matched message (scoped to messages container only)
  useEffect(() => {
    if (matchingMsgIds.length > 0 && matchingMsgIds[currentMatchIndex]) {
      const activeEl = document.getElementById(`msg_${matchingMsgIds[currentMatchIndex]}`);
      if (activeEl && messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        const targetTop = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
        container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
    }
  }, [currentMatchIndex, matchingMsgIds]);

  const goToNextMatch = () => {
    if (matchingMsgIds.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matchingMsgIds.length);
  };

  const goToPrevMatch = () => {
    if (matchingMsgIds.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matchingMsgIds.length) % matchingMsgIds.length);
  };

  // Highlight matching text in chat messages
  const highlightInChat = (text, query) => {
    if (!query || !query.trim() || !text) return text;
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

  // Auto-scroll to bottom when messages change or when partner starts typing (scoped to container only)
  useEffect(() => {
    if (!isSearchOpen && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [activeContact?.messages, activeContact?.isTyping, isSearchOpen]);

  if (!activeContact) {
    return (
      <div className="wa-splash-empty">
        <div className="wa-splash-card">
          <div className="wa-splash-icon">
            <img
              src="/baat_chit_logo.jpg"
              alt="baat chit Logo"
              style={{ width: 56, height: 56, borderRadius: 16, objectFit: 'cover', border: '1px solid rgba(74, 222, 128, 0.35)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
            />
          </div>
          <h2 className="wa-splash-title">baat chit</h2>
          <p className="wa-splash-desc">
            Ultra-private, smoked titanium glass messaging. Select a conversation from the sidebar or tap + to start chatting in real time.
          </p>
          <div className="wa-splash-encryption">
            <Lock size={13} color="#4ade80" />
            <span>End-to-End Encrypted & Verified</span>
          </div>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>from</span>
            <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '2.5px', color: '#4ade80', textShadow: '0 0 10px rgba(74, 222, 128, 0.4)' }}>SONU SAHANI</span>
          </div>
        </div>
      </div>
    );
  }

  const toggleVoicePlay = (msgId) => {
    if (playingVoiceId === msgId) {
      setPlayingVoiceId(null);
    } else {
      setPlayingVoiceId(msgId);
      // Simulate voice playback end after 4 seconds
      setTimeout(() => {
        setPlayingVoiceId(null);
      }, 4000);
    }
  };

  const cycleSpeed = () => {
    if (voiceSpeed === 1) setVoiceSpeed(1.5);
    else if (voiceSpeed === 1.5) setVoiceSpeed(2);
    else setVoiceSpeed(1);
  };

  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (onRefreshChat) {
        await onRefreshChat(activeContact);
      }
    } catch (err) {
      console.warn('Manual refresh notice:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 650);
    }
  };

  // Wallpaper background calculation (instant local reaction + persistent prop sync)
  const currentWp = localWallpaper || activeContact?.wallpaper;
  const hasCustomWallpaper = Boolean(currentWp && currentWp.id !== 'default');
  const customWallpaperBg = currentWp?.url
    ? `url("${currentWp.url}")`
    : (currentWp?.css || currentWp?.preview || undefined);

  const displayHandle = activeContact?.username || 
    (activeContact?.id?.startsWith('wa_user_') ? activeContact.id.replace('wa_user_', '') : null) ||
    (activeContact?.id?.startsWith('user_') ? activeContact.id.replace('user_', '') : null) ||
    cleanUsername(activeContact?.name);

  return (
    <div className="wa-chat-area" ref={chatAreaRef} style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Living Moving Video Wallpaper (Gen-Z Undulating Liquid Metallic Silk + Glowing Neon Mesh) */}
      <div className="wa-login-moving-bg wa-chat-moving-bg" aria-hidden="true">
        <div className="wa-liquid-video-layer" />
        <div className="wa-liquid-orb orb-1" />
        <div className="wa-liquid-orb orb-2" />
        <div className="wa-liquid-grid-overlay" />
      </div>

      {/* Subtle Liquid Ambient Wallpaper */}
      <div className="wa-doodle-bg" />

      {/* Custom Per-Chat Wallpaper Layer (Instagram style, scoped to this chat) */}
      <div
        className="wa-custom-wallpaper-layer"
        style={{
          position: 'absolute',
          inset: 0,
          background: customWallpaperBg
            ? (customWallpaperBg.startsWith('url') ? `${customWallpaperBg} center / cover no-repeat` : customWallpaperBg)
            : 'transparent',
          opacity: hasCustomWallpaper ? 1 : 0,
          transition: 'opacity 0.3s ease, background 0.3s ease',
          pointerEvents: 'none',
          zIndex: 1
        }}
      >
        {hasCustomWallpaper && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: currentWp?.type === 'custom_image' ? 'rgba(5, 8, 14, 0.42)' : 'rgba(5, 8, 14, 0.22)',
              backdropFilter: 'blur(0.5px)'
            }}
          />
        )}
      </div>

      {/* Floating Pill Chat Header (Matching Photo 3) */}
      <div className="wa-chat-header wa-chat-header-floating-pill">
        <div
          className="wa-chat-header-user clickable"
          onClick={() => setIsProfileModalOpen(true)}
          title="Click to view Contact Profile, User ID & Options"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}
        >
          <button
            type="button"
            className="wa-back-btn wa-pill-back-btn"
            onClick={(e) => {
              e.stopPropagation();
              onBack && onBack();
            }}
            title="Back to all chats"
            aria-label="Back to all chats"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="wa-avatar" style={{ width: 38, height: 38, flexShrink: 0 }}>
            <img src={activeContact.avatar} alt={activeContact.name} />
            {activeContact.isOnline && <div className="wa-avatar-badge" />}
          </div>

          <div className="wa-chat-header-meta" style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <div className="wa-chat-header-title" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
              <span className="wa-chat-header-contact-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700, fontSize: 15, color: '#ffffff', minWidth: 0, flexShrink: 1 }}>{activeContact.name}</span>
              {activeContact.isCommunity ? (
                <span className="wa-community-pill">💡 Community</span>
              ) : displayHandle ? (
                <span className="wa-chat-header-username">@{displayHandle}</span>
              ) : null}
              {activeContact.isCommunity && (cleanUsername(currentUser?.username) === 'sonusahani96122') && (
                <span className="wa-admin-badge">👑 Admin (You)</span>
              )}
            </div>
            <div className={`wa-chat-header-status ${activeContact.isTyping ? 'typing' : activeContact.isOnline ? 'online' : ''}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, color: '#4ade80' }}>
              {activeContact.isCommunity
                ? 'Public Tech Discussion • Ideas & Support'
                : activeContact.isTyping
                  ? 'typing...'
                  : activeContact.isOnline
                    ? 'online'
                    : activeContact.lastSeen || 'last seen recently'}
            </div>
          </div>
        </div>

        <div className="wa-chat-header-actions wa-pill-header-actions">
          {!activeContact.isCommunity && (
            <>
              <button
                id="startVideoCallBtn"
                className="wa-pill-action-btn"
                onClick={() => onStartCall && onStartCall(activeContact, true)}
                title="Video Call"
              >
                <Video size={19} />
              </button>

              <button
                id="startAudioCallBtn"
                className="wa-pill-action-btn"
                onClick={() => onStartCall && onStartCall(activeContact, false)}
                title="Voice Call"
              >
                <Phone size={19} />
              </button>
            </>
          )}

          {/* Real-time Refresh & Sync Button */}
          <button
            id="refreshChatBtn"
            type="button"
            className={`wa-pill-action-btn wa-desktop-only-action ${isRefreshing ? 'refreshing' : ''}`}
            onClick={handleManualRefresh}
            title="Refresh & Sync Messages"
            aria-label="Refresh & Sync Messages"
          >
            <RotateCw size={18} className={isRefreshing ? 'wa-spin-anim' : ''} />
          </button>

          <button
            type="button"
            className={`wa-pill-action-btn wa-desktop-only-action ${isSearchOpen ? 'active' : ''}`}
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            title="Search in Chat (Ctrl+F)"
            aria-label="Search in Chat"
          >
            <Search size={18} />
          </button>

          <div style={{ position: 'relative', zIndex: 1100 }}>
            <button
              ref={optionsMenuBtnRef}
              className="wa-pill-action-btn"
              onClick={() => {
                if (!showOptionsMenu && optionsMenuBtnRef.current) {
                  const rect = optionsMenuBtnRef.current.getBoundingClientRect();
                  setOptionsMenuPos({
                    top: Math.min(rect.bottom + 8, window.innerHeight - 310),
                    right: Math.max(8, window.innerWidth - rect.right)
                  });
                }
                setShowOptionsMenu(!showOptionsMenu);
              }}
              title="More Options"
            >
              <MoreVertical size={19} />
            </button>

            {showOptionsMenu && ReactDOM.createPortal(
              <div
                className="wa-chat-options-portal"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  top: optionsMenuPos.top,
                  right: optionsMenuPos.right,
                  backgroundColor: 'rgba(16, 23, 34, 0.96)',
                  backdropFilter: 'blur(32px) saturate(200%)',
                  WebkitBackdropFilter: 'blur(32px) saturate(200%)',
                  borderRadius: 16,
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(255, 255, 255, 0.16)',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  width: 210,
                  zIndex: 2147483647,
                  overflow: 'hidden',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2
                }}
              >
                {/* 1. Contact info */}
                <button
                  type="button"
                  className="wa-menu-dropdown-item"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setIsProfileModalOpen(true);
                  }}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '10px 14px',
                    fontSize: 13.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 10,
                    color: '#f1f5f9',
                    textAlign: 'left'
                  }}
                >
                  <User size={16} color="var(--wa-text-secondary)" />
                  <span style={{ fontWeight: 500 }}>Contact info</span>
                </button>

                {/* Search in chat option */}
                <button
                  type="button"
                  className="wa-menu-dropdown-item"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setIsSearchOpen(true);
                  }}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '10px 14px',
                    fontSize: 13.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 10,
                    color: '#f1f5f9',
                    textAlign: 'left'
                  }}
                >
                  <Search size={16} color="var(--wa-text-secondary)" />
                  <span style={{ fontWeight: 500 }}>Search in chat</span>
                </button>

                {/* Refresh messages option */}
                <button
                  type="button"
                  className="wa-menu-dropdown-item"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    handleManualRefresh();
                  }}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '10px 14px',
                    fontSize: 13.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 10,
                    color: '#f1f5f9',
                    textAlign: 'left'
                  }}
                >
                  <RotateCw size={16} color="var(--wa-text-secondary)" />
                  <span style={{ fontWeight: 500 }}>Refresh messages</span>
                </button>

                {/* 2. Chat Wallpaper */}
                <button
                  type="button"
                  id="chatWallpaperOptionBtn"
                  className="wa-menu-dropdown-item"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setShowWallpaperModal(true);
                  }}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '10px 14px',
                    fontSize: 13.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 10,
                    color: '#4ade80',
                    textAlign: 'left'
                  }}
                >
                  <Palette size={16} />
                  <span style={{ fontWeight: 500 }}>Chat Wallpaper</span>
                </button>

                {/* 3. Block / Unblock contact */}
                <button
                  type="button"
                  className="wa-menu-dropdown-item"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    onToggleBlock && onToggleBlock(activeContact);
                  }}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '10px 14px',
                    fontSize: 13.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 10,
                    color: isBlocked ? '#00a884' : 'var(--wa-danger)',
                    textAlign: 'left'
                  }}
                >
                  {isBlocked ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                  <span style={{ fontWeight: 500 }}>{isBlocked ? 'Unblock contact' : 'Block contact'}</span>
                </button>

                {/* 4. Clear Messages */}
                <button
                  type="button"
                  className="wa-menu-dropdown-item"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setShowClearChatConfirm(true);
                  }}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '10px 14px',
                    fontSize: 13.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 10,
                    color: '#f1f5f9',
                    textAlign: 'left'
                  }}
                >
                  <Sparkles size={16} color="var(--wa-text-secondary)" />
                  <span style={{ fontWeight: 500 }}>Clear Messages</span>
                </button>

                {/* 5. Delete Chat */}
                <button
                  type="button"
                  className="wa-menu-dropdown-item"
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setShowDeleteChatConfirm(true);
                  }}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '10px 14px',
                    fontSize: 13.5,
                    cursor: 'pointer',
                    color: 'var(--wa-danger)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 10,
                    textAlign: 'left'
                  }}
                >
                  <Trash2 size={16} />
                  <span style={{ fontWeight: 500 }}>Delete Chat</span>
                </button>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* In-Chat Interactive Search Bar */}
      {isSearchOpen && (
        <div className="wa-inchat-search-bar">
          <div className="wa-inchat-search-input-box">
            <Search size={16} className="wa-inchat-search-icon" />
            <input
              ref={inChatSearchInputRef}
              type="text"
              placeholder="Search messages in this chat..."
              value={inChatSearchQuery}
              onChange={(e) => setInChatSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) goToPrevMatch();
                  else goToNextMatch();
                } else if (e.key === 'Escape') {
                  setIsSearchOpen(false);
                }
              }}
            />
            {inChatSearchQuery && (
              <button
                type="button"
                className="wa-inchat-icon-btn"
                onClick={() => setInChatSearchQuery('')}
                title="Clear text"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {inChatSearchQuery.trim() && (
            <div className="wa-inchat-search-controls">
              <span className="wa-inchat-count">
                {matchingMsgIds.length > 0
                  ? `${currentMatchIndex + 1} of ${matchingMsgIds.length}`
                  : '0 of 0'}
              </span>
              {matchingMsgIds.length > 0 && (
                <>
                  <button
                    type="button"
                    className="wa-inchat-nav-arrow"
                    onClick={goToPrevMatch}
                    title="Previous match (Shift + Enter)"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    className="wa-inchat-nav-arrow"
                    onClick={goToNextMatch}
                    title="Next match (Enter)"
                  >
                    <ChevronDown size={16} />
                  </button>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            className="wa-inchat-close-btn"
            onClick={() => {
              setIsSearchOpen(false);
              setInChatSearchQuery('');
            }}
            title="Close search (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Blocked Contact Warning Banner */}
      {isBlocked && (
        <div
          className="wa-glass-blocked-banner"
          onClick={() => onToggleBlock && onToggleBlock(activeContact)}
          title="Click to unblock this contact"
        >
          <ShieldAlert size={16} />
          <span>You blocked this contact. Tap here to unblock.</span>
          <button type="button" className="wa-glass-unblock-badge">Unblock</button>
        </div>
      )}

      {/* Messages Scroll View */}
      <div className="wa-messages-container" ref={messagesContainerRef}>
        {/* End-to-End Encryption Notice */}
        <div className="wa-system-notice">
          <Lock size={12} />
          <span>Messages and calls are end-to-end encrypted. No one outside of this chat can read or listen to them.</span>
        </div>

        <div className="wa-date-divider">Today</div>

        {/* Tech Community Guidelines & Privacy Banner */}
        {activeContact.isCommunity && (
          <div className="wa-community-guidelines-card">
            <div className="wa-community-guidelines-header">
              <span style={{ fontSize: 18 }}>💡</span>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: '#4ade80' }}>
                Tech Community Discussion Rules
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255, 255, 255, 0.9)' }}>
              Is group mein wahi log message karein jinko koi <strong>dikkat/issue</strong> hai ya <strong>naye features / ideas</strong> discuss karna chahte hain. Yeh group open discussion ke liye hai.
            </p>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: 'rgba(255, 255, 255, 0.65)' }}>
              <span>🔒 Privacy Active: User ID hidden (Sirf Naam dikhega)</span>
              <span style={{ color: '#facc15', fontWeight: 600 }}>👑 Admin: Sonu Sahani</span>
            </div>
          </div>
        )}

        {renderedMessages.map((msg, index) => {
          const myUid = currentUser?.uid || currentUser?.id;
          const myUsername = currentUser?.username ? currentUser.username.toLowerCase() : '';
          const msgSenderId = String(msg.senderId || '');
          const msgSenderUsername = String(msg.senderUsername || '').toLowerCase();

          const isOutgoing =
            Boolean(msg.isOutgoing) ||
            msgSenderId === 'user' ||
            (myUid && (
              msgSenderId === myUid || 
              msgSenderId === `user_${myUid}` || 
              msg.senderUid === myUid ||
              msg.senderUid === `user_${myUid}` ||
              (myUsername && msgSenderId === `admin_${myUsername}`)
            )) ||
            (myUsername && (
              msgSenderId === myUsername ||
              msgSenderId === `wa_user_${myUsername}` ||
              msgSenderId === `admin_${myUsername}` ||
              msgSenderUsername === myUsername
            ));
          const isCurrentMatch = matchingMsgIds[currentMatchIndex] === msg.id;
          const isMatch = matchingMsgIds.includes(msg.id);

          // Instagram-style system announcement bubble (e.g., "Sonu changed the chat wallpaper to ...")
          if (msg.type === 'system') {
            return (
              <div key={`${msg.id}_${index}`} className="wa-system-message-row" style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                <div
                  className="wa-system-notice"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'rgba(255, 255, 255, 0.85)',
                    padding: '5px 16px',
                    borderRadius: 9999,
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Sparkles size={13} color="#4ade80" />
                  <span>{msg.text}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`${msg.id}_${index}`}
              id={`msg_${msg.id}`}
              className={`wa-bubble-row ${isOutgoing ? 'outgoing' : 'incoming'}`}
            >
              <div
                className={`wa-bubble ${isOutgoing ? 'outgoing' : 'incoming'} ${isCurrentMatch ? 'search-match-active' : isMatch ? 'search-match' : ''
                  }`}
              >
                {/* Group or Community sender name with Privacy & Admin Badge */}
                {(activeContact.isGroup || activeContact.isCommunity) && !isOutgoing && msg.senderName && (
                  <div className="wa-bubble-sender-name" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span>{msg.senderName}</span>
                    {(msg.isAdmin || msg.senderUsername === 'sonusahani96122' || msg.senderId?.includes('sonusahani96122')) && (
                      <span className="wa-admin-badge">👑 Admin</span>
                    )}
                  </div>
                )}

                {/* Community Outgoing Admin Badge */}
                {activeContact.isCommunity && isOutgoing && (cleanUsername(currentUser?.username) === 'sonusahani96122') && (
                  <div className="wa-bubble-sender-name" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, color: '#4ade80' }}>
                    <span>You</span>
                    <span className="wa-admin-badge">👑 Admin</span>
                  </div>
                )}

                {/* Text Message */}
                {msg.text && (
                  <div className="wa-bubble-text">
                    {highlightInChat(msg.text, inChatSearchQuery)}
                  </div>
                )}

                {/* Image Message */}
                {msg.type === 'image' && (msg.url || msg.fileUrl || msg.mediaUrl) && (
                  <div
                    className="wa-bubble-image"
                    onClick={() => setPreviewImage(msg.url || msg.fileUrl || msg.mediaUrl)}
                  >
                    <img
                      src={msg.url || msg.fileUrl || msg.mediaUrl}
                      alt={msg.caption || "Shared"}
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    {msg.caption && (
                      <div className="wa-bubble-text" style={{ paddingTop: 4 }}>
                        {highlightInChat(msg.caption, inChatSearchQuery)}
                      </div>
                    )}
                  </div>
                )}

                {/* Document Message */}
                {msg.type === 'document' && (
                  <div className="wa-bubble-doc">
                    <FileText size={28} className="wa-doc-icon" />
                    <div className="wa-doc-meta">
                      <div className="wa-doc-name">
                        {highlightInChat(msg.fileName || 'Document.pdf', inChatSearchQuery)}
                      </div>
                      <div className="wa-doc-size">{msg.fileSize || '1.2 MB'} • PDF</div>
                    </div>
                    <Download size={18} color="var(--wa-text-secondary)" />
                  </div>
                )}

                {/* Voice Note Message */}
                {msg.type === 'voice' && (
                  <div className="wa-bubble-voice">
                    <button
                      className="wa-voice-play-btn"
                      onClick={() => toggleVoicePlay(msg.id)}
                    >
                      {playingVoiceId === msg.id ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                    </button>

                    <div className="wa-voice-waveform">
                      {[14, 22, 10, 26, 18, 28, 16, 22, 12, 24, 18, 20, 14, 26, 12].map((h, i) => (
                        <div
                          key={i}
                          className={`wa-waveform-bar ${playingVoiceId === msg.id ? 'played' : ''}`}
                          style={{
                            height: playingVoiceId === msg.id ? `${(h * 1.3) % 28 + 6}px` : `${h}px`
                          }}
                        />
                      ))}
                    </div>

                    <button
                      className="wa-voice-speed-pill"
                      onClick={cycleSpeed}
                      title="Audio Speed"
                    >
                      {voiceSpeed}x
                    </button>
                  </div>
                )}

                {/* Live Location Message */}
                {msg.type === 'location' && (
                  <div className="wa-bubble-location">
                    <div className="wa-location-card">
                      <div className="wa-location-header">
                        <div className="wa-location-icon-wrapper">
                          <MapPin size={22} color="#ffffff" fill="#ea4335" />
                          <div className="wa-location-ping" />
                        </div>
                        <div className="wa-location-text-col">
                          <div className="wa-location-title">Live Location</div>
                          <div className="wa-location-coords">
                            {msg.latitude ? `${msg.latitude.toFixed(4)}, ${msg.longitude.toFixed(4)}` : 'Shared GPS'}
                          </div>
                        </div>
                      </div>
                      {msg.accuracy && (
                        <div className="wa-location-accuracy">
                          Accurate to ~{msg.accuracy} meters
                        </div>
                      )}
                      <a
                        href={msg.mapUrl || `https://www.google.com/maps?q=${msg.latitude},${msg.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wa-location-map-btn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Open in Google Maps</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                )}

                {/* Footer: Time and Read ticks + Message Menu Trigger */}
                <div className="wa-bubble-footer">
                  <span className="wa-bubble-time">{msg.time || '10:30 PM'}</span>
                  {isOutgoing && (
                    <span
                      className={`wa-bubble-ticks ${msg.status === 'read' ? 'blue' : 'grey'}`}
                      title={msg.status === 'read' ? 'Read (Double Blue Tick)' : msg.status === 'delivered' ? 'Delivered (Double Grey Tick)' : 'Sent (Single Grey Tick)'}
                    >
                      {msg.status === 'sent' ? (
                        <Check size={14} className="wa-tick-icon single" />
                      ) : (
                        <CheckCheck size={15} className={`wa-tick-icon double ${msg.status === 'read' ? 'blue' : ''}`} />
                      )}
                    </span>
                  )}

                  {/* Dropdown Menu for Single Message Delete / Copy */}
                  <div className="wa-bubble-menu-wrapper">
                    <button
                      type="button"
                      className="wa-bubble-menu-trigger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveBubbleMenuId(activeBubbleMenuId === msg.id ? null : msg.id);
                      }}
                      title="Message options"
                    >
                      <ChevronDown size={14} />
                    </button>

                    {activeBubbleMenuId === msg.id && (
                      <div className="wa-bubble-menu-popover">
                        {(msg.text || msg.caption || msg.type === 'location') && (
                          <div
                            className="wa-bubble-menu-item"
                            onClick={() => {
                              const copyContent = msg.text || msg.caption || msg.mapUrl || `${msg.latitude},${msg.longitude}`;
                              navigator.clipboard?.writeText(copyContent);
                              setCopiedMsgId(msg.id);
                              setTimeout(() => setCopiedMsgId(null), 1500);
                              setActiveBubbleMenuId(null);
                            }}
                          >
                            <Copy size={13} />
                            <span>{copiedMsgId === msg.id ? 'Copied!' : 'Copy'}</span>
                          </div>
                        )}
                        <div
                          className="wa-bubble-menu-item delete"
                          onClick={() => {
                            setActiveBubbleMenuId(null);
                            setMessageToDelete(msg);
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Dynamic bottom spacer: Expands when partner is typing to push messages completely above the peeking emoji */}
        <div
          className="wa-chat-bottom-spacer"
          style={{
            height: activeContact?.isTyping ? '85px' : '10px',
            transition: 'height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar & Snapchat Live Peeker Stage Wrapper */}
      <div className="wa-chat-input-wrapper">
        {/* Snapchat-Style Live Bitmoji Presence: Positioned right above the input bar */}
        {(() => {
          const isPartnerTyping = Boolean(activeContact?.isTyping);
          const partnerBitmoji = activeContact?.avatar || (activeContact?.gender === 'female' ? GENDER_AVATARS.female[0] : GENDER_AVATARS.male[0]);

          return (
            <div className="wa-snap-live-stage">
              {/* Partner's Peeking Bitmoji: Ducks into typing box when idle, pops up when typing */}
              <div
                className={`wa-snap-peeker partner ${isPartnerTyping ? 'is-peeking' : 'is-tucked'}`}
                title={isPartnerTyping ? `${activeContact?.name || 'Friend'} is typing...` : ''}
                onClick={handlePartnerBitmojiClick}
              >
                {/* Snapchat Iconic Thinking Bubble (Thought Cloud) */}
                {isPartnerTyping && (
                  <div className="wa-snap-thought-bubble partner-thought" aria-label="Thinking / Typing">
                    <div className="wa-snap-thought-content">
                      <span className="wa-snap-thought-emoji">🤔</span>
                      <div className="wa-snap-dots-wave">
                        <span className="wa-snap-dot" />
                        <span className="wa-snap-dot" />
                        <span className="wa-snap-dot" />
                      </div>
                      <span className="wa-snap-thought-text">typing...</span>
                    </div>
                    <span className="wa-snap-trail-dot big" />
                    <span className="wa-snap-trail-dot small" />
                  </div>
                )}

                {/* Reaction Pop Burst */}
                {partnerReaction && (
                  <div className="wa-snap-reaction-burst">
                    <span>{partnerReaction}</span>
                  </div>
                )}

                {/* Bitmoji Character Head */}
                <div className="wa-snap-avatar-ring">
                  <img
                    src={partnerBitmoji}
                    alt={activeContact?.name || 'Partner'}
                    className="wa-snap-bitmoji-img"
                  />
                  <span className="wa-snap-pulse-beacon" />
                </div>

                {/* Minimalist Floating Name Tag */}
                <div className="wa-snap-nametag">
                  <span className="wa-snap-live-dot" />
                  <span className="wa-snap-nametag-text">{activeContact?.name || 'Friend'}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Input Bar */}
        <ChatInput
          onSendMessage={onSendMessage}
          isBlocked={isBlocked}
          onUnblock={() => onToggleBlock && onToggleBlock(activeContact)}
          onTyping={(isTyping) => {
            if (typeof onSendMessage?.onTyping === 'function') {
              onSendMessage.onTyping(isTyping);
            }
          }}
        />
      </div>

      {/* Lightbox Image Preview */}
      {previewImage && (
        <div
          className="wa-modal-backdrop"
          onClick={() => setPreviewImage(null)}
          style={{ zIndex: 10000 }}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              onClick={() => setPreviewImage(null)}
              style={{
                position: 'absolute',
                top: -40,
                right: 0,
                color: '#ffffff'
              }}
            >
              <X size={28} />
            </button>
            <img
              src={previewImage}
              alt="Enlarged"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: 8, objectFit: 'contain' }}
            />
          </div>
        </div>
      )}

      {/* Delete Single Message Confirmation Modal */}
      {messageToDelete && (
        <div className="wa-modal-backdrop" onClick={() => setMessageToDelete(null)}>
          <div className="wa-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="wa-confirm-title">Delete message?</div>
            <div className="wa-confirm-text">
              Are you sure you want to delete this message? This action cannot be undone.
            </div>
            <div className="wa-confirm-actions">
              <button
                type="button"
                className="wa-confirm-btn cancel"
                onClick={() => setMessageToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wa-confirm-btn danger"
                onClick={() => {
                  onDeleteMessage && onDeleteMessage(activeContact.id, messageToDelete.id);
                  setMessageToDelete(null);
                }}
              >
                Delete for Me
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat Confirmation Modal */}
      {showClearChatConfirm && (
        <div className="wa-modal-backdrop" onClick={() => setShowClearChatConfirm(false)}>
          <div className="wa-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="wa-confirm-title">Clear this chat?</div>
            <div className="wa-confirm-text">
              Messages will be cleared from this conversation.
            </div>
            <div className="wa-confirm-actions">
              <button
                type="button"
                className="wa-confirm-btn cancel"
                onClick={() => setShowClearChatConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wa-confirm-btn danger"
                onClick={() => {
                  onClearChat && onClearChat(activeContact.id);
                  setShowClearChatConfirm(false);
                }}
              >
                Clear Messages
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Entire Chat Confirmation Modal */}
      {showDeleteChatConfirm && (
        <div className="wa-modal-backdrop" onClick={() => setShowDeleteChatConfirm(false)}>
          <div className="wa-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="wa-confirm-title">Delete this chat?</div>
            <div className="wa-confirm-text">
              All messages and this conversation with <strong>{activeContact.name}</strong> will be permanently removed.
            </div>
            <div className="wa-confirm-actions">
              <button
                type="button"
                className="wa-confirm-btn cancel"
                onClick={() => setShowDeleteChatConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wa-confirm-btn danger"
                onClick={() => {
                  onDeleteChat && onDeleteChat(activeContact.id);
                  setShowDeleteChatConfirm(false);
                }}
              >
                Delete Chat
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Apple iOS 18 Glass Contact Detail Sheet */}
      <ContactDetailModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        contact={activeContact}
        isBlocked={isBlocked}
        onToggleBlock={onToggleBlock}
        onStartCall={onStartCall}
        onClearChat={onClearChat}
        onDeleteChat={onDeleteChat}
      />

      {/* Instagram-style Per-Chat Wallpaper & Theme Modal */}
      <WallpaperModal
        isOpen={showWallpaperModal}
        onClose={() => setShowWallpaperModal(false)}
        currentWallpaper={currentWp}
        onSaveWallpaper={(newWallpaper) => {
          setLocalWallpaper(newWallpaper);
          if (onUpdateChatWallpaper && activeContact?.id) {
            onUpdateChatWallpaper(activeContact.id, newWallpaper);
          }
        }}
        contactName={activeContact?.name || activeContact?.username}
      />
    </div>
  );
}
