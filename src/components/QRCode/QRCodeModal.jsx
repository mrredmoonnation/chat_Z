import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  X, QrCode, ScanLine, Share2, Download, 
  Camera, Image as ImageIcon, RefreshCw, FlipHorizontal, 
  Check, AlertCircle, Copy, Sparkles, UserCheck, ArrowRight
} from 'lucide-react';
import { sounds } from '../../services/audioEffects';
import { cleanUsername, getStoredUser } from '../../services/store';
import { searchFirestoreUsers } from '../../services/firestoreChat';

/**
 * Robust QR text parser supporting:
 * 1. JSON profile payloads: { type: 'baatchit_profile', username, name, uid, avatar, about, phone }
 * 2. Deep link URLs: https://domain/?chat=username&name=... or #chat=...
 * 3. Plain handles: @username or username
 */
function parseScannedQR(text) {
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
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [scanStatus, setScanStatus] = useState({ type: '', message: '' }); // 'success', 'error', 'info'
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [camerasList, setCamerasList] = useState([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const scannerContainerId = 'baatchit-scanner-view';

  // Sync tab whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'myCode');
      setScanStatus({ type: '', message: '' });
      setIsProcessingScan(false);
    }
  }, [isOpen, initialTab]);

  // Construct active user with fallback to localStorage
  const activeUser = currentUser || getStoredUser() || {};
  const currentUsername = cleanUsername(activeUser?.username || '') ||
    (activeUser?.phone ? activeUser.phone.replace(/[^0-9]/g, '') : '') ||
    activeUser?.uid || activeUser?.id || 'user';
  const displayName = activeUser?.name || activeUser?.displayName || currentUsername || 'User';
  
  const shareableUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?chat=${encodeURIComponent(currentUsername)}${displayName ? `&name=${encodeURIComponent(displayName)}` : ''}${activeUser?.uid ? `&uid=${encodeURIComponent(activeUser.uid)}` : ''}`
    : '';

  // Generate QR Code image when modal opens or user info changes
  useEffect(() => {
    if (!isOpen) return;

    // Use clean URL as QR payload (instant generation, ultra-lightweight, 100% reliable across all devices)
    const payload = shareableUrl || (typeof window !== 'undefined' ? `${window.location.origin}/?chat=${encodeURIComponent(currentUsername)}` : `https://baatchit.web.app/?chat=${encodeURIComponent(currentUsername)}`);

    QRCode.toDataURL(payload, {
      width: 420,
      margin: 1.5,
      color: {
        dark: '#111b21',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => {
        console.warn('QR Code generation with H error, retrying with M:', err);
        QRCode.toDataURL(payload, {
          width: 420,
          margin: 1.5,
          color: { dark: '#111b21', light: '#ffffff' },
          errorCorrectionLevel: 'M'
        })
          .then((url) => setQrDataUrl(url))
          .catch((e) => console.error('QR Fallback error:', e));
      });
  }, [isOpen, activeUser?.username, activeUser?.uid, currentUsername, displayName, shareableUrl]);

  // Handle Camera Scanner Lifecycle
  useEffect(() => {
    if (!isOpen || activeTab !== 'scanCode') {
      stopCamera();
      return;
    }

    // Small delay to ensure container DOM element is rendered
    const timer = setTimeout(() => {
      startCamera();
    }, 250);

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
      setIsCameraStarting(false);
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    setIsCameraStarting(true);
    setScanStatus({ type: '', message: '' });

    const elem = document.getElementById(scannerContainerId);
    if (!elem) {
      setIsCameraStarting(false);
      return;
    }

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
          console.warn('Unable to query camera devices, will use constraints:', e);
        }
      }

      const scanConfig = {
        fps: 12,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrEdge = Math.max(180, Math.floor(minEdge * 0.72));
          return { width: qrEdge, height: qrEdge };
        },
        aspectRatio: 1.0
      };

      const onScanTick = (decodedText) => {
        handleScanSuccess(decodedText);
      };

      // Smart camera start:
      // If user selected camera deviceId, use it.
      // Otherwise try 'environment' (back camera for mobile).
      // If that fails (e.g. laptop webcam has only front camera), fallback to 'user'.
      let started = false;
      if (cameras && cameras.length > 0) {
        try {
          const camId = cameras[selectedCameraIndex % cameras.length].id;
          await html5QrCodeRef.current.start(
            { deviceId: { exact: camId } },
            scanConfig,
            onScanTick,
            () => {}
          );
          started = true;
        } catch (deviceErr) {
          console.warn('Selected device camera failed, attempting facingMode fallback:', deviceErr);
        }
      }

      if (!started) {
        try {
          await html5QrCodeRef.current.start(
            { facingMode: 'environment' },
            scanConfig,
            onScanTick,
            () => {}
          );
          started = true;
        } catch (envErr) {
          console.warn('Environment camera failed, retrying with user/default camera:', envErr);
          await html5QrCodeRef.current.start(
            { facingMode: 'user' },
            scanConfig,
            onScanTick,
            () => {}
          );
          started = true;
        }
      }

      setIsCameraActive(true);
      setIsCameraStarting(false);
    } catch (err) {
      console.warn('Camera start error:', err);
      setIsCameraActive(false);
      setIsCameraStarting(false);
      setCameraError(
        err?.message || 'Camera permission denied or camera not found. You can also upload a photo/screenshot of a QR code to scan!'
      );
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
          message: 'Invalid QR code. Please scan a Baat Chit profile code.'
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
        message: `✓ Connected with ${parsed.name || parsed.username}! Opening chat...`
      });

      // Stop camera before closing
      await stopCamera();

      // Resolve user from Firestore for live metadata
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
        console.warn('Firestore lookup fallback:', err);
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

    setScanStatus({ type: 'info', message: 'Analyzing photo...' });
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
        message: 'No QR code found in this photo. Please try another image.'
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
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  if (!isOpen) return null;

  // Render modal on top of entire application using React Portal directly into body!
  return ReactDOM.createPortal(
    <div 
      className="wa-modal-backdrop" 
      onClick={onClose} 
      style={{ 
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 9999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
    >
      <div 
        className="wa-qr-modal-wrapper"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 94vw)',
          backgroundColor: '#111b21',
          color: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92dvh',
          animation: 'waModalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative'
        }}
      >
        {/* Modal Top Header */}
        <div 
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#202c33'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div 
              style={{ 
                width: 34, 
                height: 34, 
                borderRadius: '50%', 
                background: 'rgba(0, 168, 132, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00a884'
              }}
            >
              <QrCode size={19} />
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px' }}>
                QR code
              </div>
              <div style={{ fontSize: '11px', color: '#8696a0' }}>
                Baat Chit Contact & Chat
              </div>
            </div>
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
              <X size={20} />
            </button>
          </div>
        </div>

        {/* WhatsApp-style Tab Switcher */}
        <div 
          style={{
            display: 'flex',
            padding: '10px 16px',
            backgroundColor: '#111b21',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div 
            style={{
              display: 'flex',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '4px'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('myCode')}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '9px',
                border: 'none',
                background: activeTab === 'myCode' ? '#00a884' : 'transparent',
                color: activeTab === 'myCode' ? '#ffffff' : '#8696a0',
                fontWeight: activeTab === 'myCode' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.18s ease'
              }}
            >
              <QrCode size={17} />
              <span>My code</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('scanCode')}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '9px',
                border: 'none',
                background: activeTab === 'scanCode' ? '#00a884' : 'transparent',
                color: activeTab === 'scanCode' ? '#ffffff' : '#8696a0',
                fontWeight: activeTab === 'scanCode' ? 700 : 500,
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.18s ease'
              }}
            >
              <Camera size={17} />
              <span>Scan code (Camera)</span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div 
          style={{
            padding: '20px 16px',
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
                  borderRadius: 22,
                  padding: '24px 20px 20px',
                  boxShadow: '0 14px 34px rgba(0, 0, 0, 0.4)',
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
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
                    overflow: 'hidden',
                    backgroundColor: '#e9edef',
                    marginBottom: 10
                  }}
                >
                  {(activeUser?.avatar || activeUser?.photoURL) ? (
                    <img 
                      src={activeUser.avatar || activeUser.photoURL} 
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
                <div style={{ fontSize: '12.5px', color: '#667781', fontWeight: 600, marginBottom: 16 }}>
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
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
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
                  color: '#8696a0', 
                  textAlign: 'center',
                  lineHeight: '1.45',
                  marginTop: 14,
                  marginBottom: 14,
                  maxWidth: 310
                }}
              >
                Aapka QR code private hai. Agar aap ise kisi ke sath share karenge, toh woh ise scan karke direct aapse chat kar sakte hain.
              </p>

              {/* Direct Open Camera Scanner CTA Button */}
              <button
                type="button"
                onClick={() => setActiveTab('scanCode')}
                style={{
                  width: '100%',
                  maxWidth: 320,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: 'none',
                  backgroundColor: '#00a884',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginBottom: 10,
                  boxShadow: '0 4px 14px rgba(0, 168, 132, 0.35)',
                  transition: 'all 0.2s ease'
                }}
              >
                <Camera size={18} />
                <span>Camera Se Scan Karein</span>
                <ArrowRight size={16} />
              </button>

              {/* Action Buttons: Copy Link & Download QR */}
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
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: copiedLink ? 'rgba(0, 168, 132, 0.2)' : '#202c33',
                    color: copiedLink ? '#00a884' : '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
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
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: '#202c33',
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

          {/* TAB 2: SCAN CODE (CAMERA SCANNER) */}
          {activeTab === 'scanCode' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Scanner Viewport with WhatsApp-style overlay */}
              <div 
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 320,
                  height: 310,
                  backgroundColor: '#000000',
                  borderRadius: 18,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
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
                        width: 220,
                        height: 220,
                        borderRadius: 16,
                        boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.45)'
                      }}
                    >
                      {/* Top-Left Corner */}
                      <div style={{ position: 'absolute', top: -2, left: -2, width: 26, height: 26, borderTop: '4px solid #00a884', borderLeft: '4px solid #00a884', borderTopLeftRadius: 12 }} />
                      {/* Top-Right Corner */}
                      <div style={{ position: 'absolute', top: -2, right: -2, width: 26, height: 26, borderTop: '4px solid #00a884', borderRight: '4px solid #00a884', borderTopRightRadius: 12 }} />
                      {/* Bottom-Left Corner */}
                      <div style={{ position: 'absolute', bottom: -2, left: -2, width: 26, height: 26, borderBottom: '4px solid #00a884', borderLeft: '4px solid #00a884', borderBottomLeftRadius: 12 }} />
                      {/* Bottom-Right Corner */}
                      <div style={{ position: 'absolute', bottom: -2, right: -2, width: 26, height: 26, borderBottom: '4px solid #00a884', borderRight: '4px solid #00a884', borderBottomRightRadius: 12 }} />

                      {/* Moving Laser Beam */}
                      <div 
                        className="wa-scanner-laser"
                        style={{
                          position: 'absolute',
                          left: 6,
                          right: 6,
                          height: 3,
                          background: 'linear-gradient(90deg, transparent, #00a884, #25d366, #00a884, transparent)',
                          boxShadow: '0 0 14px #25d366',
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
                      backgroundColor: '#1f2c34',
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
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#00a884',
                        marginBottom: 12
                      }}
                    >
                      <Camera size={28} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>
                      {isCameraStarting ? 'Starting Camera...' : (cameraError ? 'Camera Access Required' : 'Open Camera')}
                    </div>
                    <div style={{ fontSize: '12px', color: '#8696a0', lineHeight: '1.45', marginBottom: 16 }}>
                      {cameraError || 'Point your camera at a Baat Chit QR code to open chat directly.'}
                    </div>

                    <button
                      type="button"
                      onClick={startCamera}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 10,
                        border: 'none',
                        backgroundColor: '#00a884',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: '0 4px 12px rgba(0, 168, 132, 0.3)'
                      }}
                    >
                      <RefreshCw size={15} />
                      <span>{isCameraStarting ? 'Connecting...' : 'Allow / Start Camera'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Status or Toast Message */}
              {scanStatus.message && (
                <div 
                  style={{
                    marginTop: 14,
                    padding: '10px 14px',
                    borderRadius: 10,
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    maxWidth: 320,
                    backgroundColor: scanStatus.type === 'error' ? 'rgba(234, 67, 53, 0.2)' :
                      scanStatus.type === 'success' ? 'rgba(0, 168, 132, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                    color: scanStatus.type === 'error' ? '#ff6b6b' :
                      scanStatus.type === 'success' ? '#25d366' : '#ffffff',
                    border: `1px solid ${scanStatus.type === 'error' ? 'rgba(234, 67, 53, 0.4)' :
                      scanStatus.type === 'success' ? 'rgba(0, 168, 132, 0.4)' : 'rgba(255, 255, 255, 0.15)'}`
                  }}
                >
                  {scanStatus.type === 'error' ? <AlertCircle size={18} /> :
                    scanStatus.type === 'success' ? <UserCheck size={18} /> : <Sparkles size={18} />}
                  <span>{scanStatus.message}</span>
                </div>
              )}

              {/* Instructions */}
              <p 
                style={{ 
                  fontSize: '12px', 
                  color: '#8696a0', 
                  textAlign: 'center',
                  marginTop: 14,
                  marginBottom: 14,
                  maxWidth: 310,
                  lineHeight: '1.45'
                }}
              >
                QR code ko camera ke frame mein rakhein. Aap gallery se photo ya screenshot upload karke bhi scan kar sakte hain.
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
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      backgroundColor: '#202c33',
                      color: '#ffffff',
                      fontSize: '13px',
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
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: '#202c33',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <ImageIcon size={16} />
                  <span>Scan From Photo</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Switch Back to My Code Button */}
              <button
                type="button"
                onClick={() => setActiveTab('myCode')}
                style={{
                  marginTop: 10,
                  background: 'none',
                  border: 'none',
                  color: '#00a884',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px'
                }}
              >
                <QrCode size={15} />
                <span>Mera QR Code Dekhein (My Code)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
