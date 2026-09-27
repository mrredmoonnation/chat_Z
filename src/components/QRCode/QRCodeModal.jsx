import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  X, QrCode, ScanLine, Share2, Download, 
  Camera, Image as ImageIcon, RefreshCw, FlipHorizontal, 
  Check, AlertCircle, Copy, Sparkles, UserCheck
} from 'lucide-react';
import { sounds } from '../../services/audioEffects';
import { cleanUsername, getRegisteredUsernames } from '../../services/store';
import { searchFirestoreUsers } from '../../services/firestoreChat';
import { fetchCloudUsers } from '../../services/cloudRegistry';

/**
 * Robust QR text parser supporting:
 * 1. JSON profile payloads: { type: 'baatchit_profile', username, name, uid, avatar, about, phone }
 * 2. Deep link URLs: https://domain/?chat=username&name=... or #chat=...
 * 3. Plain handles: @username or username
 */
export function parseScannedQR(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  // 1. JSON payload
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('{"') && trimmed.endsWith('"}'))) {
    try {
      const data = JSON.parse(trimmed);
      if (data.username || data.uid || data.name || data.id) {
        const uName = cleanUsername(data.username || data.displayName || data.name || '');
        return {
          username: uName,
          name: data.name || data.displayName || data.username || 'Friend',
          uid: data.uid || data.id || null,
          avatar: data.avatar || data.photoURL || null,
          about: data.about || 'Hey there! I am using baat chit',
          phone: data.phone || '',
          email: data.email || ''
        };
      }
    } catch {
      // not JSON
    }
  }

  // 2. Deep link URL
  try {
    const urlObj = new URL(trimmed, window.location.origin);
    const searchParams = urlObj.searchParams;
    const chatParam = searchParams.get('chat') || searchParams.get('user') || searchParams.get('u');
    if (chatParam) {
      const uName = cleanUsername(chatParam);
      return {
        username: uName,
        name: searchParams.get('name') || uName,
        uid: searchParams.get('uid') || null,
        avatar: searchParams.get('avatar') || null,
        about: searchParams.get('about') || 'Hey there! I am using baat chit',
        phone: searchParams.get('phone') || '',
        email: searchParams.get('email') || ''
      };
    }
  } catch {
    // not valid URL
  }

  // 3. Plain handle e.g. @username or pure handle
  if (trimmed.startsWith('@')) {
    const u = cleanUsername(trimmed.substring(1));
    if (u) {
      return { username: u, name: u, about: 'Hey there! I am using baat chit' };
    }
  }

  if (/^[a-zA-Z0-9_.-]{3,30}$/.test(trimmed)) {
    const u = cleanUsername(trimmed);
    if (u) {
      return { username: u, name: u, about: 'Hey there! I am using baat chit' };
    }
  }

  return null;
}

export default function QRCodeModal({
  isOpen,
  onClose,
  currentUser,
  onConnectWithUser,
  theme = 'dark',
  initialTab = 'myCode'
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'myCode' | 'scanCode'

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [scanStatus, setScanStatus] = useState({ type: '', message: '' }); // 'success', 'error', 'info'
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [camerasList, setCamerasList] = useState([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const scannerContainerId = 'baatchit-scanner-view';

  // Construct sharing URL and QR payload
  const currentUsername = cleanUsername(currentUser?.username || '');
  const displayName = currentUser?.name || currentUser?.displayName || currentUsername || 'User';
  
  const shareableUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?chat=${encodeURIComponent(currentUsername || currentUser?.uid || '')}&name=${encodeURIComponent(displayName)}`
    : '';

  // Generate QR Code image when modal opens or user info changes
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const qrPayload = JSON.stringify({
      type: 'baatchit_profile',
      version: 1,
      uid: currentUser.uid || currentUser.id || null,
      username: currentUsername,
      name: displayName,
      avatar: currentUser.avatar || currentUser.photoURL || '',
      about: currentUser.about || 'Hey there! I am using baat chit',
      phone: currentUser.phone || '',
      url: shareableUrl
    });

    QRCode.toDataURL(qrPayload, {
      width: 420,
      margin: 1.5,
      color: {
        dark: '#111b21',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.warn('QR Code generation error:', err));
  }, [isOpen, currentUser, currentUsername, displayName, shareableUrl]);

  // Handle Camera Scanner Lifecycle
  useEffect(() => {
    if (!isOpen || activeTab !== 'scanCode') {
      stopCamera();
      return;
    }

    // Small delay to ensure the DOM node is rendered
    const timer = setTimeout(() => {
      startCamera();
    }, 200);

    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen, activeTab, selectedCameraIndex]);

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      html5QrCodeRef.current = null;
      setIsCameraActive(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setScanStatus({ type: '', message: '' });

    const elem = document.getElementById(scannerContainerId);
    if (!elem) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerContainerId);
      }

      // Check available video inputs
      let cameras = camerasList;
      if (cameras.length === 0) {
        try {
          cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            setCamerasList(cameras);
          }
        } catch (e) {
          console.warn('Unable to query camera list, fallback to environment mode:', e);
        }
      }

      const cameraConfig = cameras && cameras.length > 0
        ? { deviceId: { exact: cameras[selectedCameraIndex % cameras.length].id } }
        : { facingMode: 'environment' };

      const scanConfig = {
        fps: 12,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrEdge = Math.max(180, Math.floor(minEdge * 0.72));
          return { width: qrEdge, height: qrEdge };
        },
        aspectRatio: 1.0
      };

      await html5QrCodeRef.current.start(
        cameraConfig,
        scanConfig,
        (decodedText) => handleScanSuccess(decodedText),
        () => {
          // Frame by frame scanner tick; silently ignore until decoded
        }
      );

      setIsCameraActive(true);
    } catch (err) {
      console.warn('Camera start error:', err);
      setIsCameraActive(false);
      setCameraError(err?.message || 'Unable to access camera. Please allow camera permissions or upload a QR image.');
    }
  };

  const handleFlipCamera = async () => {
    if (camerasList.length > 1) {
      await stopCamera();
      setSelectedCameraIndex((prev) => (prev + 1) % camerasList.length);
    }
  };

  // Process decoded QR text
  const handleScanSuccess = async (decodedText) => {
    if (isProcessingScan) return;
    setIsProcessingScan(true);

    try {
      const parsed = parseScannedQR(decodedText);
      if (!parsed || (!parsed.username && !parsed.uid && !parsed.name)) {
        setScanStatus({
          type: 'error',
          message: 'Invalid Baat Chit QR code. Please scan a valid profile code.'
        });
        setIsProcessingScan(false);
        return;
      }

      // Prevent scanning own QR code
      const isSelf = (currentUsername && parsed.username && currentUsername.toLowerCase() === parsed.username.toLowerCase()) ||
        (currentUser?.uid && parsed.uid && currentUser.uid === parsed.uid);

      if (isSelf) {
        setScanStatus({
          type: 'error',
          message: '⚠️ This is your own QR code! Scan a friend’s code to chat.'
        });
        sounds.playMessageReceived();
        setIsProcessingScan(false);
        return;
      }

      // Play success chime
      sounds.playMessageSent();
      setScanStatus({
        type: 'success',
        message: `✓ Found ${parsed.name || parsed.username}! Opening chat...`
      });

      // Stop camera before closing
      await stopCamera();

      // Resolve user from Firestore or Cloud registry for complete live metadata
      let resolvedUser = { ...parsed };
      try {
        if (parsed.username) {
          const firestoreMatches = await searchFirestoreUsers(parsed.username);
          const match = firestoreMatches.find(
            (u) => cleanUsername(u.username) === cleanUsername(parsed.username)
          );
          if (match) {
            resolvedUser = { ...match, ...resolvedUser };
          }
        }
      } catch (err) {
        console.warn('Firestore user lookup error:', err);
      }

      setTimeout(() => {
        if (onConnectWithUser) {
          onConnectWithUser(resolvedUser);
        }
        setIsProcessingScan(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Scan error:', err);
      setScanStatus({
        type: 'error',
        message: 'Could not process QR code. Try again.'
      });
      setIsProcessingScan(false);
    }
  };

  // Scan from photo / image file
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanStatus({ type: 'info', message: 'Analyzing image...' });
    try {
      let scanner = html5QrCodeRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(scannerContainerId);
        html5QrCodeRef.current = scanner;
      }
      const decodedText = await scanner.scanFile(file, true);
      handleScanSuccess(decodedText);
    } catch (err) {
      console.warn('File scan failed:', err);
      setScanStatus({
        type: 'error',
        message: 'No QR code found in this photo. Please try a clearer image.'
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Copy shareable chat link
  const handleCopyLink = () => {
    if (!shareableUrl) return;
    navigator.clipboard?.writeText(shareableUrl);
    setCopiedLink(true);
    sounds.playMessageSent();
    setTimeout(() => setCopiedLink(false), 2200);
  };

  // Download QR Code PNG
  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `baatchit-qr-${currentUsername || 'user'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Native share if supported
  const handleNativeShare = async () => {
    if (navigator.share && shareableUrl) {
      try {
        await navigator.share({
          title: `Connect with ${displayName} on Baat Chit`,
          text: `Scan my QR code or tap this link to message me on Baat Chit:`,
          url: shareableUrl
        });
      } catch (err) {
        // Fallback to copy if user canceled share
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="wa-modal-backdrop" onClick={onClose} style={{ zIndex: 4000 }}>
      <div 
        className="wa-qr-modal-wrapper"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 94vw)',
          backgroundColor: 'var(--wa-bg-panel, #111b21)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          border: '1px solid var(--wa-border, rgba(255,255,255,0.08))',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
          animation: 'waModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Modal Top Header */}
        <div 
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--wa-border, rgba(255,255,255,0.08))',
            backgroundColor: 'var(--wa-bg-panel-secondary, #202c33)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div 
              style={{ 
                width: 32, 
                height: 32, 
                borderRadius: '50%', 
                background: 'rgba(0, 168, 132, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--wa-green-light, #00a884)'
              }}
            >
              <QrCode size={18} />
            </div>
            <span style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px' }}>
              QR code
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {activeTab === 'myCode' && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="wa-icon-btn wa-circle-action-btn"
                title="Share QR Code Link"
                aria-label="Share QR Code"
                style={{ color: '#ffffff', cursor: 'pointer' }}
              >
                <Share2 size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="wa-icon-btn wa-circle-action-btn"
              title="Close"
              aria-label="Close"
              style={{ color: '#ffffff', cursor: 'pointer' }}
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* WhatsApp-style Tab Switcher */}
        <div 
          style={{
            display: 'flex',
            padding: '8px 16px',
            backgroundColor: 'var(--wa-bg-panel, #111b21)',
            borderBottom: '1px solid var(--wa-border, rgba(255,255,255,0.06))'
          }}
        >
          <div 
            style={{
              display: 'flex',
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '10px',
              padding: '3px'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('myCode')}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'myCode' ? 'var(--wa-green-primary, #00a884)' : 'transparent',
                color: activeTab === 'myCode' ? '#ffffff' : 'var(--wa-text-secondary, #8696a0)',
                fontWeight: activeTab === 'myCode' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                transition: 'all 0.18s ease'
              }}
            >
              <QrCode size={16} />
              <span>My code</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('scanCode')}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'scanCode' ? 'var(--wa-green-primary, #00a884)' : 'transparent',
                color: activeTab === 'scanCode' ? '#ffffff' : 'var(--wa-text-secondary, #8696a0)',
                fontWeight: activeTab === 'scanCode' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                transition: 'all 0.18s ease'
              }}
            >
              <ScanLine size={16} />
              <span>Scan code</span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div 
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1
          }}
        >
          {/* TAB 1: MY QR CODE */}
          {activeTab === 'myCode' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* WhatsApp Signature Card */}
              <div 
                style={{
                  width: '100%',
                  maxWidth: 320,
                  backgroundColor: '#ffffff',
                  borderRadius: 20,
                  padding: '24px 20px 20px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  position: 'relative'
                }}
              >
                {/* User Avatar with outer ring */}
                <div 
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    border: '4px solid #ffffff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    overflow: 'hidden',
                    backgroundColor: '#e9edef',
                    marginBottom: 10
                  }}
                >
                  {(currentUser?.avatar || currentUser?.photoURL) ? (
                    <img 
                      src={currentUser.avatar || currentUser.photoURL} 
                      alt={displayName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUsername || 'user'}`;
                      }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#111b21' }}>
                      {(displayName[0] || 'U').toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Display Name & Handle */}
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#111b21', letterSpacing: '-0.3px', marginBottom: 2 }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '12.5px', color: '#667781', fontWeight: 500, marginBottom: 16 }}>
                  {currentUsername ? `@${currentUsername}` : 'Baat Chit contact'}
                </div>

                {/* QR Code Container with Center Badge */}
                <div 
                  style={{
                    position: 'relative',
                    width: 230,
                    height: 230,
                    backgroundColor: '#ffffff',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {qrDataUrl ? (
                    <img 
                      src={qrDataUrl} 
                      alt="My Baat Chit QR Code"
                      style={{ width: '100%', height: '100%', borderRadius: 8, display: 'block' }} 
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#667781', fontSize: 13 }}>
                      Generating QR...
                    </div>
                  )}

                  {/* Centered App Icon Badge in QR Code */}
                  <div 
                    style={{
                      position: 'absolute',
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 3
                    }}
                  >
                    <div 
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        backgroundColor: '#00a884',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        fontSize: 16,
                        fontWeight: 800
                      }}
                    >
                      💬
                    </div>
                  </div>
                </div>
              </div>

              {/* Explanatory text */}
              <p 
                style={{ 
                  fontSize: '12px', 
                  color: 'var(--wa-text-secondary, #8696a0)', 
                  textAlign: 'center',
                  lineHeight: '1.45',
                  marginTop: 16,
                  marginBottom: 16,
                  maxWidth: 300
                }}
              >
                Your QR code is private. If you share it with someone, they can scan it with their camera to message you directly on Baat Chit.
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 320 }}>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--wa-border, rgba(255,255,255,0.12))',
                    backgroundColor: copiedLink ? 'rgba(0,168,132,0.15)' : 'var(--wa-bg-panel-secondary, #202c33)',
                    color: copiedLink ? 'var(--wa-green-light, #00a884)' : '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadQR}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: 'none',
                    backgroundColor: 'var(--wa-green-primary, #00a884)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Download size={16} />
                  <span>Save QR</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SCAN CODE */}
          {activeTab === 'scanCode' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Scanner Viewport with WhatsApp-style overlay */}
              <div 
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 320,
                  height: 300,
                  backgroundColor: '#000000',
                  borderRadius: 16,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                {/* HTML5 QR Container */}
                <div 
                  id={scannerContainerId} 
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    position: 'absolute',
                    inset: 0,
                    overflow: 'hidden'
                  }} 
                />

                {/* Laser scan animation overlay */}
                {isCameraActive && !cameraError && (
                  <div 
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {/* Viewfinder box with WhatsApp green corner brackets */}
                    <div 
                      style={{
                        position: 'relative',
                        width: 210,
                        height: 210,
                        borderRadius: 16,
                        boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.45)'
                      }}
                    >
                      {/* Top-Left Corner */}
                      <div style={{ position: 'absolute', top: -2, left: -2, width: 24, height: 24, borderTop: '4px solid #00a884', borderLeft: '4px solid #00a884', borderTopLeftRadius: 10 }} />
                      {/* Top-Right Corner */}
                      <div style={{ position: 'absolute', top: -2, right: -2, width: 24, height: 24, borderTop: '4px solid #00a884', borderRight: '4px solid #00a884', borderTopRightRadius: 10 }} />
                      {/* Bottom-Left Corner */}
                      <div style={{ position: 'absolute', bottom: -2, left: -2, width: 24, height: 24, borderBottom: '4px solid #00a884', borderLeft: '4px solid #00a884', borderBottomLeftRadius: 10 }} />
                      {/* Bottom-Right Corner */}
                      <div style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderBottom: '4px solid #00a884', borderRight: '4px solid #00a884', borderBottomRightRadius: 10 }} />

                      {/* Moving Laser Beam */}
                      <div 
                        className="wa-scanner-laser"
                        style={{
                          position: 'absolute',
                          left: 4,
                          right: 4,
                          height: 2.5,
                          background: 'linear-gradient(90deg, transparent, #00a884, #25d366, #00a884, transparent)',
                          boxShadow: '0 0 12px #25d366',
                          borderRadius: 2
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Camera fallback / Permission request view */}
                {(!isCameraActive || cameraError) && (
                  <div 
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'var(--wa-bg-panel-secondary, #1f2c34)',
                      padding: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      zIndex: 10
                    }}
                  >
                    <div 
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--wa-text-secondary, #8696a0)',
                        marginBottom: 12
                      }}
                    >
                      <Camera size={26} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: 6 }}>
                      {cameraError ? 'Camera unavailable' : 'Starting camera...'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--wa-text-secondary, #8696a0)', lineHeight: '1.4', marginBottom: 14 }}>
                      {cameraError || 'Hold your camera up to a Baat Chit QR code to scan it.'}
                    </div>

                    <button
                      type="button"
                      onClick={startCamera}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: 'none',
                        backgroundColor: 'var(--wa-green-primary, #00a884)',
                        color: '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <RefreshCw size={14} />
                      <span>Retry Camera</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Status or Toast Message */}
              {scanStatus.message && (
                <div 
                  style={{
                    marginTop: 14,
                    padding: '8px 14px',
                    borderRadius: 8,
                    fontSize: '12.5px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    maxWidth: 320,
                    backgroundColor: scanStatus.type === 'error' ? 'rgba(234, 67, 53, 0.15)' :
                      scanStatus.type === 'success' ? 'rgba(0, 168, 132, 0.2)' : 'rgba(255,255,255,0.08)',
                    color: scanStatus.type === 'error' ? '#ea4335' :
                      scanStatus.type === 'success' ? 'var(--wa-green-light, #00a884)' : '#ffffff',
                    border: `1px solid ${scanStatus.type === 'error' ? 'rgba(234, 67, 53, 0.3)' :
                      scanStatus.type === 'success' ? 'rgba(0, 168, 132, 0.3)' : 'rgba(255,255,255,0.1)'}`
                  }}
                >
                  {scanStatus.type === 'error' ? <AlertCircle size={16} /> :
                    scanStatus.type === 'success' ? <UserCheck size={16} /> : <Sparkles size={16} />}
                  <span>{scanStatus.message}</span>
                </div>
              )}

              {/* Instructions */}
              <p 
                style={{ 
                  fontSize: '12px', 
                  color: 'var(--wa-text-secondary, #8696a0)', 
                  textAlign: 'center',
                  marginTop: 14,
                  marginBottom: 14,
                  maxWidth: 300,
                  lineHeight: '1.45'
                }}
              >
                Position the QR code inside the viewfinder to scan. You can also upload a photo from your gallery.
              </p>

              {/* Scanner Control Buttons */}
              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 320 }}>
                {camerasList.length > 1 && (
                  <button
                    type="button"
                    onClick={handleFlipCamera}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--wa-border, rgba(255,255,255,0.12))',
                      backgroundColor: 'var(--wa-bg-panel-secondary, #202c33)',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <FlipHorizontal size={16} />
                    <span>Flip Cam</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--wa-border, rgba(255,255,255,0.12))',
                    backgroundColor: 'var(--wa-bg-panel-secondary, #202c33)',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <ImageIcon size={16} />
                  <span>Scan Image</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
