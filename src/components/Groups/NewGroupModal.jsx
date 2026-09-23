import React, { useState } from 'react';
import { X, Check, Users, Camera } from 'lucide-react';
import { AVATAR_PRESETS } from '../../services/store';

export default function NewGroupModal({
  isOpen,
  onClose,
  contacts,
  onCreateGroup
}) {
  const [groupName, setGroupName] = useState('');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [groupAvatar, setGroupAvatar] = useState(
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=150&auto=format&fit=crop&q=80'
  );

  if (!isOpen) return null;

  const toggleContact = (contactId) => {
    if (selectedContacts.includes(contactId)) {
      setSelectedContacts(selectedContacts.filter((id) => id !== contactId));
    } else {
      setSelectedContacts([...selectedContacts, contactId]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedContacts.length === 0) return;

    onCreateGroup({
      name: groupName.trim(),
      avatar: groupAvatar,
      members: [...selectedContacts, 'user']
    });

    onClose();
    setGroupName('');
    setSelectedContacts([]);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setGroupAvatar(ev.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Only list non-group individual contacts
  const individualContacts = contacts.filter((c) => !c.isGroup);

  return (
    <div className="wa-modal-backdrop" onClick={onClose}>
      <div className="wa-modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={22} color="var(--wa-green)" />
            <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Create New Group</h3>
          </div>
          <button onClick={onClose}>
            <X size={20} color="var(--wa-text-secondary)" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Avatar and Group Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label
              htmlFor="groupIconUpload"
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                overflow: 'hidden',
                cursor: 'pointer',
                position: 'relative',
                flexShrink: 0,
                border: '2px dashed var(--wa-green)'
              }}
              title="Change Group Icon"
            >
              <img src={groupAvatar} alt="Group" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff'
                }}
              >
                <Camera size={18} />
              </div>
            </label>
            <input
              type="file"
              id="groupIconUpload"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />

            <input
              type="text"
              className="wa-phone-number-field"
              style={{ width: '100%' }}
              placeholder="Group Subject (e.g. My Secret Clan)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Member Selection */}
          <div>
            <div style={{ fontSize: '13px', color: 'var(--wa-text-secondary)', marginBottom: 8 }}>
              Select Participants ({selectedContacts.length} selected):
            </div>

            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--wa-border)', borderRadius: 8 }}>
              {individualContacts.map((c) => {
                const isSelected = selectedContacts.includes(c.id);
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleContact(c.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--wa-border-light)',
                      backgroundColor: isSelected ? 'var(--wa-bg-active)' : 'transparent'
                    }}
                  >
                    <div className="wa-avatar" style={{ width: 34, height: 34 }}>
                      <img src={c.avatar} alt={c.name} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--wa-text-secondary)' }}>{c.phone}</div>
                    </div>

                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: isSelected ? 'none' : '2px solid var(--wa-text-muted)',
                        backgroundColor: isSelected ? 'var(--wa-green)' : 'transparent',
                        color: '#111b21',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="wa-login-cta-btn"
            disabled={!groupName.trim() || selectedContacts.length === 0}
          >
            Create Group ({selectedContacts.length})
          </button>
        </form>
      </div>
    </div>
  );
}
