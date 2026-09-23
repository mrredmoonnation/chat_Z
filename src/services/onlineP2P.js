// Zero-Cost PeerJS Internet P2P Engine for Real Devices Across Different Networks

import Peer from 'peerjs';

const GOOGLE_ICE_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  }
};

export const sanitizePeerIdentifier = (idStr) => {
  if (!idStr) return Math.random().toString(36).substring(2, 9);
  let str = idStr.trim();
  // If user pasted a full URL with ?partner=...
  if (str.includes('partner=')) {
    try {
      const match = str.match(/partner=([^&]+)/);
      if (match && match[1]) {
        str = decodeURIComponent(match[1]);
      }
    } catch {
      // ignore
    }
  }
  // Strip leading '@' if entered as @username
  if (str.startsWith('@')) {
    str = str.substring(1);
  }
  const digitsOnly = str.replace(/[^0-9]/g, '');
  if (digitsOnly.length >= 7) {
    return digitsOnly;
  }
  return str.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 32);
};

export class OnlineP2PService {
  constructor({
    myPhoneNumber,
    myIdentifier,
    onMessageReceived,
    onIncomingCall,
    onStatusChange
  }) {
    // Support phone number or email/WiFi identifier
    const rawId = myIdentifier || myPhoneNumber;
    const cleanId = sanitizePeerIdentifier(rawId);
    this.myPeerId = `wa_user_${cleanId}`;
    this.onMessageReceived = onMessageReceived;
    this.onIncomingCall = onIncomingCall;
    this.onStatusChange = onStatusChange;

    this.peer = null;
    this.activeDataConnection = null;
    this.activeMediaCall = null;
    this.targetPeerId = null;
    this.isConnectedOnline = false;
  }

  // Initialize Peer connection to internet cloud server
  init() {
    try {
      this.peer = new Peer(this.myPeerId, GOOGLE_ICE_CONFIG);

      this.peer.on('open', (id) => {
        this.isConnectedOnline = true;
        this.onStatusChange && this.onStatusChange({ status: 'connected', peerId: id });
        console.log('Online P2P connected with ID:', id);

        // If target was already set, connect to it
        if (this.targetPeerId) {
          this.connectToPartner(this.targetPeerId);
        }
      });

      // Handle incoming direct message connection from partner
      this.peer.on('connection', (conn) => {
        this.setupDataConnection(conn);
      });

      // Handle incoming audio/video call from partner over the internet
      this.peer.on('call', (mediaCall) => {
        this.activeMediaCall = mediaCall;
        this.onIncomingCall && this.onIncomingCall(mediaCall);
      });

      this.peer.on('error', (err) => {
        // If ID is already taken (e.g. from previous session/tab), connect with clean suffix
        if (err.type === 'unavailable-id') {
          try {
            this.peer.destroy();
          } catch (e) {}
          const fallbackId = `${this.myPeerId}_${Math.floor(Math.random() * 1000)}`;
          this.myPeerId = fallbackId;
          this.peer = new Peer(fallbackId, GOOGLE_ICE_CONFIG);
          this.peer.on('open', (id) => {
            this.isConnectedOnline = true;
            this.onStatusChange && this.onStatusChange({ status: 'online', myId: id });
          });
          this.peer.on('connection', (conn) => this.setupDataConnection(conn));
          this.peer.on('call', (mediaCall) => {
            this.activeMediaCall = mediaCall;
            this.onIncomingCall && this.onIncomingCall(mediaCall);
          });
        }
      });

      this.peer.on('disconnected', () => {
        this.isConnectedOnline = false;
        this.onStatusChange && this.onStatusChange({ status: 'disconnected' });
        // Auto-reconnect after 3 seconds only if actually disconnected
        setTimeout(() => {
          if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
            try {
              this.peer.reconnect();
            } catch (recErr) {
              // Peer already reconnected or in progress
            }
          }
        }, 3000);
      });
    } catch (e) {
      console.error('Failed to init PeerJS:', e);
    }
  }

  // Connect to partner phone (e.g. girlfriend's phone number or ID)
  connectToPartner(partnerPhoneOrId) {
    if (!partnerPhoneOrId) return;
    const cleanTarget = partnerPhoneOrId.startsWith('wa_user_')
      ? partnerPhoneOrId
      : `wa_user_${sanitizePeerIdentifier(partnerPhoneOrId)}`;

    this.targetPeerId = cleanTarget;
    if (!this.peer || !this.isConnectedOnline) return;

    const conn = this.peer.connect(cleanTarget, {
      reliable: true
    });

    this.setupDataConnection(conn);
  }

  // Setup data connection event handlers
  setupDataConnection(conn) {
    this.activeDataConnection = conn;

    conn.on('open', () => {
      console.log('Data connection opened with partner:', conn.peer);
      this.onStatusChange && this.onStatusChange({ status: 'partner_connected', partnerId: conn.peer });
    });

    conn.on('data', (data) => {
      console.log('Received data over internet:', data);
      this.onMessageReceived && this.onMessageReceived(data);
    });

    conn.on('close', () => {
      console.log('Data connection closed with partner');
      this.onStatusChange && this.onStatusChange({ status: 'partner_disconnected' });
    });
  }

  // Send message or event to partner over the internet
  sendData(payload) {
    if (this.activeDataConnection && this.activeDataConnection.open) {
      this.activeDataConnection.send(payload);
      return true;
    }
    return false;
  }

  // Initiate an audio/video call to partner across the internet
  callPartner(stream, isVideo = true) {
    if (!this.peer || !this.targetPeerId) return null;

    const mediaCall = this.peer.call(this.targetPeerId, stream, {
      metadata: { isVideo }
    });
    this.activeMediaCall = mediaCall;
    return mediaCall;
  }

  // Answer an incoming audio/video call
  answerCall(localStream, onRemoteStream) {
    if (!this.activeMediaCall) return;

    this.activeMediaCall.answer(localStream);
    this.activeMediaCall.on('stream', (remoteStream) => {
      onRemoteStream && onRemoteStream(remoteStream);
    });
  }

  // End active media call
  endCall() {
    if (this.activeMediaCall) {
      this.activeMediaCall.close();
      this.activeMediaCall = null;
    }
  }

  // Destroy on logout
  destroy() {
    if (this.activeDataConnection) {
      this.activeDataConnection.close();
    }
    if (this.activeMediaCall) {
      this.activeMediaCall.close();
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
