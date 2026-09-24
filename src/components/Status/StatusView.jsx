import React, { useState, useEffect } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Send, Camera, Type, Image as ImageIcon, Trash2 } from 'lucide-react';
import { compressImage } from '../../services/imageUtils';

const BG_COLORS = ['#00a884', '#7c3aed', '#2563eb', '#db2777', '#d97706', '#dc2626'];

export default function StatusView({
  currentUser,
  stories = [],
  onAddStory,
  onReplyToStory,
  onDeleteStory,
  onDeleteStoryItem,
  onStorySeen
}) {
  const [activeStory, setActiveStory] = useState(null); // story object
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'item' | 'all', storyId, itemId }

  // New Status Creator State
  const [statusType, setStatusType] = useState('text'); // 'text' or 'image'
  const [newText, setNewText] = useState('');
  const [newBgColor, setNewBgColor] = useState(BG_COLORS[0]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCaption, setNewCaption] = useState('');

  // Distinguish my story from other contacts' stories
  const myStory = stories.find(
    (s) => (
      s.contactId === 'user' || 
      (currentUser?.id && s.contactId === currentUser.id) || 
      (currentUser?.uid && s.uid === currentUser.uid) ||
      (currentUser?.username && s.username === currentUser.username)
    ) && s.items && s.items.length > 0
  );
  const otherStories = stories.filter(
    (s) => !(
      s.contactId === 'user' || 
      (currentUser?.id && s.contactId === currentUser.id) || 
      (currentUser?.uid && s.uid === currentUser.uid) ||
      (currentUser?.username && s.username === currentUser.username)
    ) && s.items && s.items.length > 0
  );

  // Story Timer
  useEffect(() => {
    if (!activeStory || isPaused || confirmDelete) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Go to next item
          if (activeItemIndex < activeStory.items.length - 1) {
            setActiveItemIndex(activeItemIndex + 1);
            return 0;
          } else {
            // Close story
            setActiveStory(null);
            return 0;
          }
        }
        return prev + 2; // ~5 seconds per story slide
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeStory, activeItemIndex, isPaused, confirmDelete]);

  const openStory = (story) => {
    setActiveStory(story);
    setActiveItemIndex(0);
    setProgress(0);
    setIsPaused(false);
    if (onStorySeen && story.contactId !== 'user') {
      onStorySeen(story.id || story.uid || story.contactId);
    }
  };

  const nextItem = () => {
    if (!activeStory) return;
    if (activeItemIndex < activeStory.items.length - 1) {
      setActiveItemIndex(activeItemIndex + 1);
      setProgress(0);
    } else {
      setActiveStory(null);
    }
  };

  const prevItem = () => {
    if (!activeStory) return;
    if (activeItemIndex > 0) {
      setActiveItemIndex(activeItemIndex - 1);
      setProgress(0);
    }
  };

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeStory) return;
    onReplyToStory && onReplyToStory(activeStory.contactId, `Replying to status: "${replyText}"`);
    setReplyText('');
    setActiveStory(null);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (statusType === 'text' && !newText.trim()) return;
    if (statusType === 'image' && !newImageUrl) return;

    const newItem = statusType === 'text' ? {
      id: 'item_' + Date.now(),
      type: 'text',
      text: newText.trim(),
      bgColor: newBgColor,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    } : {
      id: 'item_' + Date.now(),
      type: 'image',
      url: newImageUrl,
      caption: newCaption.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    onAddStory(newItem);
    setIsCreateOpen(false);
    setNewText('');
    setNewImageUrl('');
    setNewCaption('');
  };

  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 1080, 1080, 0.75);
        setNewImageUrl(compressed);
      } catch (err) {
        console.error('Failed to compress status image:', err);
      }
    }
  };

  // Execute deletion
  const handleExecuteDelete = () => {
    if (!confirmDelete) return;

    if (confirmDelete.type === 'item') {
      if (onDeleteStoryItem) {
        onDeleteStoryItem(confirmDelete.storyId, confirmDelete.itemId);
      }
      if (activeStory && activeStory.id === confirmDelete.storyId) {
        const remaining = activeStory.items.filter((it) => it.id !== confirmDelete.itemId);
        if (remaining.length === 0) {
          setActiveStory(null);
        } else {
          const nextIdx = Math.min(activeItemIndex, remaining.length - 1);
          setActiveStory({ ...activeStory, items: remaining });
          setActiveItemIndex(nextIdx);
          setProgress(0);
          setIsPaused(false);
        }
      }
    } else if (confirmDelete.type === 'all') {
      if (onDeleteStory) {
        onDeleteStory(confirmDelete.storyId);
      }
      if (activeStory && activeStory.id === confirmDelete.storyId) {
        setActiveStory(null);
      }
    }

    setConfirmDelete(null);
    setIsPaused(false);
  };

  const isMyStoryActive = activeStory && (
    activeStory.contactId === 'user' || 
    (currentUser?.id && activeStory.contactId === currentUser.id) ||
    (currentUser?.uid && (activeStory.uid === currentUser.uid || activeStory.contactId === currentUser.uid)) ||
    (currentUser?.username && (activeStory.username === currentUser.username || activeStory.contactId === activeStory.username))
  );
  const currentItem = activeStory?.items?.[activeItemIndex] || activeStory?.items?.[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      {/* My Status Item */}
      <div
        className="wa-chat-item"
        onClick={() => {
          if (myStory) {
            openStory(myStory);
          } else {
            setIsCreateOpen(true);
          }
        }}
        style={{ borderBottom: '1px solid var(--wa-border)', cursor: 'pointer' }}
      >
        <div style={{ position: 'relative' }}>
          {myStory ? (
            <div className="wa-status-avatar-ring">
              <div className="wa-avatar">
                <img src={currentUser?.avatar} alt={currentUser?.name} />
              </div>
            </div>
          ) : (
            <>
              <div className="wa-avatar">
                <img src={currentUser?.avatar} alt={currentUser?.name} />
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: 'var(--wa-green)',
                  color: '#111b21',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--wa-bg-panel)'
                }}
              >
                <Plus size={12} strokeWidth={3} />
              </div>
            </>
          )}
        </div>

        <div className="wa-chat-info">
          <div className="wa-chat-name">My status</div>
          <div className="wa-chat-time" style={{ textAlign: 'left' }}>
            {myStory
              ? `${myStory.items.length} ${myStory.items.length === 1 ? 'update' : 'updates'} • ${myStory.timeText || 'Today'}`
              : 'Tap to add status update'}
          </div>
        </div>

        {/* Action Buttons for My Status */}
        <div className="wa-status-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="wa-status-btn-icon"
            title="Add new status update"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus size={18} />
          </button>

          {myStory && (
            <button
              type="button"
              className="wa-status-btn-icon danger"
              title="Delete status"
              onClick={() => {
                setConfirmDelete({ type: 'all', storyId: myStory.id });
              }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '14px 16px 8px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--wa-green-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Recent updates
      </div>

      {/* Stories List (Contacts) */}
      <div className="wa-chat-list">
        {otherStories.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--wa-text-secondary)', fontSize: '13.5px' }}>
            No recent updates from contacts
          </div>
        ) : (
          otherStories.map((s) => (
            <div
              key={s.id}
              className="wa-chat-item"
              onClick={() => openStory(s)}
            >
              <div className="wa-status-avatar-ring">
                <div className="wa-avatar">
                  <img src={s.avatar} alt={s.contactName} />
                </div>
              </div>

              <div className="wa-chat-info">
                <div className="wa-chat-name">{s.contactName}</div>
                <div className="wa-chat-time" style={{ textAlign: 'left' }}>
                  {s.timeText || 'Today'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Fullscreen Story Viewer */}
      {activeStory && currentItem && (
        <div className="wa-story-overlay">
          <div
            className="wa-story-player-card"
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
          >
            {/* Top segmented progress bars */}
            <div className="wa-story-progress-bar-row">
              {activeStory.items.map((_, i) => (
                <div key={i} className="wa-story-progress-track">
                  <div
                    className="wa-story-progress-fill"
                    style={{
                      width: i < activeItemIndex ? '100%' : i === activeItemIndex ? `${progress}%` : '0%'
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Header */}
            <div className="wa-story-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="wa-avatar" style={{ width: 38, height: 38 }}>
                  <img src={activeStory.avatar} alt={activeStory.contactName} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{activeStory.contactName}</div>
                  <div style={{ fontSize: 11.5, opacity: 0.85 }}>
                    {activeStory.items.length > 1 ? `${activeItemIndex + 1} of ${activeStory.items.length} • ` : ''}
                    {currentItem.time || activeStory.timeText || 'Just now'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isMyStoryActive && (
                  <button
                    type="button"
                    className="wa-story-action-btn wa-story-delete-btn"
                    title="Delete this status update"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsPaused(true);
                      setConfirmDelete({
                        type: 'item',
                        storyId: activeStory.id,
                        itemId: currentItem.id
                      });
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                )}

                <button
                  type="button"
                  className="wa-story-action-btn"
                  onClick={() => setActiveStory(null)}
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Main Story Content */}
            <div
              className="wa-story-content-body"
              style={{
                backgroundColor: currentItem.type === 'text'
                  ? currentItem.bgColor
                  : '#000000'
              }}
            >
              {currentItem.type === 'text' ? (
                <div style={{ padding: '0 20px', wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {currentItem.text}
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <img
                    src={currentItem.url}
                    alt="Status media"
                  />
                  {currentItem.caption && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: isMyStoryActive ? 68 : 60,
                        left: 0,
                        right: 0,
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        backdropFilter: 'blur(4px)',
                        padding: '10px 16px',
                        fontSize: '15px'
                      }}
                    >
                      {currentItem.caption}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation click zones */}
            <div
              style={{
                position: 'absolute',
                top: 68,
                bottom: isMyStoryActive ? 68 : 72,
                left: 0,
                width: '35%',
                zIndex: 5,
                cursor: 'pointer'
              }}
              onClick={prevItem}
            />
            <div
              style={{
                position: 'absolute',
                top: 68,
                bottom: isMyStoryActive ? 68 : 72,
                right: 0,
                width: '35%',
                zIndex: 5,
                cursor: 'pointer'
              }}
              onClick={nextItem}
            />

            {/* Bottom Section: My Status Bar (with Delete) or Reply Form */}
            {isMyStoryActive ? (
              <div className="wa-story-my-status-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255, 255, 255, 0.85)' }}>
                  <span>👁️ {currentItem.seenBy?.length ? `${currentItem.seenBy.length} ${currentItem.seenBy.length === 1 ? 'view' : 'views'}` : 'Viewed by your contacts'}</span>
                </div>
                <button
                  type="button"
                  className="wa-story-bar-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaused(true);
                    setConfirmDelete({
                      type: 'item',
                      storyId: activeStory.id,
                      itemId: currentItem.id
                    });
                  }}
                >
                  <Trash2 size={15} />
                  <span>Delete status</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendReply} className="wa-story-reply-box">
                <input
                  type="text"
                  placeholder={`Reply to ${activeStory.contactName}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{ flex: 1, background: 'transparent', color: '#fff', fontSize: 14 }}
                />
                <button type="submit" style={{ color: 'var(--wa-green)' }}>
                  <Send size={18} />
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="wa-modal-backdrop"
          onClick={() => {
            setConfirmDelete(null);
            setIsPaused(false);
          }}
          style={{ zIndex: 100000 }}
        >
          <div
            className="wa-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 360, textAlign: 'center', padding: '24px 20px' }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: 8, color: 'var(--wa-text-primary)' }}>
              {confirmDelete.type === 'all' ? 'Delete all status updates?' : 'Delete this status update?'}
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--wa-text-secondary)', marginBottom: 20, lineHeight: 1.4 }}>
              {confirmDelete.type === 'all'
                ? 'All your current status updates will be permanently deleted.'
                : 'This status update will be deleted for you and all your contacts.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(null);
                  setIsPaused(false);
                }}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: 'var(--wa-bg-input)',
                  color: 'var(--wa-text-primary)',
                  fontWeight: 600,
                  fontSize: 14,
                  border: '1px solid var(--wa-border)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 14,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Status Modal */}
      {isCreateOpen && (
        <div className="wa-modal-backdrop" onClick={() => setIsCreateOpen(false)}>
          <div className="wa-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Create New Status</h3>
              <button onClick={() => setIsCreateOpen(false)}>
                <X size={20} color="var(--wa-text-secondary)" />
              </button>
            </div>

            {/* Type Switcher */}
            <div style={{ display: 'flex', gap: 10, background: 'var(--wa-bg-input)', padding: 4, borderRadius: 8 }}>
              <button
                type="button"
                onClick={() => setStatusType('text')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 6,
                  backgroundColor: statusType === 'text' ? 'var(--wa-green)' : 'transparent',
                  color: statusType === 'text' ? '#111b21' : 'var(--wa-text-primary)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Type size={16} />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusType('image')}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 6,
                  backgroundColor: statusType === 'image' ? 'var(--wa-green)' : 'transparent',
                  color: statusType === 'image' ? '#111b21' : 'var(--wa-text-primary)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <ImageIcon size={16} />
                <span>Photo</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {statusType === 'text' ? (
                <>
                  <textarea
                    rows={4}
                    placeholder="Type a status..."
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    style={{
                      backgroundColor: newBgColor,
                      color: '#ffffff',
                      borderRadius: 8,
                      padding: 14,
                      fontSize: 18,
                      textAlign: 'center',
                      resize: 'none'
                    }}
                    required
                  />

                  <div>
                    <div style={{ fontSize: 12, color: 'var(--wa-text-secondary)', marginBottom: 8 }}>
                      Background Color:
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {BG_COLORS.map((col) => (
                        <div
                          key={col}
                          onClick={() => setNewBgColor(col)}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            backgroundColor: col,
                            cursor: 'pointer',
                            border: newBgColor === col ? '3px solid #ffffff' : 'none'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {newImageUrl ? (
                    <div style={{ height: 180, borderRadius: 8, overflow: 'hidden' }}>
                      <img src={newImageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <label
                      htmlFor="statusImageInput"
                      style={{
                        height: 140,
                        borderRadius: 8,
                        border: '2px dashed var(--wa-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer'
                      }}
                    >
                      <Camera size={32} color="var(--wa-green)" />
                      <span style={{ fontSize: 13, color: 'var(--wa-text-secondary)' }}>Click to pick a photo</span>
                    </label>
                  )}
                  <input
                    type="file"
                    id="statusImageInput"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    style={{ display: 'none' }}
                  />

                  <input
                    type="text"
                    placeholder="Add a caption..."
                    value={newCaption}
                    onChange={(e) => setNewCaption(e.target.value)}
                    className="wa-phone-number-field"
                  />
                </>
              )}

              <button
                type="submit"
                className="wa-login-cta-btn"
                style={{ marginTop: 8 }}
              >
                Post to My Status
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
