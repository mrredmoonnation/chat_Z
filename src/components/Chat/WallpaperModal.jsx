import React, { useState, useRef } from 'react';
import { Palette, Image as ImageIcon, Sparkles, Check, X, Upload, RotateCcw } from 'lucide-react';
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
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const compressedDataUrl = await compressImage(file, 1280, 1280, 0.75);
      const customWp = {
        id: 'custom_' + Date.now(),
        name: 'Custom Photo',
        type: 'custom_image',
        url: compressedDataUrl
      };
      setSelected(customWp);
    } catch (err) {
      console.warn('Failed to compress image:', err);
      alert('Could not load image. Please select another image.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApply = () => {
    onSaveWallpaper(selected);
    onClose();
  };

  const handleReset = () => {
    const defaultWp = WALLPAPER_PRESETS[0];
    setSelected(defaultWp);
    onSaveWallpaper(defaultWp);
    onClose();
  };

  // Preview styling
  const previewBackground = selected?.url
    ? `url(${selected.url})`
    : selected?.css || selected?.preview || '#07090e';

  return (
    <div className="wa-modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="wa-wallpaper-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 94vw)',
          maxHeight: '90vh',
          background: 'rgba(16, 21, 30, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 28,
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          boxShadow: '0 30px 90px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'waFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#4ade80',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Palette size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>
                Chat Theme & Wallpaper
              </h3>
              <p style={{ margin: 0, fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                Custom for {contactName || 'this chat'} • Syncs for both users
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}
        >
          {/* Live Mini Preview Box */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Live Preview
            </div>
            <div
              style={{
                height: 140,
                borderRadius: 20,
                background: previewBackground,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '14px 16px'
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
                    fontSize: 12.5,
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
                    fontSize: 12.5,
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
                  background: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(8px)',
                  padding: '2px 10px',
                  borderRadius: 12,
                  fontSize: 10.5,
                  color: '#4ade80',
                  border: '1px solid rgba(74, 222, 128, 0.3)'
                }}
              >
                {selected?.name}
              </div>
            </div>
          </div>

          {/* Upload Custom Image Button */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Custom Photo
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
                padding: '12px 16px',
                borderRadius: 16,
                background: selected?.type === 'custom_image' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: selected?.type === 'custom_image' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px dashed rgba(255, 255, 255, 0.18)',
                color: selected?.type === 'custom_image' ? '#4ade80' : 'rgba(255, 255, 255, 0.85)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontSize: 13.5,
                fontWeight: 600,
                transition: 'all 0.2s ease'
              }}
            >
              <Upload size={17} />
              <span>{isUploading ? 'Compressing Image...' : selected?.type === 'custom_image' ? 'Custom Photo Selected (Click to change)' : 'Upload from Device (Photos, Wallpapers)'}</span>
            </button>
          </div>

          {/* Curated Presets Grid */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              Curated Liquid Themes
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
                    onClick={() => setSelected(preset)}
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
                        border: isCurrent ? '2px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: isCurrent ? '0 0 16px rgba(34, 197, 94, 0.4)' : 'none',
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
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            backgroundColor: '#22c55e',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                          }}
                        >
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        color: isCurrent ? '#4ade80' : 'rgba(255,255,255,0.65)',
                        fontWeight: isCurrent ? 600 : 400,
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
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'rgba(10, 14, 20, 0.5)'
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: '9px 14px',
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.65)',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <RotateCcw size={14} />
            <span>Reset Default</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: 14,
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: 'rgba(255, 255, 255, 0.8)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              style={{
                padding: '9px 20px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                boxShadow: '0 4px 16px rgba(34, 197, 94, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Sparkles size={15} />
              <span>Apply for Both</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
