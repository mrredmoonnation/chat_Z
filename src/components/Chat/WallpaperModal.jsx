import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Palette, Image as ImageIcon, Sparkles, Check, X, Upload, RotateCcw, ArrowLeft } from 'lucide-react';
import { compressImage } from '../../services/imageUtils';

export const WALLPAPER_PRESETS = [
  {
    id: 'default',
    name: 'Liquid Dark Silk (Default)',
    type: 'default',
    preview: 'radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.12) 0%, #07090e 100%)',
    css: 'radial-gradient(circle at 18% 20%, rgba(34, 197, 94, 0.08) 0%, transparent 40%), radial-gradient(circle at 82% 80%, rgba(20, 184, 166, 0.07) 0%, transparent 45%), radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.65) 0%, transparent 85%), url(/liquid_dark_bg.jpg)'
  },
  {
    id: 'cyber-emerald',
    name: 'Cyber Neon Emerald',
    type: 'preset',
    preview: 'radial-gradient(circle at 50% 30%, #15803d 0%, #052e16 60%, #02140a 100%)',
    css: 'radial-gradient(circle at 50% 25%, rgba(34, 197, 94, 0.28) 0%, transparent 60%), radial-gradient(circle at 20% 85%, rgba(16, 185, 129, 0.2) 0%, transparent 50%), linear-gradient(180deg, #041d10 0%, #020f08 100%)'
  },
  {
    id: 'midnight-obsidian',
    name: 'Midnight Obsidian',
    type: 'preset',
    preview: 'linear-gradient(135deg, #27272a 0%, #09090b 100%)',
    css: 'radial-gradient(circle at 50% 50%, rgba(39, 39, 42, 0.4) 0%, #09090b 100%)'
  },
  {
    id: 'cosmic-nebula',
    name: 'Cosmic Nebula',
    type: 'preset',
    preview: 'radial-gradient(circle at 70% 30%, #7c3aed 0%, #312e81 60%, #030712 100%)',
    css: 'radial-gradient(circle at 70% 20%, rgba(168, 85, 247, 0.25) 0%, transparent 55%), radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.2) 0%, transparent 50%), linear-gradient(180deg, #0b0f19 0%, #030712 100%)'
  },
  {
    id: 'sunset-dusk',
    name: 'Sunset Titanium Dusk',
    type: 'preset',
    preview: 'linear-gradient(135deg, #f97316 0%, #db2777 50%, #1e1b4b 100%)',
    css: 'radial-gradient(circle at 80% 20%, rgba(249, 115, 22, 0.2) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(219, 39, 119, 0.18) 0%, transparent 50%), linear-gradient(180deg, #1c1017 0%, #09060b 100%)'
  },
  {
    id: 'ocean-abyss',
    name: 'Ocean Abyss',
    type: 'preset',
    preview: 'linear-gradient(135deg, #0284c7 0%, #0f172a 100%)',
    css: 'radial-gradient(circle at 50% 30%, rgba(14, 165, 233, 0.22) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(20, 184, 166, 0.18) 0%, transparent 50%), linear-gradient(180deg, #041624 0%, #020b12 100%)'
  },
  {
    id: 'royal-amethyst',
    name: 'Royal Amethyst',
    type: 'preset',
    preview: 'linear-gradient(135deg, #c026d3 0%, #3b0764 100%)',
    css: 'radial-gradient(circle at 60% 30%, rgba(192, 38, 211, 0.22) 0%, transparent 60%), radial-gradient(circle at 25% 75%, rgba(147, 51, 234, 0.18) 0%, transparent 50%), linear-gradient(180deg, #140722 0%, #08020d 100%)'
  },
  {
    id: 'matrix-grid',
    name: 'Matrix Grid',
    type: 'preset',
    preview: 'linear-gradient(135deg, #22c55e 0%, #000000 100%)',
    css: 'radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.15) 0%, transparent 70%), linear-gradient(0deg, rgba(0, 0, 0, 0.8) 0%, #020b05 100%)'
  },
  {
    id: 'cyberpunk-magenta',
    name: 'Cyberpunk Neon Pink',
    type: 'preset',
    preview: 'radial-gradient(circle at 50% 50%, #ec4899 0%, #831843 60%, #050505 100%)',
    css: 'radial-gradient(circle at 50% 30%, rgba(236, 72, 153, 0.3) 0%, transparent 60%), linear-gradient(180deg, #1a0612 0%, #050505 100%)'
  },
  {
    id: 'deep-space',
    name: 'Deep Space Stars',
    type: 'preset',
    preview: 'linear-gradient(135deg, #1e1b4b 0%, #020617 100%)',
    css: 'radial-gradient(circle at 75% 25%, rgba(99, 102, 241, 0.25) 0%, transparent 60%), linear-gradient(180deg, #090d16 0%, #020617 100%)'
  }
];

export default function WallpaperModal({
  isOpen,
  onClose,
  currentWallpaper,
  onSaveWallpaper,
  contactName
}) {
  const [selected, setSelected] = useState(() => currentWallpaper || WALLPAPER_PRESETS[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const fileInputRef = useRef(null);

  // Sync state if currentWallpaper changes or modal opens
  useEffect(() => {
    if (currentWallpaper) {
      setSelected(currentWallpaper);
    }
  }, [currentWallpaper, isOpen]);

  if (!isOpen) return null;

  // Handle uploading custom photo from gallery / computer
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (ev) => {
      const rawDataUrl = ev.target?.result;
      if (!rawDataUrl) {
        setIsUploading(false);
        return;
      }

      const customWp = {
        id: 'custom_' + Date.now(),
        name: 'Gallery Photo',
        type: 'custom_image',
        url: rawDataUrl
      };

      // Set and immediately apply to active chat in real time!
      setSelected(customWp);
      onSaveWallpaper && onSaveWallpaper(customWp);
      setIsUploading(false);
      setApplySuccess(true);
      setTimeout(() => setApplySuccess(false), 2000);

      // In the background, compress to preserve browser storage limits
      try {
        const compressed = await compressImage(file, 1280, 1280, 0.72);
        if (compressed && compressed !== rawDataUrl) {
          const optimizedWp = { ...customWp, url: compressed };
          setSelected(optimizedWp);
          onSaveWallpaper && onSaveWallpaper(optimizedWp);
        }
      } catch (err) {
        console.warn('Image optimization notice:', err);
      }
    };

    reader.onerror = () => {
      setIsUploading(false);
      alert('Could not read image from gallery. Please try another image.');
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Instant apply on preset click
  const handleSelectPreset = (preset) => {
    setSelected(preset);
    onSaveWallpaper && onSaveWallpaper(preset);
    setApplySuccess(true);
    setTimeout(() => setApplySuccess(false), 1200);
  };

  // Reset to default liquid dark silk
  const handleReset = () => {
    const defaultWp = WALLPAPER_PRESETS[0];
    setSelected(defaultWp);
    onSaveWallpaper && onSaveWallpaper(defaultWp);
    setApplySuccess(true);
    setTimeout(() => setApplySuccess(false), 1200);
  };

  // Done & Close
  const handleDone = () => {
    onSaveWallpaper && onSaveWallpaper(selected);
    onClose();
  };

  // Preview styling
  const previewBackground = selected?.url
    ? `url("${selected.url}")`
    : selected?.css || selected?.preview || '#07090e';

  return ReactDOM.createPortal(
    <div
      className="wa-wallpaper-portal-backdrop"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 100000,
        backgroundColor: 'rgba(3, 6, 12, 0.88)',
        backdropFilter: 'blur(28px) saturate(200%)',
        WebkitBackdropFilter: 'blur(28px) saturate(200%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 0,
        overflow: 'hidden'
      }}
    >
      <div
        className="wa-wallpaper-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(640px, 100vw)',
          height: '100vh',
          maxHeight: '100vh',
          marginTop: 0,
          background: 'rgba(11, 16, 26, 0.98)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 0,
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          boxShadow: '0 0 80px rgba(0, 0, 0, 0.95)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'waFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Top Header with Prominent Back to Chat Button (Docked right to top) */}
        <div
          style={{
            height: 64,
            minHeight: 64,
            padding: '0 16px',
            borderBottom: '1.5px solid rgba(255, 255, 255, 0.12)',
            background: 'rgba(16, 23, 36, 0.98)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexShrink: 0,
            zIndex: 10
          }}
        >
          {/* Back Button with Text and Arrow */}
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              background: 'rgba(34, 197, 94, 0.18)',
              border: '1.5px solid rgba(74, 222, 128, 0.45)',
              borderRadius: 22,
              color: '#4ade80',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 10px rgba(34, 197, 94, 0.25)'
            }}
            title="Back to chat"
          >
            <ArrowLeft size={19} />
            <span>Back to Chat</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Palette size={19} color="#4ade80" />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px' }}>
              Chat Wallpaper
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '18px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18
          }}
        >
          {/* Live Mini Preview Box */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Live Chat Preview
              </span>
              {applySuccess && (
                <span style={{ fontSize: 12, fontWeight: 600, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Check size={14} /> Applied to Chat!
                </span>
              )}
            </div>

            <div
              style={{
                height: 130,
                borderRadius: 18,
                background: previewBackground,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                overflow: 'hidden',
                border: '1.5px solid rgba(255, 255, 255, 0.14)',
                boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '12px 14px'
              }}
            >
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(5, 7, 10, 0.35)', pointerEvents: 'none' }} />

              {/* Sample Incoming Bubble */}
              <div style={{ position: 'relative', zIndex: 1, alignSelf: 'flex-start', maxWidth: '75%' }}>
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 14,
                    borderBottomLeftRadius: 3,
                    padding: '6px 12px',
                    fontSize: 12,
                    color: '#f1f5f9',
                    backdropFilter: 'blur(12px)'
                  }}
                >
                  Hey, do you like this wallpaper? ✨
                </div>
              </div>

              {/* Sample Outgoing Bubble */}
              <div style={{ position: 'relative', zIndex: 1, alignSelf: 'flex-end', maxWidth: '75%' }}>
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(20, 83, 45, 0.9) 0%, rgba(15, 65, 38, 0.95) 100%)',
                    border: '1px solid rgba(74, 222, 128, 0.35)',
                    borderRadius: 14,
                    borderBottomRightRadius: 3,
                    padding: '6px 12px',
                    fontSize: 12,
                    color: '#f0fdf4',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                  }}
                >
                  Yes! Looks super clean and premium 🔥
                </div>
              </div>

              {/* Theme Name Badge */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  alignSelf: 'center',
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(8px)',
                  padding: '2px 10px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#4ade80',
                  border: '1px solid rgba(74, 222, 128, 0.3)'
                }}
              >
                {selected?.name}
              </div>
            </div>
          </div>

          {/* Upload Custom Image from Gallery */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={14} />
              <span>Choose from Gallery / Photos</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              style={{ display: 'none' }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                width: '100%',
                padding: '14px 18px',
                borderRadius: 18,
                background: selected?.type === 'custom_image'
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.22) 0%, rgba(16, 185, 129, 0.12) 100%)'
                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%)',
                border: selected?.type === 'custom_image' ? '1.5px solid #22c55e' : '1.5px dashed rgba(255, 255, 255, 0.24)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                transition: 'all 0.2s ease',
                boxShadow: selected?.type === 'custom_image' ? '0 0 20px rgba(34, 197, 94, 0.3)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'rgba(34, 197, 94, 0.2)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#4ade80',
                    flexShrink: 0
                  }}
                >
                  <ImageIcon size={22} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                    {isUploading ? 'Loading Photo...' : selected?.type === 'custom_image' ? '✓ Custom Photo Selected' : 'Upload Photo from Gallery'}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginTop: 2 }}>
                    {selected?.type === 'custom_image' ? 'Tap to change photo' : 'Select any image from your phone or PC'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: 12,
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.35)',
                  color: '#4ade80',
                  fontSize: 12.5,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Upload size={14} />
                <span>{selected?.type === 'custom_image' ? 'Change' : 'Browse'}</span>
              </div>
            </button>
          </div>

          {/* Curated Presets Grid */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Curated Liquid Themes (Tap to Apply Instantly)
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 10
              }}
            >
              {WALLPAPER_PRESETS.map((preset) => {
                const isCurrent = selected?.id === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        borderRadius: 16,
                        background: preset.preview,
                        backgroundSize: 'cover',
                        border: isCurrent ? '2.5px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.12)',
                        boxShadow: isCurrent ? '0 0 18px rgba(34, 197, 94, 0.5)' : 'none',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    >
                      {isCurrent && (
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            backgroundColor: '#22c55e',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                          }}
                        >
                          <Check size={15} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: isCurrent ? '#4ade80' : 'rgba(255,255,255,0.7)',
                        fontWeight: isCurrent ? 700 : 400,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%'
                      }}
                    >
                      {preset.name.split(' (')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'rgba(11, 16, 24, 0.95)',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '9px 14px',
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.75)',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RotateCcw size={14} />
            <span>Reset Default</span>
          </button>

          <button
            type="button"
            onClick={handleDone}
            style={{
              padding: '10px 22px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: 13.5,
              fontWeight: 700,
              boxShadow: '0 4px 16px rgba(34, 197, 94, 0.45)',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Check size={16} strokeWidth={3} />
            <span>Done & Back to Chat</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
