// Zero-Cost Global Cloud Registry & Ultra-Fast Real-Time Message Relay via Secure WebSocket MQTT
// Enables seamless cross-network messaging (WiFi, 4G/5G mobile data, hotspots, firewalls)

import Paho from 'paho-mqtt';
import { getRegisteredUsernames, registerUsername, cleanUsername } from './store';

const BROKER_HOST = 'broker.emqx.io';
const BROKER_PORT = 8084;
const BROKER_PATH = '/mqtt';

let mqttClient = null;
let currentSubscribedUser = null;
let isConnected = false;
let messageHandlers = new Set();
let pendingPublishQueue = [];

// Initialize or reconnect MQTT client
export const initRealtimeCloud = (myUsername, onMessageReceived) => {
  if (onMessageReceived) {
    messageHandlers.add(onMessageReceived);
  }

  const cleanU = cleanUsername(myUsername);
  if (!cleanU) return;

  if (mqttClient && isConnected && currentSubscribedUser === cleanU) {
    return;
  }

  currentSubscribedUser = cleanU;
  const clientId = `chatz_${cleanU}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    if (mqttClient) {
      try { mqttClient.disconnect(); } catch (e) {}
    }

    mqttClient = new Paho.Client(BROKER_HOST, BROKER_PORT, BROKER_PATH, clientId);

    mqttClient.onConnectionLost = (responseObject) => {
      isConnected = false;
      console.warn('Realtime Cloud disconnected:', responseObject.errorMessage);
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (currentSubscribedUser) {
          initRealtimeCloud(currentSubscribedUser);
        }
      }, 3000);
    };

    mqttClient.onMessageArrived = (message) => {
      try {
        const topic = message.destinationName;
        const payloadStr = message.payloadString;
        const data = JSON.parse(payloadStr);

        // 1. Direct incoming 1-to-1 message for this user
        if (topic === `chatz_v2/user/${cleanU}`) {
          messageHandlers.forEach((handler) => {
            try { handler([data]); } catch (err) { console.error('Handler error:', err); }
          });
        }
        // 2. Directory discovery announcement
        else if (topic === 'chatz_v2/directory/announce') {
          if (data?.username && data.username !== cleanU) {
            registerUsername(data.username, data);
          }
        }
        // 3. Someone asked who is online: announce our profile
        else if (topic === 'chatz_v2/directory/query') {
          const stored = localStorage.getItem('chatz_user_v1');
          if (stored) {
            try {
              const u = JSON.parse(stored);
              if (u?.username) {
                publishUserToCloud(u);
              }
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn('Error processing incoming cloud message:', err);
      }
    };

    mqttClient.connect({
      useSSL: true,
      timeout: 10,
      keepAliveInterval: 30,
      cleanSession: true,
      onSuccess: () => {
        isConnected = true;
        console.log('Realtime Cloud Connected via secure WebSocket');

        // Subscribe to our private message inbox
        mqttClient.subscribe(`chatz_v2/user/${cleanU}`, { qos: 1 });
        // Subscribe to global user directory discovery
        mqttClient.subscribe('chatz_v2/directory/announce', { qos: 0 });
        mqttClient.subscribe('chatz_v2/directory/query', { qos: 0 });

        // Flush any queued outgoing messages
        while (pendingPublishQueue.length > 0) {
          const item = pendingPublishQueue.shift();
          try {
            const msg = new Paho.Message(JSON.stringify(item.payload));
            msg.destinationName = item.topic;
            msg.qos = 1;
            mqttClient.send(msg);
          } catch (e) {
            console.warn('Flush err:', e);
          }
        }

        // Announce our presence so other devices discover us immediately
        const stored = localStorage.getItem('chatz_user_v1');
        if (stored) {
          try {
            const u = JSON.parse(stored);
            if (u?.username) {
              publishUserToCloud(u);
            }
          } catch (e) {}
        }
      },
      onFailure: (err) => {
        isConnected = false;
        console.warn('Realtime Cloud connection failed, retrying in 4s:', err);
        setTimeout(() => {
          if (currentSubscribedUser) {
            initRealtimeCloud(currentSubscribedUser);
          }
        }, 4000);
      }
    });
  } catch (err) {
    console.error('MQTT init error:', err);
  }
};

// Publish or update logged-in user profile to the global cloud directory
export const publishUserToCloud = (userProfile) => {
  if (!userProfile?.username) return false;
  const cleanU = cleanUsername(userProfile.username);
  if (!cleanU) return false;

  const profileData = {
    id: `wa_user_${cleanU}`,
    username: cleanU,
    name: userProfile.name || cleanU,
    avatar: userProfile.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanU}`,
    about: userProfile.about || 'Hey there! I am using Chatz',
    phone: userProfile.phone || '',
    email: userProfile.email || '',
    updatedAt: Date.now()
  };

  // Register locally in store
  registerUsername(cleanU, profileData);

  // Broadcast to all devices across internet
  const topic = 'chatz_v2/directory/announce';
  if (mqttClient && isConnected) {
    try {
      const msg = new Paho.Message(JSON.stringify(profileData));
      msg.destinationName = topic;
      msg.qos = 0;
      mqttClient.send(msg);
    } catch (e) {
      console.warn('Failed to publish announce:', e);
    }
  } else {
    pendingPublishQueue.push({ topic, payload: profileData });
  }

  return true;
};

// Fetch all registered users across the globe and sync with local storage
export const fetchCloudUsers = async () => {
  // Query all active devices to broadcast their profiles
  const topic = 'chatz_v2/directory/query';
  if (mqttClient && isConnected) {
    try {
      const msg = new Paho.Message(JSON.stringify({ ping: Date.now() }));
      msg.destinationName = topic;
      msg.qos = 0;
      mqttClient.send(msg);
    } catch (e) {}
  }

  // Return currently known users
  const registry = getRegisteredUsernames();
  return Object.values(registry);
};

// Send an instant real-time cloud relay message to a user's inbox
export const sendCloudInboxMessage = (targetUsername, messagePayload) => {
  if (!targetUsername || !messagePayload) return false;
  const cleanTarget = cleanUsername(targetUsername);
  if (!cleanTarget) return false;

  const topic = `chatz_v2/user/${cleanTarget}`;
  const payloadWithMeta = {
    ...messagePayload,
    relayedAt: Date.now()
  };

  if (mqttClient && isConnected) {
    try {
      const msg = new Paho.Message(JSON.stringify(payloadWithMeta));
      msg.destinationName = topic;
      msg.qos = 1;
      mqttClient.send(msg);
      console.log(`Cloud relay message sent to @${cleanTarget} via MQTT`);
      return true;
    } catch (err) {
      console.warn('Failed to send cloud message:', err);
      pendingPublishQueue.push({ topic, payload: payloadWithMeta });
      return false;
    }
  } else {
    pendingPublishQueue.push({ topic, payload: payloadWithMeta });
    return true;
  }
};

// Poll / Listen helper for backward compatibility with App.jsx
export const pollCloudInbox = (myUsername, onMessagesReceived) => {
  initRealtimeCloud(myUsername, onMessagesReceived);
};
