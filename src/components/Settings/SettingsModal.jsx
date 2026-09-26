import React, { useState, useEffect } from 'react';
import { 
  X, ShieldAlert, ShieldCheck, User, Moon, Sun, 
  Sparkles, Camera, Check, Copy, AtSign, Info, 
  Volume2, VolumeX, LogOut, CheckCircle2
} from 'lucide-react';
import { 
  AVATAR_PRESETS, GENDER_AVATARS, generateBitmojiAvatar,
  isUsernameAvailable, cleanUsername, isValidUsernameFormat
} from '../../services/store';
import { compressAvatar } from '../../services/imageUtils';

export default function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  blockedUsers = [],
  onUnblockUser,
  onUpdateProfile,
  theme,
  onToggleTheme,
  onLogout
}) {
  const [activeTab, setActiveTab] = useState('blocked'); // 'blocked', 'profile', 'appearance'
  const [copiedId, setCopiedId] = useState(false);

  // Profile Edit State
  const [name, setName] = useState(currentUser?.name || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [usernameStatus, setUsernameStatus] = useState('');
  const [about, setAbout] = useState(currentUser?.about || 'Hey there! I am using Chatz');
  const [avatar, setAvatar] = useState(currentUser?.avatar || AVATAR_PRESETS[0]);
  const [gender, setGender] = useState(currentUser?.gender || 'male');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || currentUser.displayName || '');
      setUsername(currentUser.username || '');
      setAbout(currentUser.about || 'Hey there! I am using Chatz');
      setAvatar(currentUser.avatar || currentUser.photoURL || AVATAR_PRESETS[0]);
      setGender(currentUser.gender || 'male');
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const handleCopyMyId = () => {
    const idToCopy = currentUser?.username || currentUser?.id || currentUser?.uid;
    if (idToCopy) {
      navigator.clipboard?.writeText(idToCopy);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleUsernameChange = (val) => {
    const clean = cleanUsername(val);
    setUsername(clean);
    if (!clean) {
      setUsernameStatus('');
      return;
    }
    if (!isValidUsernameFormat(clean)) {
      setUsernameStatus('invalid');
      return;
    }
    const avail = isUsernameAvailable(clean, currentUser?.id);
    setUsernameStatus(avail ? 'available' : 'taken');
  };

  const handleRollBitmoji = () => {
    const seed = name || username || ('User_' + Math.floor(Math.random() * 1000));
    const newBitmoji = generateBitmojiAvatar(seed, gender);
    setAvatar(newBitmoji);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressAvatar(file, 256, 0.8);
        setAvatar(compressed);
      } catch (err) {
        console.error('Failed to compress avatar:', err);
      }
    }
  };

  const handleSaveProfile = () => {
    if (!name.trim()) return;
    const clean = cleanUsername(username || currentUser?.username || '');
    if (!clean || !isValidUsernameFormat(clean)) return;
    if (!isUsernameAvailable(clean, currentUser?.id)) return;

    const updated = {
      ...currentUser,
      name: name.trim(),
      displayName: name.trim(),
      username: clean,
      about: about.trim() || 'Hey there! I am using Chatz',
      avatar: avatar,
      gender: gender
    };

    onUpdateProfile && onUpdateProfile(updated);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 1500);
  };

  return (
    <div className="wa-glass-modal-overlay" onClick={onClose}>
      <div 
        className="wa-glass-modal-sheet settings" 
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

        {/* Modal Title */}
        <div className="wa-glass-settings-header">
          <h2 className="wa-glass-settings-title">Settings</h2>
          <p className="wa-glass-settings-subtitle">Manage privacy, blocked users & your profile</p>
        </div>

        {/* Segmented iOS Glass Control Tabs */}
        <div className="wa-glass-segmented-control">
          <button
            type="button"
            className={`wa-glass-segment-btn ${activeTab === 'blocked' ? 'active' : ''}`}
            onClick={() => setActiveTab('blocked')}
          >
            <ShieldAlert size={15} />
            <span>Blocked Users</span>
            {blockedUsers.length > 0 && (
              <span className="wa-glass-badge">{blockedUsers.length}</span>
            )}
          </button>

          <button
            type="button"
            className={`wa-glass-segment-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={15} />
            <span>My Profile</span>
          </button>

          <button
            type="button"
            className={`wa-glass-segment-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Sparkles size={15} />
            <span>Appearance</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="wa-glass-modal-content">
          {/* ================= TAB 1: BLOCKED CONTACTS ================= */}
          {activeTab === 'blocked' && (
            <div className="wa-glass-settings-tab-pane">
              <div className="wa-glass-section-desc">
                Contacts you have blocked cannot call or message you. Their User ID and identity are listed below.
              </div>

              {blockedUsers.length === 0 ? (
                <div className="wa-glass-empty-state">
                  <div className="wa-glass-empty-icon">
                    <ShieldCheck size={36} color="#00a884" />
                  </div>
                  <h3>No Blocked Contacts</h3>
                  <p>You haven't blocked anyone yet. All your contacts can message and call you normally.</p>
                </div>
              ) : (
                <div className="wa-glass-blocked-list">
                  {blockedUsers.map((user) => {
                    const displayId = user.username ? `@${user.username}` : (user.id || user.uid || 'Blocked User');
                    return (
                      <div key={user.id || user.username} className="wa-glass-blocked-item">
                        <img 
                          src={user.avatar || AVATAR_PRESETS[0]} 
                          alt={user.name} 
                          className="wa-glass-blocked-avatar"
                        />
                        <div className="wa-glass-blocked-info">
                          <div className="wa-glass-blocked-name">{user.name}</div>
                          <div className="wa-glass-blocked-id">
                            <AtSign size={12} />
                            <span>{displayId}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="wa-glass-unblock-btn"
                          onClick={() => onUnblockUser && onUnblockUser(user)}
                        >
                          <ShieldCheck size={14} />
                          <span>Unblock</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2: MY PROFILE ================= */}
          {activeTab === 'profile' && (
            <div className="wa-glass-settings-tab-pane">
              {/* Profile Card */}
              <div className="wa-glass-card profile-editor">
                <div className="wa-glass-avatar-uploader">
                  <img src={avatar} alt="My Avatar" className="wa-glass-edit-avatar" />
                  <label className="wa-glass-camera-badge" title="Upload new photo">
                    <Camera size={14} />
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                  </label>
                </div>

                <button
                  type="button"
                  className="wa-glass-sub-btn"
                  onClick={handleRollBitmoji}
                  style={{ marginTop: 8 }}
                >
                  <Sparkles size={14} />
                  <span>Roll New 3D Avatar</span>
                </button>
              </div>

              {/* Form Inputs */}
              <div className="wa-glass-form-group">
                <label>Display Name</label>
                <input
                  type="text"
                  className="wa-glass-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your display name"
                />
              </div>

              <div className="wa-glass-form-group">
                <label>Username / User ID</label>
                <div className="wa-glass-input-wrapper">
                  <span className="wa-glass-input-prefix">@</span>
                  <input
                    type="text"
                    className="wa-glass-input has-prefix"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="unique_username"
                  />
                </div>
                {usernameStatus === 'taken' && (
                  <span className="wa-glass-status-hint error">Username already taken</span>
                )}
                {usernameStatus === 'available' && (
                  <span className="wa-glass-status-hint success">Username is available!</span>
                )}
              </div>

              <div className="wa-glass-form-group">
                <label>About / Bio</label>
                <input
                  type="text"
                  className="wa-glass-input"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Hey there! I am using Chatz"
                />
              </div>

              {/* User ID copy button */}
              <div className="wa-glass-card">
                <div className="wa-glass-info-item" onClick={handleCopyMyId} style={{ cursor: 'pointer' }}>
                  <div className="wa-glass-info-label">Your Chatz User ID (Share to connect)</div>
                  <div className="wa-glass-info-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>@{currentUser?.username || currentUser?.id}</span>
                    {copiedId ? (
                      <span className="wa-glass-copied-text"><Check size={12} /> Copied!</span>
                    ) : (
                      <Copy size={13} className="wa-glass-copy-icon" />
                    )}
                  </div>
                </div>
              </div>

              {saveSuccess && (
                <div className="wa-glass-alert-success">
                  <CheckCircle2 size={16} />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              <button
                type="button"
                className="wa-glass-save-btn"
                onClick={handleSaveProfile}
              >
                <span>Save Profile Changes</span>
              </button>
            </div>
          )}

          {/* ================= TAB 3: APPEARANCE & THEME ================= */}
          {activeTab === 'appearance' && (
            <div className="wa-glass-settings-tab-pane">
              <div className="wa-glass-card">
                <div className="wa-glass-card-header">
                  <Sparkles size={15} />
                  <span>Display Theme</span>
                </div>
                <div className="wa-glass-card-body">
                  <div className="wa-glass-theme-options">
                    <button
                      type="button"
                      className={`wa-glass-theme-box ${theme === 'dark' ? 'active' : ''}`}
                      onClick={() => theme !== 'dark' && onToggleTheme && onToggleTheme()}
                    >
                      <Moon size={20} color="#00a884" />
                      <div className="title">Liquid Dark Glass</div>
                      <div className="desc">Deep obsidian with frosted translucent panels</div>
                    </button>

                    <button
                      type="button"
                      className={`wa-glass-theme-box ${theme === 'light' ? 'active' : ''}`}
                      onClick={() => theme !== 'light' && onToggleTheme && onToggleTheme()}
                    >
                      <Sun size={20} color="#ffb703" />
                      <div className="title">Frosted Light Glass</div>
                      <div className="desc">Clean bright aesthetic with frosted glass touches</div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Log out section */}
              <div className="wa-glass-card danger-zone" style={{ marginTop: 24 }}>
                <button
                  type="button"
                  className="wa-glass-danger-btn"
                  onClick={() => {
                    onClose();
                    onLogout && onLogout();
                  }}
                >
                  <LogOut size={18} />
                  <div className="wa-glass-btn-text">
                    <div className="title">Log Out</div>
                    <div className="subtitle">Sign out of your Chatz account on this device</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
