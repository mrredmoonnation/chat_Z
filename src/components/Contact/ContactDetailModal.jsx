import React, { useState } from 'react';
import { 
  X, Phone, Video, MessageSquare, Copy, Check, 
  ShieldAlert, ShieldCheck, Trash2, Sparkles, 
  FileText, Image as ImageIcon, Mic, AtSign, Info, PhoneCall
} from 'lucide-react';

export default function ContactDetailModal({
  isOpen,
  onClose,
  contact,
  isBlocked,
  onToggleBlock,
  onStartCall,
  onClearChat,
  onDeleteChat
}) {
  const [copiedId, setCopiedId] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen || !contact) return null;

  const rawId = contact.username ? `@${contact.username}` : (contact.id || contact.uid || 'User');
  const cleanDisplayId = contact.username || (contact.id?.replace(/^wa_user_/, '').replace(/^user_/, '')) || contact.uid || 'User';

  const handleCopyId = () => {
    navigator.clipboard?.writeText(cleanDisplayId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Compute media stats from contact messages
  const messages = contact.messages || [];
  const imageCount = messages.filter((m) => m.type === 'image').length;
  const voiceCount = messages.filter((m) => m.type === 'voice').length;
  const docCount = messages.filter((m) => m.type === 'document').length;

  return (
    <div className="wa-glass-modal-overlay" onClick={onClose}>
      <div 
        className="wa-glass-modal-sheet" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS 18 Drag Notch Indicator */}
        <div className="wa-glass-sheet-notch" />

        {/* Floating Close Button */}
        <button 
          type="button" 
          className="wa-glass-close-btn" 
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Top Profile Hero */}
        <div className="wa-glass-profile-hero">
          <div className="wa-glass-avatar-ring">
            <img 
              src={contact.avatar} 
              alt={contact.name} 
              className="wa-glass-hero-avatar"
            />
            {contact.isOnline && <div className="wa-glass-online-badge" />}
          </div>

          <h2 className="wa-glass-hero-name">{contact.name}</h2>

          {/* User ID Pill with 1-click Copy */}
          <button 
            type="button" 
            className="wa-glass-id-pill" 
            onClick={handleCopyId}
            title="Click to copy User ID"
          >
            <AtSign size={13} />
            <span>{cleanDisplayId}</span>
            {copiedId ? (
              <span className="wa-glass-copied-text"><Check size={12} /> Copied</span>
            ) : (
              <Copy size={12} className="wa-glass-copy-icon" />
            )}
          </button>

          {/* Online/Offline Status Pill */}
          <div className="wa-glass-status-pill">
            <span className={`wa-status-dot ${contact.isOnline ? 'online' : ''}`} />
            <span>{contact.isOnline ? 'Online now' : (contact.lastSeen || 'Offline')}</span>
          </div>

          {/* Quick Action Pills Row */}
          <div className="wa-glass-action-row">
            <button
              type="button"
              className="wa-glass-action-pill"
              onClick={() => {
                onClose();
                onStartCall && onStartCall(contact, false);
              }}
              title="Voice Call"
            >
              <div className="wa-glass-action-icon">
                <Phone size={18} />
              </div>
              <span>Audio</span>
            </button>

            <button
              type="button"
              className="wa-glass-action-pill"
              onClick={() => {
                onClose();
                onStartCall && onStartCall(contact, true);
              }}
              title="Video Call"
            >
              <div className="wa-glass-action-icon">
                <Video size={18} />
              </div>
              <span>Video</span>
            </button>

            <button
              type="button"
              className="wa-glass-action-pill"
              onClick={onClose}
              title="Chat Messages"
            >
              <div className="wa-glass-action-icon primary">
                <MessageSquare size={18} />
              </div>
              <span>Message</span>
            </button>
          </div>
        </div>

        {/* Scrollable Details Body */}
        <div className="wa-glass-modal-content">
          {/* Card 1: About / Status */}
          <div className="wa-glass-card">
            <div className="wa-glass-card-header">
              <Info size={15} />
              <span>About & Status</span>
            </div>
            <div className="wa-glass-card-body">
              <p className="wa-glass-about-text">
                {contact.about || 'Hey there! I am using Chatz'}
              </p>
            </div>
          </div>

          {/* Card 2: Contact Info */}
          {(contact.phone || contact.email || cleanDisplayId) && (
            <div className="wa-glass-card">
              <div className="wa-glass-card-header">
                <AtSign size={15} />
                <span>Contact Identifiers</span>
              </div>
              <div className="wa-glass-card-body">
                <div className="wa-glass-info-item" onClick={handleCopyId}>
                  <div className="wa-glass-info-label">User ID / Username</div>
                  <div className="wa-glass-info-value">@{cleanDisplayId}</div>
                </div>

                {contact.phone && (
                  <div className="wa-glass-info-item">
                    <div className="wa-glass-info-label">Phone Number</div>
                    <div className="wa-glass-info-value">{contact.phone}</div>
                  </div>
                )}

                {contact.email && (
                  <div className="wa-glass-info-item">
                    <div className="wa-glass-info-label">Email</div>
                    <div className="wa-glass-info-value">{contact.email}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card 3: Media & Docs Stats */}
          <div className="wa-glass-card">
            <div className="wa-glass-card-header">
              <ImageIcon size={15} />
              <span>Media, Links & Docs</span>
            </div>
            <div className="wa-glass-card-body">
              <div className="wa-glass-media-grid">
                <div className="wa-glass-stat-box">
                  <ImageIcon size={16} />
                  <span className="wa-glass-stat-count">{imageCount}</span>
                  <span className="wa-glass-stat-label">Photos</span>
                </div>
                <div className="wa-glass-stat-box">
                  <Mic size={16} />
                  <span className="wa-glass-stat-count">{voiceCount}</span>
                  <span className="wa-glass-stat-label">Voice</span>
                </div>
                <div className="wa-glass-stat-box">
                  <FileText size={16} />
                  <span className="wa-glass-stat-count">{docCount}</span>
                  <span className="wa-glass-stat-label">Docs</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Privacy & Danger Zone (Block / Clear / Delete) */}
          <div className="wa-glass-card danger-zone">
            {/* Block / Unblock Contact Button */}
            <button
              type="button"
              className={`wa-glass-danger-btn ${isBlocked ? 'unblock' : 'block'}`}
              onClick={() => {
                if (isBlocked) {
                  onToggleBlock && onToggleBlock(contact);
                } else {
                  setShowBlockConfirm(true);
                }
              }}
            >
              {isBlocked ? (
                <>
                  <ShieldCheck size={18} className="wa-glass-btn-icon" />
                  <div className="wa-glass-btn-text">
                    <div className="title">Unblock {contact.name}</div>
                    <div className="subtitle">Allow messages and calls from this user</div>
                  </div>
                </>
              ) : (
                <>
                  <ShieldAlert size={18} className="wa-glass-btn-icon" />
                  <div className="wa-glass-btn-text">
                    <div className="title">Block {contact.name}</div>
                    <div className="subtitle">Blocked contacts cannot message or call you</div>
                  </div>
                </>
              )}
            </button>

            {/* Clear Chat History */}
            <button
              type="button"
              className="wa-glass-danger-btn clear"
              onClick={() => setShowClearConfirm(true)}
            >
              <Sparkles size={18} className="wa-glass-btn-icon" />
              <div className="wa-glass-btn-text">
                <div className="title">Clear Messages</div>
                <div className="subtitle">Delete all messages from this conversation</div>
              </div>
            </button>

            {/* Delete Chat */}
            <button
              type="button"
              className="wa-glass-danger-btn delete"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={18} className="wa-glass-btn-icon" />
              <div className="wa-glass-btn-text">
                <div className="title">Delete Chat</div>
                <div className="subtitle">Remove conversation from your chat list</div>
              </div>
            </button>
          </div>
        </div>

        {/* Confirmation Modal: Block Contact */}
        {showBlockConfirm && (
          <div className="wa-glass-confirm-overlay" onClick={() => setShowBlockConfirm(false)}>
            <div className="wa-glass-confirm-box" onClick={(e) => e.stopPropagation()}>
              <div className="wa-glass-confirm-icon block">
                <ShieldAlert size={28} />
              </div>
              <h3 className="wa-glass-confirm-title">Block {contact.name}?</h3>
              <p className="wa-glass-confirm-desc">
                Blocked contacts will not be able to send you messages or call you. They will not be notified that they are blocked.
              </p>
              <div className="wa-glass-confirm-actions">
                <button
                  type="button"
                  className="wa-glass-confirm-btn cancel"
                  onClick={() => setShowBlockConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="wa-glass-confirm-btn danger"
                  onClick={() => {
                    setShowBlockConfirm(false);
                    onToggleBlock && onToggleBlock(contact);
                  }}
                >
                  Block
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal: Clear Messages */}
        {showClearConfirm && (
          <div className="wa-glass-confirm-overlay" onClick={() => setShowClearConfirm(false)}>
            <div className="wa-glass-confirm-box" onClick={(e) => e.stopPropagation()}>
              <div className="wa-glass-confirm-icon clear">
                <Sparkles size={28} />
              </div>
              <h3 className="wa-glass-confirm-title">Clear all messages?</h3>
              <p className="wa-glass-confirm-desc">
                This will delete all messages in this chat permanently from your device.
              </p>
              <div className="wa-glass-confirm-actions">
                <button
                  type="button"
                  className="wa-glass-confirm-btn cancel"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="wa-glass-confirm-btn danger"
                  onClick={() => {
                    setShowClearConfirm(false);
                    onClearChat && onClearChat(contact.id);
                  }}
                >
                  Clear Chat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal: Delete Chat */}
        {showDeleteConfirm && (
          <div className="wa-glass-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <div className="wa-glass-confirm-box" onClick={(e) => e.stopPropagation()}>
              <div className="wa-glass-confirm-icon delete">
                <Trash2 size={28} />
              </div>
              <h3 className="wa-glass-confirm-title">Delete chat with {contact.name}?</h3>
              <p className="wa-glass-confirm-desc">
                This chat will be removed from your chat list and all stored messages will be deleted.
              </p>
              <div className="wa-glass-confirm-actions">
                <button
                  type="button"
                  className="wa-glass-confirm-btn cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="wa-glass-confirm-btn danger"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    onClose();
                    onDeleteChat && onDeleteChat(contact.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
