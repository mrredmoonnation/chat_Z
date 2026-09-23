// Zero-Cost PeerJS Internet P2P Engine for Real Devices Across Different Networks

import Peer from 'peerjs';
import { sendCloudInboxMessage } from './cloudRegistry';

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
  let str = String(idStr).trim();

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

  // Strip leading @ or wa_user_ prefixes iteratively
  while (str.startsWith('@') || str.startsWith('wa_user_')) {
    if (str.startsWith('@')) str = str.substring(1);
    if (str.startsWith('wa_user_')) str = str.substring(8);
  }
  str = str.trim();

  // If it's purely a phone number (e.g. +91 9876543210 or 9876543210)
  const isPhoneNumber = /^(\+|00)?[0-9\s\-()]{7,20}$/.test(str);
  if (isPhoneNumber) {
    const digitsOnly = str.replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 7) {
      return digitsOnly;
    }
  }

  // Otherwise, it's a username or email handle: clean valid characters (only a-z, 0-9, and underscore for PeerJS server compatibility)
  return str.toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 32);
};

export class OnlineP2PService {
  constructor({
    myPhoneNumber,
    myIdentifier,
    myProfile,
    onMessageReceived,
    onIncomingCall,
    onStatusChange
  }) {
    // Support username as primary, or phone/email/WiFi identifier
    const rawId = myIdentifier || myPhoneNumber;
    const cleanId = sanitizePeerIdentifier(rawId);
    this.myPeerId = `wa_user_${cleanId}`;
    this.myProfile = myProfile || null;
    this.onMessageReceived = onMessageReceived;
    this.onIncomingCall = onIncomingCall;
    this.onStatusChange = onStatusChange;

    this.peer = null;
    this.activeDataConnection = null;
    this.connections = new Map(); // cleanPeerId -> DataConnection
    this.pendingQueue = new Map(); // cleanPeerId -> [messages...]
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
        console.warn('PeerJS event error:', err.type, err.message);
        if (err.type === 'peer-unavailable') {
          this.onStatusChange && this.onStatusChange({ status: 'partner_offline', message: err.message });
        } else if (err.type === 'unavailable-id') {
          // If ID still tied to previous session on cloud server, retry briefly
          console.warn('Peer ID temporarily busy on server, re-verifying...');
          setTimeout(() => {
            if (!this.isConnectedOnline && this.peer && !this.peer.destroyed) {
              try {
                this.peer.reconnect();
              } catch (e) {}
            }
          }, 2000);
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

  // Connect to partner phone or @username
  connectToPartner(partnerPhoneOrId) {
    if (!partnerPhoneOrId) return null;
    const cleanRaw = sanitizePeerIdentifier(partnerPhoneOrId);
    const cleanTarget = `wa_user_${cleanRaw}`;

    // Don't connect to self
    if (cleanTarget === this.myPeerId) return null;

    this.targetPeerId = cleanTarget;
    if (!this.peer || !this.isConnectedOnline) return null;

    // Reuse existing open connection if available
    const existing = this.connections.get(cleanTarget);
    if (existing && existing.open) {
      this.activeDataConnection = existing;
      this.onStatusChange && this.onStatusChange({ status: 'partner_connected', partnerId: cleanTarget });
      return existing;
    }

    try {
      const conn = this.peer.connect(cleanTarget, {
        reliable: true
      });
      this.setupDataConnection(conn);
      return conn;
    } catch (e) {
      console.warn('Failed to connect to partner peer:', cleanTarget, e);
      return null;
    }
  }

  // Setup data connection event handlers
  setupDataConnection(conn) {
    if (!conn) return;
    this.connections.set(conn.peer, conn);
    this.activeDataConnection = conn;

    conn.on('open', () => {
      console.log('Data connection opened with peer:', conn.peer);
      this.connections.set(conn.peer, conn);
      this.activeDataConnection = conn;
      this.onStatusChange && this.onStatusChange({ status: 'partner_connected', partnerId: conn.peer });

      // Immediate mutual profile handshake so partner receives display name, avatar, bio
      if (this.myProfile) {
        try {
          conn.send({
            type: 'PEER_HANDSHAKE',
            profile: this.myProfile
          });
        } catch (e) {
          console.warn('Failed to send handshake:', e);
        }
      }

      // Flush any queued messages for this peer!
      const queued = this.pendingQueue.get(conn.peer) || [];
      if (queued.length > 0) {
        console.log(`Flushing ${queued.length} queued messages to ${conn.peer}`);
        queued.forEach((msg) => {
          try { conn.send(msg); } catch (e) { console.warn('Queue flush err:', e); }
        });
        this.pendingQueue.delete(conn.peer);
      }
    });

    conn.on('data', (data) => {
      console.log('Received data over internet from', conn.peer, data);
      this.onMessageReceived && this.onMessageReceived(data, conn.peer);
    });

    conn.on('close', () => {
      console.log('Data connection closed with peer:', conn.peer);
      this.connections.delete(conn.peer);
      if (this.activeDataConnection === conn) {
        this.activeDataConnection = null;
      }
      this.onStatusChange && this.onStatusChange({ status: 'partner_disconnected', partnerId: conn.peer });
    });

    conn.on('error', (err) => {
      console.warn('Connection error with peer:', conn.peer, err);
    });
  }

  // Send message or event to partner over the internet
  sendData(payload, targetPeerId = null) {
    let conn = null;
    let cleanTarget = null;
    let targetUsername = null;

    if (targetPeerId) {
      const cleanRaw = sanitizePeerIdentifier(targetPeerId);
      targetUsername = cleanRaw;
      cleanTarget = `wa_user_${cleanRaw}`;
      conn = this.connections.get(cleanTarget);
      if (!conn || !conn.open) {
        conn = this.connectToPartner(cleanTarget);
      }
    } else if (this.targetPeerId) {
      cleanTarget = this.targetPeerId;
      targetUsername = cleanTarget.replace('wa_user_', '');
      conn = this.connections.get(cleanTarget) || this.activeDataConnection;
    }

    if (!conn || !conn.open) {
      conn = this.activeDataConnection;
    }

    // 1. If connection is already open, send directly over P2P!
    if (conn && conn.open) {
      try {
        conn.send(payload);
        return true;
      } catch (e) {
        console.warn('Failed to send payload over P2P:', e);
      }
    }

    // 2. If connection is still opening or peer is connecting, queue it!
    if (cleanTarget) {
      const list = this.pendingQueue.get(cleanTarget) || [];
      list.push(payload);
      this.pendingQueue.set(cleanTarget, list);

      // 3. Also relay via Cloud Inbox so message is delivered even if receiver is offline or on restricted NAT
      if (payload?.type === 'CHAT_MESSAGE' && targetUsername) {
        sendCloudInboxMessage(targetUsername, payload);
      }
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
    this.connections.forEach((conn) => {
      try { conn.close(); } catch (e) {}
    });
    this.connections.clear();
    if (this.activeDataConnection) {
      try { this.activeDataConnection.close(); } catch (e) {}
      this.activeDataConnection = null;
    }
    if (this.activeMediaCall) {
      try { this.activeMediaCall.close(); } catch (e) {}
      this.activeMediaCall = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
  }
}
