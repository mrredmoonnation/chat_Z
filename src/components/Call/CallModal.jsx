import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, Shield } from 'lucide-react';
import { sounds } from '../../services/audioEffects';
import { WebRTCService } from '../../services/webrtc';

export default function CallModal({
  callState, // { isOpen, isIncoming, isAccepted, contact, isVideo }
  onEndCall,
  onAcceptCall,
  p2pService
}) {
  const [status, setStatus] = useState('connecting'); // 'incoming', 'ringing', 'connected'
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const webrtcRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const statusRef = useRef('connecting'); // Ref to avoid stale closure in timeouts

  // Keep statusRef in sync with status state
  useEffect(() => { statusRef.current = status; }, [status]);

  // Initialize and handle call state transitions
  useEffect(() => {
    if (!callState?.isOpen) {
      sounds.stopRingtone();
      cleanupMedia();
      return;
    }

    // 1. Incoming Call Screen
    if (callState.isIncoming) {
      setStatus('incoming');
      sounds.startIncomingRingtone();
      return;
    }

    // 2. Outgoing Call Screen (Ringing until receiver answers)
    setStatus('ringing');
    sounds.startOutgoingTone();

    // Start local camera/mic preview for the caller
    startLocalPreview();

    // 45 seconds timeout if receiver doesn't answer
    const ringTimeout = setTimeout(() => {
      if (statusRef.current === 'ringing') {
        handleEnd();
      }
    }, 45000);

    return () => clearTimeout(ringTimeout);
  }, [callState?.isOpen, callState?.isIncoming]);

  // When receiver answers (isAccepted becomes true) or when caller gets ACCEPT_CALL
  useEffect(() => {
    if (callState?.isOpen && callState?.isAccepted && status !== 'connected') {
      sounds.stopRingtone();
      setStatus('connected');
      startConnectedCall();
    }
  }, [callState?.isOpen, callState?.isAccepted]);

  // Acquire local camera/mic stream
  const startLocalPreview = async () => {
    if (!webrtcRef.current) {
      webrtcRef.current = new WebRTCService(
        (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        },
        (connState) => {
          console.log('Peer connection state:', connState);
        }
      );
    }

    const { stream } = await webrtcRef.current.getMediaStream(callState.isVideo);
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
    return stream;
  };

  // Start connected call once accepted
  const startConnectedCall = async () => {
    sounds.stopRingtone();
    setStatus('connected');

    const stream = await startLocalPreview();

    // If PeerJS mediaCall is active on receiver side, answer it
    if (p2pService?.activeMediaCall && stream) {
      p2pService.answerCall(stream, (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });
    }

    // Fallback display if direct remote stream is not yet established
    if (remoteVideoRef.current && !remoteVideoRef.current.srcObject && stream && callState.isVideo) {
      remoteVideoRef.current.srcObject = stream;
    }

    // Start duration timer
    setDuration(0);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const handleAccept = async () => {
    sounds.stopRingtone();
    setStatus('connected');
    onAcceptCall && onAcceptCall();
    await startConnectedCall();
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
