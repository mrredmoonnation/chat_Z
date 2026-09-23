import React, { useState } from 'react';
import { X, Link2, Copy, Check, Phone, ShieldCheck, Globe, Mail, Share2 } from 'lucide-react';
import { sanitizePeerIdentifier } from '../../services/onlineP2P';

export default function PartnerConnectModal({
  isOpen,
  onClose,
  currentUser,
  partnerOnlineStatus,
  onConnectPartner
}) {
  const [partnerPhone, setPartnerPhone] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Clean current user identifier (Username, Phone, or Gmail)
  const displayHandle = currentUser?.username ? `@${currentUser.username}` : (currentUser?.phone || currentUser?.email || currentUser?.name || '');
  const peerId = currentUser?.username || currentUser?.phone || currentUser?.email || currentUser?.name || '';
  const cleanNumber = sanitizePeerIdentifier(peerId);
  const shareableUrl = `${window.location.origin}/?partner=${cleanNumber}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Chat with me on Chatz',
          text: 'Open this secret chat link to connect with me directly:',
          url: shareableUrl
        });
        return;
      } catch (err) {
        // Fallback to copy if user dismisses native share dialog
      }
    }
    handleCopyLink();
  };

  const handleManualConnect = (e) => {
    e.preventDefault();
    if (!partnerPhone.trim()) return;
    onConnectPartner(partnerPhone.trim());
    onClose();
  };

  return (
    <div className="wa-modal-backdrop" onClick={onClose}>
      <div className="wa-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={22} color="var(--wa-green)" />
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Connect Over Internet</h3>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="wa-icon-btn"
            style={{ width: 36, height: 36 }}
            aria-label="Close"
          >
            <X size={20} color="var(--wa-text-secondary)" />
          </button>
        </div>

        <p style={{ fontSize: '13px', color: 'var(--wa-text-secondary)', lineHeight: 1.5 }}>
          Connect directly with your partner even if you are on different networks, WiFi or mobile data in different cities.
        </p>

        {/* Live Status Badge */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            backgroundColor: partnerOnlineStatus === 'connected' ? 'rgba(0, 168, 132, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: `1px solid ${partnerOnlineStatus === 'connected' ? 'var(--wa-green)' : 'var(--wa-border)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: partnerOnlineStatus === 'connected' ? 'var(--wa-green)' : '#f59e0b'
            }}
          />
          <div style={{ flex: 1, fontSize: '13px' }}>
            {partnerOnlineStatus === 'connected' ? (
              <span style={{ color: 'var(--wa-green-light)', fontWeight: 500 }}>
                Connected with Partner over Internet (P2P Live)
              </span>
            ) : (
              <span style={{ color: 'var(--wa-text-secondary)' }}>
                Waiting for partner to open link or connect...
              </span>
            )}
          </div>
        </div>

        {/* Method 1: Share Link */}
        <div>
          <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--wa-text-primary)', display: 'block', marginBottom: 6 }}>
            Method 1: Send Secret Link to Girlfriend
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              readOnly
              value={shareableUrl}
              className="wa-phone-number-field"
              style={{ fontSize: '13px', height: 44, color: 'var(--wa-text-secondary)', flex: 1, minWidth: 0 }}
            />
            {typeof navigator !== 'undefined' && !!navigator.share && (
              <button
                type="button"
                onClick={handleShareLink}
                className="wa-login-cta-btn"
                style={{ width: 'auto', padding: '0 14px', height: 44, flexShrink: 0, gap: 6 }}
                title="Share link via WhatsApp / Apps"
              >
                <Share2 size={16} />
                <span>Share</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyLink}
              className="wa-login-cta-btn"
              style={{ width: 'auto', padding: '0 14px', height: 44, flexShrink: 0, gap: 6 }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--wa-text-muted)', display: 'block', marginTop: 4 }}>
            She just taps this link on her phone, and you are instantly connected!
          </span>
        </div>

        {/* Current User ID Badge */}
        <div style={{ fontSize: '12px', color: 'var(--wa-text-secondary)', display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'var(--wa-bg-input)', padding: '6px 10px', borderRadius: 6 }}>
          <span>Your Handle:</span>
          <strong style={{ color: 'var(--wa-green-light)' }}>{displayHandle}</strong>
        </div>

        {/* Method 2: Enter Partner Number or Email */}
        <form onSubmit={handleManualConnect}>
          <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--wa-text-primary)', display: 'block', marginBottom: 6 }}>
            Method 2: Or Enter Partner @username, Phone or Email
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="e.g. @priya_99 or partner@gmail.com"
              value={partnerPhone}
              onChange={(e) => setPartnerPhone(e.target.value)}
              className="wa-phone-number-field"
              style={{ height: 44, fontSize: '14px', flex: 1, minWidth: 0 }}
            />
            <button
              type="submit"
              className="wa-login-cta-btn"
              style={{ width: 'auto', padding: '0 18px', height: 44, flexShrink: 0 }}
              disabled={!partnerPhone.trim()}
            >
              Connect
            </button>
          </div>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--wa-text-muted)', fontSize: '12px' }}>
          <ShieldCheck size={15} color="#00a884" />
          <span>Encrypted Peer-to-Peer. No server stores your chats.</span>
        </div>
      </div>
    </div>
  );
}
