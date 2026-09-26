import React, { useState, useRef, useEffect } from 'react';
import { Smile, Paperclip, Mic, Send, Image as ImageIcon, FileText, Camera, X, Trash2, CheckCircle2, MapPin } from 'lucide-react';
import { compressImage } from '../../services/imageUtils';

const EMOJIS = [
  '❤️', '💖', '😍', '🥰', '😘', '💋', '🙈', '🌹', '✨', '🥺', 
  '😂', '🤣', '😊', '🤗', '🔥', '💯', '👍', '🙏', '🎉', '🍫',
  '☕', '🍕', '🌸', '🧸', '💌', '💍', '🕊️', '🌙', '⭐', '🌈'
];

export default function ChatInput({
  onSendMessage,
  onTyping,
  isBlocked = false,
  onUnblock
}) {
  const [text, setText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const fileInputRef = useRef(null);
  const docInputRef = useRef(null);
  const recordIntervalRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Handle Live Location Sharing
  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsGettingLocation(true);
    setShowAttach(false);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsGettingLocation(false);
        const { latitude, longitude, accuracy } = position.coords;
        onSendMessage({
          type: 'location',
          latitude,
          longitude,
          accuracy: Math.round(accuracy || 0),
          address: `Live Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
          mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`
        });
      },
      (error) => {
        setIsGettingLocation(false);
        console.warn('Geolocation warning:', error);
        let msg = 'Could not fetch your location. Please check your browser location permissions.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. Please allow location access in your browser to share your location.';
        }
        alert(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Close emoji & attach menus on outside touch/click
  useEffect(() => {
    if (!showEmojis && !showAttach) return;
    const handleOutsideTouch = (e) => {
      if (
        !e.target.closest('.wa-emoji-picker-box') &&
        !e.target.closest('#emojiToggleBtn') &&
        !e.target.closest('.wa-attach-menu') &&
        !e.target.closest('#attachToggleBtn')
      ) {
        setShowEmojis(false);
        setShowAttach(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideTouch);
    return () => document.removeEventListener('pointerdown', handleOutsideTouch);
  }, [showEmojis, showAttach]);

  // Handle typing indicator trigger
  const handleTextChange = (e) => {
    setText(e.target.value);

    onTyping && onTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping && onTyping(false);
    }, 1200);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage({
      type: 'text',
      text: text.trim()
    });
    setText('');
    setShowEmojis(false);
    setShowAttach(false);
    onTyping && onTyping(false);
  };

  const handleEmojiClick = (emoji) => {
    setText((prev) => prev + emoji);
  };

  // Image Upload with Instant Compression (prevents blank screen crash)
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedUrl = await compressImage(file, 640, 640, 0.6);
        onSendMessage({
          type: 'image',
          url: compressedUrl,
          fileUrl: compressedUrl,
          caption: file.name
        });
      } catch (err) {
        console.error('Image compression error:', err);
      }
    }
    e.target.value = '';
    setShowAttach(false);
  };

  // Document Upload
  const handleDocSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onSendMessage({
        type: 'document',
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(1) + ' KB'
      });
    }
    setShowAttach(false);
  };

  // Voice Note Recording
  const startRecording = () => {
    setIsRecording(true);
    setRecordingSecs(0);
    recordIntervalRef.current = setInterval(() => {
      setRecordingSecs((prev) => prev + 1);
    }, 1000);
  };

  const cancelRecording = () => {
    setIsRecording(false);
    clearInterval(recordIntervalRef.current);
  };

  const stopAndSendRecording = () => {
    setIsRecording(false);
    clearInterval(recordIntervalRef.current);
    onSendMessage({
      type: 'voice',
      duration: `${Math.floor(recordingSecs / 60)}:${recordingSecs % 60 < 10 ? '0' : ''}${recordingSecs % 60}`
    });
  };

  return (
    <div className="wa-chat-input-bar">
      {/* Emoji Picker Popover */}
      {showEmojis && (
        <div className="wa-emoji-picker-box">
          {EMOJIS.map((em, idx) => (
            <div
              key={idx}
              className="wa-emoji-item"
              onClick={() => handleEmojiClick(em)}
            >
              {em}
            </div>
          ))}
        </div>
      )}

      {/* Attachment Popover */}
      {showAttach && (
        <div className="wa-attach-menu">
          <div className="wa-attach-item" onClick={() => fileInputRef.current?.click()}>
            <div className="wa-attach-icon" style={{ backgroundColor: '#ac44cf' }}>
              <ImageIcon size={18} />
            </div>
            <span>Photos & Videos</span>
          </div>

          <div className="wa-attach-item" onClick={() => docInputRef.current?.click()}>
            <div className="wa-attach-icon" style={{ backgroundColor: '#5f66cd' }}>
              <FileText size={18} />
            </div>
            <span>Document</span>
          </div>

          <div className="wa-attach-item" onClick={() => fileInputRef.current?.click()}>
            <div className="wa-attach-icon" style={{ backgroundColor: '#d3396d' }}>
              <Camera size={18} />
            </div>
            <span>Camera</span>
          </div>

          <div className="wa-attach-item" onClick={handleShareLocation}>
            <div className="wa-attach-icon" style={{ backgroundColor: '#00a884' }}>
              <MapPin size={18} />
            </div>
            <span>Share Location</span>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,video/*"
        onChange={handleImageSelect}
        style={{ display: 'none' }}
      />
      <input
        type="file"
        ref={docInputRef}
        onChange={handleDocSelect}
        style={{ display: 'none' }}
      />

      {isRecording ? (
        // Active Voice Recording UI
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: 'var(--wa-danger)',
                animation: 'waPulseRing 1s infinite'
              }}
            />
            <span style={{ color: 'var(--wa-text-primary)', fontWeight: 500 }}>
              Recording... 0:{recordingSecs < 10 ? '0' : ''}{recordingSecs}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={cancelRecording}
              style={{ color: 'var(--wa-danger)', padding: 6 }}
              title="Delete Voice Note"
            >
              <Trash2 size={20} />
            </button>

            <button
              onClick={stopAndSendRecording}
              className="wa-send-btn"
              title="Send Voice Note"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : isBlocked ? (
        <div className="wa-glass-blocked-input-notice">
          <span>You blocked this contact. Tap to unblock.</span>
          <button type="button" onClick={onUnblock} className="wa-glass-unblock-pill">
            Unblock
          </button>
        </div>
      ) : (
        // Normal Message Input UI
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              className={`wa-icon-btn ${showEmojis ? 'active' : ''}`}
              onClick={() => {
                setShowEmojis(!showEmojis);
                setShowAttach(false);
              }}
              title="Emojis"
              id="emojiToggleBtn"
            >
              <Smile size={22} />
            </button>

            <button
              type="button"
              className={`wa-icon-btn ${showAttach ? 'active' : ''}`}
              onClick={() => {
                setShowAttach(!showAttach);
                setShowEmojis(false);
              }}
              title="Attach File"
              id="attachToggleBtn"
            >
              <Paperclip size={22} />
            </button>

            <button
              type="button"
              className={`wa-icon-btn ${isGettingLocation ? 'active' : ''}`}
              onClick={handleShareLocation}
              title={isGettingLocation ? 'Acquiring GPS location...' : 'Share Live Location'}
              id="locationQuickBtn"
              disabled={isGettingLocation}
              style={{
                color: isGettingLocation ? 'var(--wa-green-light)' : undefined,
                transition: 'transform 0.2s ease'
              }}
            >
              <MapPin size={21} className={isGettingLocation ? 'wa-pulse-spin' : ''} />
            </button>
          </div>

          <div className="wa-chat-textarea-box">
            <textarea
              id="messageInputTextarea"
              rows={1}
              className="wa-chat-textarea"
              placeholder="Type a message..."
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
            />
          </div>

          {text.trim().length > 0 ? (
            <button
              id="sendMessageBtn"
              type="button"
              className="wa-send-btn"
              onClick={handleSend}
              title="Send Message"
            >
              <Send size={18} />
            </button>
          ) : (
            <button
              id="voiceRecordBtn"
              type="button"
              className="wa-icon-btn"
              onClick={startRecording}
              title="Record Voice Note"
            >
              <Mic size={22} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
