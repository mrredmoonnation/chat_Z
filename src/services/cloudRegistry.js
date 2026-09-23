// Zero-Cost Global Cloud Registry & Asynchronous Message Relay
// Allows users to find each other across any device/browser worldwide!

const REGISTRY_OBJECT_ID = 'ff808181a09d98f701a0cf9faa517e8e';
const REGISTRY_URL = `https://api.restful-api.dev/objects/${REGISTRY_OBJECT_ID}`;

import { getRegisteredUsernames, registerUsername, cleanUsername } from './store';

// Fetch all registered users across the globe and sync with local storage
export const fetchCloudUsers = async () => {
  try {
    const res = await fetch(REGISTRY_URL, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    const remoteUsers = json?.data?.users || {};

    // Merge into local registry
    Object.values(remoteUsers).forEach((u) => {
      if (u?.username) {
        registerUsername(u.username, u);
      }
    });

    return Object.values(remoteUsers);
  } catch (err) {
    console.warn('Notice: offline or cloud registry sync warning:', err);
    return [];
  }
};

// Publish or update logged-in user profile to the global cloud directory
export const publishUserToCloud = async (userProfile) => {
  if (!userProfile?.username) return false;
  const cleanU = cleanUsername(userProfile.username);
  if (!cleanU) return false;

  try {
    // 1. Fetch current cloud state first to prevent overwriting other users
    const getRes = await fetch(REGISTRY_URL, { cache: 'no-store' });
    const currentJson = getRes.ok ? await getRes.json() : null;
    const currentUsers = currentJson?.data?.users || {};
    const currentInbox = currentJson?.data?.inbox || {};

    // 2. Add / Update this user
    currentUsers[cleanU] = {
      id: `wa_user_${cleanU}`,
      username: cleanU,
      name: userProfile.name || cleanU,
      avatar: userProfile.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanU}`,
      about: userProfile.about || 'Hey there! I am using Chatz',
      phone: userProfile.phone || '',
      email: userProfile.email || '',
      updatedAt: Date.now()
    };

    // 3. Put back to cloud
    await fetch(REGISTRY_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'chatz_global_registry',
        data: {
          users: currentUsers,
          inbox: currentInbox
        }
      })
    });

    // Also register locally
    registerUsername(cleanU, currentUsers[cleanU]);
    return true;
  } catch (err) {
    console.warn('Failed to publish user to cloud:', err);
    return false;
  }
};

// Send an offline cloud relay message to a user's inbox
export const sendCloudInboxMessage = async (targetUsername, messagePayload) => {
  if (!targetUsername || !messagePayload) return false;
  const cleanTarget = cleanUsername(targetUsername);
  if (!cleanTarget) return false;

  try {
    const getRes = await fetch(REGISTRY_URL, { cache: 'no-store' });
    if (!getRes.ok) return false;
    const currentJson = await getRes.json();
    const currentUsers = currentJson?.data?.users || {};
    const currentInbox = currentJson?.data?.inbox || {};

    const targetList = currentInbox[cleanTarget] || [];
    targetList.push({
      ...messagePayload,
      queuedAt: Date.now()
    });
    // Keep max 30 pending messages
    currentInbox[cleanTarget] = targetList.slice(-30);

    await fetch(REGISTRY_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'chatz_global_registry',
        data: {
          users: currentUsers,
          inbox: currentInbox
        }
      })
    });
    return true;
  } catch (err) {
    console.warn('Failed to send cloud inbox message:', err);
    return false;
  }
};

// Poll and retrieve queued messages for a user
export const pollCloudInbox = async (myUsername, onMessagesReceived) => {
  if (!myUsername) return;
  const cleanU = cleanUsername(myUsername);
  if (!cleanU) return;

  try {
    const getRes = await fetch(REGISTRY_URL, { cache: 'no-store' });
    if (!getRes.ok) return;
    const currentJson = await getRes.json();
    const currentUsers = currentJson?.data?.users || {};
    const currentInbox = currentJson?.data?.inbox || {};

    const myMessages = currentInbox[cleanU] || [];
    if (myMessages.length === 0) return;

    // Trigger delivery callback
    onMessagesReceived && onMessagesReceived(myMessages);

    // Clear inbox for this user
    currentInbox[cleanU] = [];
    await fetch(REGISTRY_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'chatz_global_registry',
        data: {
          users: currentUsers,
          inbox: currentInbox
        }
      })
    });
  } catch (err) {
    console.warn('Poll inbox notice:', err);
  }
};
