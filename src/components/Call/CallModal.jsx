import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, Shield } from 'lucide-react';
import { sounds } from '../../services/audioEffects';

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
  const localStreamRef = useRef(null);
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
    startLocalMedia(callState.isVideo);

    // 45 seconds timeout if receiver doesn't answer
    const ringTimeout = setTimeout(() => {
      if (statusRef.current === 'ringing') {
        handleEnd();
      }
    }, 45000);

    return () => clearTimeout(ringTimeout);
  }, [callState?.isOpen, callState?.isIncoming]);

  // When receiver answers (isAccepted becomes true)
  useEffect(() => {
    if (callState?.isOpen && callState?.isAccepted && status !== 'connected') {
      sounds.stopRingtone();
      setStatus('connected');
      startConnectedCall();
    }
  }, [callState?.isOpen, callState?.isAccepted]);

  // Listen for remote stream dispatched by App.jsx (for CALLER side audio/video)
  useEffect(() => {
    const handleRemoteStream = (event) => {
      const remoteStream = event.detail?.stream;
      if (!remoteStream) return;
      console.log('📞 CallModal: Remote stream received via event');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
      // For audio-only calls, play audio through a hidden audio element
      if (!callState?.isVideo) {
        const audioEl = document.createElement('audio');
        audioEl.srcObject = remoteStream;
        audioEl.autoplay = true;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        // Store for cleanup
        localStreamRef._audioEl = audioEl;
      }
    };

    window.addEventListener('wa_remote_stream', handleRemoteStream);
    return () => window.removeEventListener('wa_remote_stream', handleRemoteStream);
  }, [callState?.isVideo]);

  // Acquire local camera/mic stream
  const startLocalMedia = async (video = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        },
        video: video
          ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
          : false
      });
      localStreamRef.current = stream;

      if (video && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      return stream;
    } catch (err) {
      console.warn('📞 Could not get local media stream:', err);
      return null;
    }
  };

  // Start connected call once accepted
  const startConnectedCall = async () => {
    sounds.stopRingtone();
    setStatus('connected');

    // Acquire local stream for RECEIVER (caller already has theirs from handleStartCall in App.jsx)
    const stream = await startLocalMedia(callState?.isVideo);

    // RECEIVER side: answer the incoming PeerJS media call
    if (p2pService?.activeMediaCall && stream) {
      console.log('📞 Receiver answering PeerJS media call with local stream');
      p2pService.answerCall(stream, (remoteStream) => {
        console.log('📞 Receiver got remote stream from caller');
        if (callState?.isVideo && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        } else {
          // Audio call — play remote audio
          const audioEl = document.createElement('audio');
          audioEl.srcObject = remoteStream;
          audioEl.autoplay = true;
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          localStreamRef._audioEl = audioEl;
        }
      });
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
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    // Cleanup hidden audio element if created
    if (localStreamRef._audioEl) {
      try {
        localStreamRef._audioEl.pause();
        localStreamRef._audioEl.srcObject = null;
        localStreamRef._audioEl.remove();
      } catch (e) {}
      localStreamRef._audioEl = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setIsMuted(false);
    setIsVideoOff(false);
    setStatus('connecting');
    setDuration(0);
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => { t.enabled = isMuted; }); // Toggle
      setIsMuted(!isMuted);
    } else {
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((t) => { t.enabled = isVideoOff; }); // Toggle
      setIsVideoOff(!isVideoOff);
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
          <span>Chatz {callState.isVideo ? 'Video Call' : 'Voice Call'}</span>
        </div>

        <h2 className="wa-call-contact-name">{callState.contact.name}</h2>

        <div className="wa-call-status-text">
          {status === 'incoming' && 'Incoming Call...'}
          {status === 'ringing' && 'Ringing...'}
          {status === 'connected' && formatTime(duration)}
          {status === 'connecting' && 'Connecting...'}
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
          <>
            {/* Hidden video elements for audio capture even on voice calls */}
            <video ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
            <video ref={localVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />

            <div className="wa-call-avatar-pulse">
              <img
                src={callState.contact.avatar}
                alt={callState.contact.name}
              />
            </div>
          </>
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
              onClick={() => {
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.volume = remoteVideoRef.current.volume > 0 ? 0 : 1;
                }
              }}
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
