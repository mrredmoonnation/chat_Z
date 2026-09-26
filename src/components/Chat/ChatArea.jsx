import React, { useRef, useEffect, useState } from 'react';
import { 
  Phone, Video, Search, MoreVertical, Check, CheckCheck, 
  Lock, ArrowLeft, Play, Pause, FileText, Download, X, Eye,
  ChevronUp, ChevronDown, Sparkles, MapPin, ExternalLink, Trash2, Copy, Bot, RotateCw,
  Info, ShieldAlert, ShieldCheck, User
} from 'lucide-react';
import ChatInput from './ChatInput';
import ContactDetailModal from '../Contact/ContactDetailModal';
import { sounds } from '../../services/audioEffects';
import { GENDER_AVATARS } from '../../services/store';

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
  onDeleteChat
}) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const chatAreaRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [previewImage, setPreviewImage] = useState(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [partnerReaction, setPartnerReaction] = useState(null);
  const [activeBubbleMenuId, setActiveBubbleMenuId] = useState(null);
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [copiedMsgId, setCopiedMsgId] = useState(null);

  // Close bubble menu and options menu on outside pointerdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.wa-bubble-menu-popover') && !e.target.closest('.wa-bubble-menu-trigger')) {
        setActiveBubbleMenuId(null);
      }
      if (!e.target.closest('.wa-chat-header-actions')) {
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
        <div className="wa-splash-icon" style={{ width: 88, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
          <img 
            src="/logo.png" 
            alt="Chatz Logo" 
            style={{ width: 80, height: 80, borderRadius: 20, objectFit: 'contain', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }} 
          />
        </div>
        <h2 className="wa-splash-title">Chatz Web</h2>
        <p className="wa-splash-desc">
          Send and receive private messages, audio & video calls without keeping your phone online.
          End-to-end encrypted for ultimate intimacy and privacy.
        </p>
        <div className="wa-splash-encryption">
          <Lock size={14} color="#00a884" />
          <span>End-to-end encrypted</span>
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

  return (
    <div className="wa-chat-area" ref={chatAreaRef}>
      {/* WhatsApp Doodle Wallpaper Pattern */}
      <div className="wa-doodle-bg" />

      {/* Header */}
      <div className="wa-chat-header">
        <div 
          className="wa-chat-header-user clickable"
          onClick={() => setIsProfileModalOpen(true)}
          title="Click to view Contact Profile, User ID & Options"
          style={{ cursor: 'pointer' }}
        >
          <button 
            type="button" 
            className="wa-back-btn" 
            onClick={(e) => {
              e.stopPropagation();
              onBack && onBack();
            }} 
            title="Back to all chats"
            aria-label="Back to all chats"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="wa-avatar">
            <img src={activeContact.avatar} alt={activeContact.name} />
            {activeContact.isOnline && <div className="wa-avatar-badge" />}
          </div>

          <div className="wa-chat-header-meta" style={{ minWidth: 0, flex: 1 }}>
            <div className="wa-chat-header-title" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeContact.name}</span>
              {activeContact.username && (
                <span className="wa-chat-header-username" style={{ flexShrink: 0 }}>@{activeContact.username}</span>
              )}
            </div>
            <div className={`wa-chat-header-status ${activeContact.isTyping ? 'typing' : activeContact.isOnline ? 'online' : ''}`} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeContact.isTyping
                ? 'typing...'
                : activeContact.isOnline
                ? 'online'
                : activeContact.lastSeen || 'last seen recently'}
            </div>
          </div>
        </div>

        <div className="wa-chat-header-actions">
          <button
            id="startVideoCallBtn"
            className="wa-call-action-btn"
            onClick={() => onStartCall && onStartCall(activeContact, true)}
            title="Video Call"
          >
            <Video size={20} />
          </button>

          <button
            id="startAudioCallBtn"
            className="wa-call-action-btn"
            onClick={() => onStartCall && onStartCall(activeContact, false)}
            title="Voice Call"
          >
            <Phone size={20} />
          </button>

          {/* Real-time Refresh & Sync Button */}
          <button
            id="refreshChatBtn"
            type="button"
            className={`wa-call-action-btn wa-refresh-action-btn ${isRefreshing ? 'refreshing' : ''}`}
            onClick={handleManualRefresh}
            title="Refresh & Sync Messages"
            aria-label="Refresh & Sync Messages"
          >
            <RotateCw size={19} className={isRefreshing ? 'wa-spin-anim' : ''} />
          </button>

          <button
            type="button"
            className={`wa-icon-btn ${isSearchOpen ? 'active' : ''}`}
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            title="Search in Chat (Ctrl+F)"
            aria-label="Search in Chat"
          >
            <Search size={19} />
          </button>

          <div style={{ position: 'relative' }}>
            <button
              className="wa-icon-btn"
              onClick={() => setShowOptionsMenu(!showOptionsMenu)}
              title="More Options"
            >
              <MoreVertical size={19} />
            </button>

            {showOptionsMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '44px',
                  right: 0,
                  backgroundColor: 'var(--wa-bg-panel-secondary)',
                  borderRadius: 8,
                  boxShadow: 'var(--wa-shadow-lg)',
                  border: '1px solid var(--wa-border)',
                  width: 170,
                  zIndex: 200,
                  overflow: 'hidden'
                }}
              >
                <div
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setIsProfileModalOpen(true);
                  }}
                  style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <User size={15} color="var(--wa-text-secondary)" />
                  <span>Contact info</span>
                </div>
                <div
                  onClick={() => {
                    setShowOptionsMenu(false);
                    onToggleBlock && onToggleBlock(activeContact);
                  }}
                  style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: isBlocked ? '#00a884' : 'var(--wa-danger)' }}
                >
                  {isBlocked ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
                  <span>{isBlocked ? 'Unblock contact' : 'Block contact'}</span>
                </div>
                <div
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setShowClearChatConfirm(true);
                  }}
                  style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Sparkles size={15} color="var(--wa-text-secondary)" />
                  <span>Clear Messages</span>
                </div>
                <div
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setShowDeleteChatConfirm(true);
                  }}
                  style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--wa-danger)', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <Trash2 size={15} />
                  <span>Delete Chat</span>
                </div>
              </div>
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

        {renderedMessages.map((msg, index) => {
          const myUid = currentUser?.uid || currentUser?.id;
          const myUsername = currentUser?.username ? currentUser.username.toLowerCase() : '';
          const msgSenderId = String(msg.senderId || '');
          const msgSenderUsername = String(msg.senderUsername || '').toLowerCase();

          const isOutgoing = 
            msgSenderId === 'user' ||
            (myUid && (msgSenderId === myUid || msgSenderId === `user_${myUid}`)) ||
            (myUsername && (
              msgSenderId === myUsername ||
              msgSenderId === `wa_user_${myUsername}` ||
              msgSenderUsername === myUsername
            ));
          const isCurrentMatch = matchingMsgIds[currentMatchIndex] === msg.id;
          const isMatch = matchingMsgIds.includes(msg.id);

          return (
            <div
              key={`${msg.id}_${index}`}
              id={`msg_${msg.id}`}
              className={`wa-bubble-row ${isOutgoing ? 'outgoing' : 'incoming'}`}
            >
              <div
                className={`wa-bubble ${isOutgoing ? 'outgoing' : 'incoming'} ${
                  isCurrentMatch ? 'search-match-active' : isMatch ? 'search-match' : ''
                }`}
              >
                {/* Group sender name if applicable */}
                {activeContact.isGroup && !isOutgoing && msg.senderName && (
                  <div className="wa-bubble-sender-name">{msg.senderName}</div>
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
    </div>
  );
}
