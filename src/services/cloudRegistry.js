// Zero-Cost Global Cloud Registry & Ultra-Fast Real-Time Message Relay via Secure WebSocket MQTT
// Enables seamless cross-network messaging (WiFi, 4G/5G mobile data, hotspots, firewalls)

import Paho from 'paho-mqtt';
import { getRegisteredUsernames, registerUsername, cleanUsername } from './store';

const BROKER_HOST = 'broker.emqx.io';
const BROKER_PORT = 8084;
const BROKER_PATH = '/mqtt';

let mqttClient = null;
let currentSubscribedUsers = new Set();
let isConnected = false;
let messageHandlers = new Set();
let pendingPublishQueue = [];

// Initialize or reconnect MQTT client
export const initRealtimeCloud = (myUsernamesOrIds, onMessageReceived) => {
  if (onMessageReceived) {
    messageHandlers.clear();
    messageHandlers.add(onMessageReceived);
  }

  const rawList = Array.isArray(myUsernamesOrIds) ? myUsernamesOrIds : [myUsernamesOrIds];
  const cleanList = rawList
    .map((u) => cleanUsername(u))
    .filter(Boolean);

  if (cleanList.length === 0) return;

  cleanList.forEach((id) => currentSubscribedUsers.add(id));

  // If already connected, just ensure new channels are subscribed (both instant and offline channels)
  if (mqttClient && isConnected) {
    cleanList.forEach((id) => {
      try {
        mqttClient.subscribe(`chatz_v2/user/${id}`, { qos: 1 });
        mqttClient.subscribe(`chatz_v2/offline/${id}/#`, { qos: 1 });
      } catch (e) {}
    });
    try {
      mqttClient.subscribe('chatz_v2/stories/broadcast', { qos: 1 });
      mqttClient.subscribe('chatz_v2/stories/user/+', { qos: 1 });
      mqttClient.subscribe('chatz_v2/stories/query', { qos: 0 });
      mqttClient.subscribe('chatz_v2/community/tech_ideas', { qos: 1 });
    } catch (e) {}
    return;
  }

  const primaryClean = cleanList[0];
  const clientId = `chatz_${primaryClean}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    if (mqttClient) {
      try { mqttClient.disconnect(); } catch (e) { }
    }

    mqttClient = new Paho.Client(BROKER_HOST, BROKER_PORT, BROKER_PATH, clientId);

    mqttClient.onConnectionLost = (responseObject) => {
      isConnected = false;
      console.warn('Realtime Cloud disconnected:', responseObject?.errorMessage);
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (currentSubscribedUsers.size > 0) {
          initRealtimeCloud(Array.from(currentSubscribedUsers));
        }
      }, 3000);
    };

    mqttClient.onMessageArrived = (message) => {
      try {
        const topic = message.destinationName;
        const payloadStr = message.payloadString;

        // Ignore empty tombstone messages (used to clear retained broker messages)
        if (!payloadStr || payloadStr.trim() === '') {
          return;
        }

        const data = JSON.parse(payloadStr);

        // 1. Direct incoming 1-to-1 instant message
        if (topic.startsWith('chatz_v2/user/')) {
          const targetTopicUser = topic.replace('chatz_v2/user/', '');
          if (currentSubscribedUsers.has(targetTopicUser)) {
            messageHandlers.forEach((handler) => {
              try { handler([data]); } catch (err) { console.error('Handler error:', err); }
            });
          }
        }
        // 1b. Persistent Offline Message arrived (retained while this user was offline)
        else if (topic.startsWith('chatz_v2/offline/')) {
          const parts = topic.split('/');
          const targetTopicUser = parts[2]; // chatz_v2 / offline / {username} / {msgId}

          if (currentSubscribedUsers.has(targetTopicUser)) {
            // Deliver the offline message to the app
            messageHandlers.forEach((handler) => {
              try { handler([data]); } catch (err) { console.error('Handler error:', err); }
            });

            // Once received, clear the retained message from broker so it will not duplicate
            if (mqttClient && isConnected) {
              try {
                const clearMsg = new Paho.Message('');
                clearMsg.destinationName = topic;
                clearMsg.retained = true;
                clearMsg.qos = 1;
                mqttClient.send(clearMsg);
              } catch (e) {}
            }
          }
        }
        // 2. Directory discovery announcement
        else if (topic === 'chatz_v2/directory/announce') {
          if (data?.username && !currentSubscribedUsers.has(cleanUsername(data.username))) {
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
        // 4. Story real-time updates and retained stories from any user
        else if (topic === 'chatz_v2/stories/broadcast' || topic.startsWith('chatz_v2/stories/user/')) {
          if (data) {
            window.dispatchEvent(new CustomEvent('wa_cloud_story_received', { detail: data }));
          }
        }
        // 5. Stories query: someone asked for all active stories
        else if (topic === 'chatz_v2/stories/query') {
          broadcastMyLocalStories();
        }
        // 6. Real-time Tech Community & Ideas discussion
        else if (topic === 'chatz_v2/community/tech_ideas') {
          if (data) {
            window.dispatchEvent(new CustomEvent('wa_community_message_received', { detail: data }));
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

        // Subscribe to both real-time instant and persistent offline inboxes
        currentSubscribedUsers.forEach((id) => {
          try {
            mqttClient.subscribe(`chatz_v2/user/${id}`, { qos: 1 });
            mqttClient.subscribe(`chatz_v2/offline/${id}/#`, { qos: 1 });
          } catch (e) {}
        });

        // Subscribe to global user directory discovery
        mqttClient.subscribe('chatz_v2/directory/announce', { qos: 0 });
        mqttClient.subscribe('chatz_v2/directory/query', { qos: 0 });

        // Subscribe to stories broadcast, wildcard user stories, and stories query
        mqttClient.subscribe('chatz_v2/stories/broadcast', { qos: 1 });
        mqttClient.subscribe('chatz_v2/stories/user/+', { qos: 1 });
        mqttClient.subscribe('chatz_v2/stories/query', { qos: 0 });

        // Subscribe to Tech Community & Ideas global discussion channel
        mqttClient.subscribe('chatz_v2/community/tech_ideas', { qos: 1 });

        // Flush any queued outgoing messages
        while (pendingPublishQueue.length > 0) {
          const item = pendingPublishQueue.shift();
          try {
            const msg = new Paho.Message(JSON.stringify(item.payload));
            msg.destinationName = item.topic;
            msg.qos = 1;
            if (item.retained) {
              msg.retained = true;
            }
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

        // Broadcast any active local story and query stories from peers
        try {
          broadcastMyLocalStories();
          queryCloudStories();
        } catch (e) {}
      },
      onFailure: (err) => {
        isConnected = false;
        console.warn('Realtime Cloud connection failed, retrying in 4s:', err);
        setTimeout(() => {
          if (currentSubscribedUsers && currentSubscribedUsers.size > 0) {
            initRealtimeCloud(Array.from(currentSubscribedUsers));
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

  const targetAvatar = userProfile.avatar || userProfile.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanU}`;
  const profileData = {
    id: `wa_user_${cleanU}`,
    username: cleanU,
    name: userProfile.name || cleanU,
    avatar: targetAvatar,
    photoURL: targetAvatar,
    about: userProfile.about || 'Hey there! I am using baat chit',
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

// Send persistent offline message (retained by cloud broker until recipient comes online)
export const sendOfflineCloudMessage = (targetUsername, messagePayload) => {
  if (!targetUsername || !messagePayload) return false;
  const cleanTarget = cleanUsername(targetUsername);
  if (!cleanTarget) return false;

  const msgId = messagePayload.message?.id || ('m_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
  const topic = `chatz_v2/offline/${cleanTarget}/${msgId}`;

  const payloadWithMeta = {
    ...messagePayload,
    offlineQueuedAt: Date.now()
  };

  if (mqttClient && isConnected) {
    try {
      const msg = new Paho.Message(JSON.stringify(payloadWithMeta));
      msg.destinationName = topic;
      msg.qos = 1;
      msg.retained = true; // Retained permanently on broker until consumed!
      mqttClient.send(msg);
      console.log(`Offline message retained for @${cleanTarget} on ${topic}`);
      return true;
    } catch (err) {
      console.warn('Failed to queue offline message, saving to pending queue:', err);
      pendingPublishQueue.push({ topic, payload: payloadWithMeta, retained: true });
      return false;
    }
  } else {
    pendingPublishQueue.push({ topic, payload: payloadWithMeta, retained: true });
    return true;
  }
};

// Force manual refresh of realtime cloud connection & subscriptions
export const refreshRealtimeCloud = async () => {
  if (mqttClient && isConnected && currentSubscribedUsers.size > 0) {
    currentSubscribedUsers.forEach((id) => {
      try {
        mqttClient.subscribe(`chatz_v2/user/${id}`, { qos: 1 });
        mqttClient.subscribe(`chatz_v2/offline/${id}/#`, { qos: 1 });
      } catch (e) {}
    });

    try {
      const msg = new Paho.Message(JSON.stringify({ ping: Date.now() }));
      msg.destinationName = 'chatz_v2/directory/query';
      msg.qos = 0;
      mqttClient.send(msg);
    } catch (e) {}
    return true;
  } else if (currentSubscribedUsers.size > 0) {
    initRealtimeCloud(Array.from(currentSubscribedUsers));
    return true;
  }
  return false;
};

// Poll / Listen helper for backward compatibility with App.jsx
export const pollCloudInbox = (myUsername, onMessagesReceived) => {
  initRealtimeCloud(myUsername, onMessagesReceived);
};

// Internal helper to broadcast own active stories
function broadcastMyLocalStories() {
  try {
    const rawUser = localStorage.getItem('chatz_user_v1');
    if (!rawUser) return;
    const user = JSON.parse(rawUser);
    if (!user) return;

    const rawStories = localStorage.getItem('chatz_stories_v1');
    if (!rawStories) return;
    const stories = JSON.parse(rawStories);
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    const myStory = stories.find((s) =>
      s.contactId === 'user' ||
      (user.uid && s.uid === user.uid) ||
      (user.id && s.contactId === user.id) ||
      (user.username && s.username === user.username)
    );

    if (myStory?.items?.length) {
      const activeItems = myStory.items.filter((it) => (now - (it.timestamp || it.createdAt || now)) < TWENTY_FOUR_HOURS);
      if (activeItems.length > 0) {
        publishStoryToCloud(user, { ...myStory, items: activeItems });
      }
    }
  } catch (e) {
    console.warn('Error broadcasting local stories:', e);
  }
}

// Publish or update a user's story to the real-time cloud (broadcast + retained broker message)
export const publishStoryToCloud = (currentUser, storyItemOrFullStory) => {
  if (!currentUser) return false;
  const username = cleanUsername(currentUser.username || currentUser.id || currentUser.uid);
  if (!username) return false;

  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  let activeItems = [];
  try {
    const raw = localStorage.getItem('chatz_stories_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      const myStory = parsed.find(
        (s) =>
          s.contactId === 'user' ||
          (currentUser.uid && s.uid === currentUser.uid) ||
          (currentUser.id && s.contactId === currentUser.id) ||
          (currentUser.username && s.username === currentUser.username)
      );
      if (myStory?.items) {
        activeItems = myStory.items.filter((it) => (now - (it.timestamp || it.createdAt || now)) < TWENTY_FOUR_HOURS);
      }
    }
  } catch (e) {}

  if (storyItemOrFullStory) {
    if (Array.isArray(storyItemOrFullStory.items)) {
      activeItems = storyItemOrFullStory.items.filter((it) => (now - (it.timestamp || it.createdAt || now)) < TWENTY_FOUR_HOURS);
    } else if (storyItemOrFullStory.type || storyItemOrFullStory.id) {
      const exists = activeItems.some((it) => it.id === storyItemOrFullStory.id);
      if (!exists) {
        activeItems.push(storyItemOrFullStory);
      }
    }
  }

  if (activeItems.length === 0) return false;

  const targetAvatar = currentUser.photoURL || currentUser.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${username}`;
  const displayName = currentUser.displayName || currentUser.name || currentUser.username || username;

  const payload = {
    type: 'STORY_UPDATE',
    storyId: `story_${username}`,
    uid: currentUser.uid || currentUser.id || `wa_user_${username}`,
    username: currentUser.username || username,
    contactId: currentUser.uid || currentUser.id || `wa_user_${username}`,
    contactName: displayName,
    avatar: targetAvatar,
    timeText: 'Just now',
    timestamp: now,
    items: activeItems
  };

  const broadcastTopic = 'chatz_v2/stories/broadcast';
  const retainedTopic = `chatz_v2/stories/user/${username}`;

  if (mqttClient && isConnected) {
    try {
      // 1. Instant broadcast to online peers
      const bMsg = new Paho.Message(JSON.stringify(payload));
      bMsg.destinationName = broadcastTopic;
      bMsg.qos = 1;
      mqttClient.send(bMsg);

      // 2. Retained per-user message on broker so newly connecting peers receive it
      const rMsg = new Paho.Message(JSON.stringify(payload));
      rMsg.destinationName = retainedTopic;
      rMsg.qos = 1;
      rMsg.retained = true;
      mqttClient.send(rMsg);
      return true;
    } catch (err) {
      console.warn('Failed to publish story to cloud, queueing:', err);
      pendingPublishQueue.push({ topic: broadcastTopic, payload });
      pendingPublishQueue.push({ topic: retainedTopic, payload, retained: true });
      return false;
    }
  } else {
    pendingPublishQueue.push({ topic: broadcastTopic, payload });
    pendingPublishQueue.push({ topic: retainedTopic, payload, retained: true });
    return true;
  }
};

// Delete story or specific item from real-time cloud
export const deleteStoryFromCloud = (currentUser, storyId, itemId = null) => {
  if (!currentUser) return false;
  const username = cleanUsername(currentUser.username || currentUser.id || currentUser.uid);
  if (!username) return false;

  if (itemId) {
    // Single slide item removed: republish active remaining items
    publishStoryToCloud(currentUser);
    return true;
  }

  const payload = {
    type: 'STORY_DELETE',
    uid: currentUser.uid || currentUser.id || `wa_user_${username}`,
    username: currentUser.username || username,
    storyId: storyId || `story_${username}`
  };

  if (mqttClient && isConnected) {
    try {
      // Broadcast deletion
      const bMsg = new Paho.Message(JSON.stringify(payload));
      bMsg.destinationName = 'chatz_v2/stories/broadcast';
      bMsg.qos = 1;
      mqttClient.send(bMsg);

      // Clear retained story on broker
      const clearMsg = new Paho.Message('');
      clearMsg.destinationName = `chatz_v2/stories/user/${username}`;
      clearMsg.retained = true;
      clearMsg.qos = 1;
      mqttClient.send(clearMsg);
      return true;
    } catch (err) {
      console.warn('Failed to delete story from cloud:', err);
      return false;
    }
  }
  return false;
};

// Query active stories from all online users
export const queryCloudStories = () => {
  const topic = 'chatz_v2/stories/query';
  if (mqttClient && isConnected) {
    try {
      const msg = new Paho.Message(JSON.stringify({ query: 'stories', time: Date.now() }));
      msg.destinationName = topic;
      msg.qos = 0;
      mqttClient.send(msg);
    } catch (e) {}
  }
};

// Publish real-time message to Tech Community & Ideas global channel
export const publishCommunityMessage = (messagePayload) => {
  const topic = 'chatz_v2/community/tech_ideas';
  if (mqttClient && isConnected) {
    try {
      const msg = new Paho.Message(JSON.stringify(messagePayload));
      msg.destinationName = topic;
      msg.qos = 1;
      mqttClient.send(msg);
      return true;
    } catch (err) {
      console.warn('MQTT publishCommunityMessage error:', err);
    }
  } else {
    pendingPublishQueue.push({ topic, payload: messagePayload, retained: false });
  }
  return false;
};

