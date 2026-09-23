import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, Shield } from 'lucide-react';
import { sounds } from '../../services/audioEffects';
import { WebRTCService } from '../../services/webrtc';

export default function CallModal({
  callState, // { isOpen, isIncoming, contact, isVideo }
  onEndCall,
  onAcceptCall
}) {
  const [status, setStatus] = useState('connecting'); // 'incoming', 'ringing', 'connected'
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const webrtcRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    if (!callState?.isOpen) {
      sounds.stopRingtone();
      cleanupMedia();
      return;
    }

    // Set initial status
    if (callState.isIncoming) {
      setStatus('incoming');
      sounds.startIncomingRingtone();
    } else {
      setStatus('ringing');
      sounds.startOutgoingTone();
      // Outgoing auto-connect demo after 3 seconds if receiver doesn't answer manually
      const connectTimeout = setTimeout(() => {
        handleConnect();
      }, 3200);
      return () => clearTimeout(connectTimeout);
    }
  }, [callState?.isOpen, callState?.isIncoming]);

  // Connect call and start camera/mic
  const handleConnect = async () => {
    sounds.stopRingtone();
    setStatus('connected');

    // Initialize WebRTC
    const rtc = new WebRTCService(
      (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      },
      (connState) => {
        console.log('Peer connection state:', connState);
      }
    );
    webrtcRef.current = rtc;

    // Get media
    const { stream } = await rtc.getMediaStream(callState.isVideo);
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }

    // Also simulate remote video stream for demonstration if peer connection isn't on real remote machine
    if (remoteVideoRef.current && stream && callState.isVideo) {
      remoteVideoRef.current.srcObject = stream;
    }

    // Start duration timer
    setDuration(0);
    timerIntervalRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const handleAccept = () => {
    onAcceptCall && onAcceptCall();
    handleConnect();
  };

  const handleEnd = () => {
    sounds.stopRingtone();
    cleanupMedia();
    onEndCall && onEndCall();
  };

  const cleanupMedia = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (webrtcRef.current) {
      webrtcRef.current.cleanup();
      webrtcRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setIsMuted(false);
    setIsVideoOff(false);
  };

  const toggleMic = () => {
    if (webrtcRef.current) {
      const muted = webrtcRef.current.toggleAudio();
      setIsMuted(muted);
    } else {
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (webrtcRef.current) {
      const off = webrtcRef.current.toggleVideo();
      setIsVideoOff(off);
    } else {
      setIsVideoOff(!isVideoOff);
    }
  };

  if (!callState?.isOpen || !callState?.contact) return null;

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <div className="wa-call-overlay">
      {/* Top Header */}
      <div className="wa-call-header">
        <div className="wa-call-type-badge">
          {callState.isVideo ? <Video size={16} color="#00a884" /> : <Phone size={16} color="#00a884" />}
          <span>WhatsApp {callState.isVideo ? 'Video Call' : 'Voice Call'}</span>
        </div>

        <h2 className="wa-call-contact-name">{callState.contact.name}</h2>

        <div className="wa-call-status-text">
          {status === 'incoming' && 'Incoming Call...'}
          {status === 'ringing' && 'Ringing...'}
          {status === 'connected' && formatTime(duration)}
        </div>
      </div>

      {/* Center Display: Video or Avatar */}
      <div className="wa-call-center">
        {callState.isVideo && status === 'connected' ? (
          <div className="wa-call-video-grid">
            {/* Main Remote Video */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="wa-remote-video"
            />

            {/* Local Picture-in-Picture */}
            {!isVideoOff && (
              <div className="wa-local-video-pip">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                />
              </div>
            )}
          </div>
        ) : (
          <div className="wa-call-avatar-pulse">
            <img
              src={callState.contact.avatar}
              alt={callState.contact.name}
            />
          </div>
        )}

        {/* Security badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 24, color: 'var(--wa-text-muted)', fontSize: '12px' }}>
          <Shield size={14} color="#00a884" />
          <span>End-to-end encrypted peer connection</span>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="wa-call-controls">
        {status === 'incoming' ? (
          <>
            <button
              id="declineCallBtn"
              className="wa-call-end-btn"
              onClick={handleEnd}
              title="Decline Call"
            >
              <PhoneOff size={28} />
            </button>

            <button
              id="acceptCallBtn"
              className="wa-call-accept-btn"
              onClick={handleAccept}
              title="Accept Call"
            >
              {callState.isVideo ? <Video size={28} /> : <Phone size={28} />}
            </button>
          </>
        ) : (
          <>
            <button
              className={`wa-call-ctrl-btn ${isMuted ? 'off' : ''}`}
              onClick={toggleMic}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            {callState.isVideo && (
              <button
                className={`wa-call-ctrl-btn ${isVideoOff ? 'off' : ''}`}
                onClick={toggleCamera}
                title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
              >
                {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
              </button>
            )}

            <button
              className="wa-call-ctrl-btn"
              title="Speaker"
            >
              <Volume2 size={22} />
            </button>

            <button
              id="endActiveCallBtn"
              className="wa-call-end-btn"
              onClick={handleEnd}
              title="End Call"
            >
              <PhoneOff size={28} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
