// Real-Time Firestore Chat Service for ChatRooms, Messages, and User Profiles
import { 
  getFirebaseFirestore 
} from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  getDocs,
  limit
} from 'firebase/firestore';

/**
 * -------------------------------------------------------------
 * 1. USERS COLLECTION (Document ID: uid)
 * -------------------------------------------------------------
 */

// Strict timeout helper to prevent hanging if Firestore database is uninitialized, missing, or offline
const withFirestoreTimeout = (promise, ms = 1500) => {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Firestore timeout')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
};

// Fetch user profile from Firestore Users collection
export const getFirestoreUserProfile = async (uid) => {
  if (!uid) return null;
  const db = getFirebaseFirestore();
  if (!db) return null;

  try {
    const userDocRef = doc(db, 'Users', uid);
    const snap = await withFirestoreTimeout(getDoc(userDocRef), 1200);
    if (snap && snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    // Graceful fallback when Firestore is offline or database isn't provisioned yet
    return null;
  }
};

// Create or update user profile in Firestore
export const saveFirestoreUserProfile = async (profile) => {
  if (!profile?.uid) return null;
  const db = getFirebaseFirestore();
  if (!db) return null;

  const cleanUsername = (profile.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const data = {
    uid: profile.uid,
    email: profile.email || '',
    displayName: profile.displayName || profile.name || cleanUsername || 'User',
    username: cleanUsername,
    photoURL: profile.photoURL || profile.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanUsername || profile.uid}`,
    about: profile.about || 'Hey there! I am using Chatz',
    lastSeen: serverTimestamp(),
    createdAt: profile.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    const userDocRef = doc(db, 'Users', profile.uid);
    await withFirestoreTimeout(setDoc(userDocRef, data, { merge: true }), 1500);
    return data;
  } catch (err) {
    // Return local data even if remote save failed/timed out
    return data;
  }
};

// Search users in Firestore by username or displayName
export const searchFirestoreUsers = async (queryStr, currentUid = null) => {
  const cleanQ = (queryStr || '').trim().toLowerCase().replace(/^@+/, '');
  if (!cleanQ) return [];

  const db = getFirebaseFirestore();
  if (!db) return [];

  try {
    const usersRef = collection(db, 'Users');
    // Fetch users (up to 25)
    const q = query(usersRef, limit(30));
    const snapshot = await getDocs(q);

    const matches = [];
    snapshot.forEach((d) => {
      const u = d.data();
      if (currentUid && u.uid === currentUid) return;

      const userMatch = u.username?.toLowerCase().includes(cleanQ);
      const nameMatch = u.displayName?.toLowerCase().includes(cleanQ);
      const emailMatch = u.email?.toLowerCase().includes(cleanQ);

      if (userMatch || nameMatch || emailMatch) {
        matches.push(u);
      }
    });

    return matches;
  } catch (err) {
    console.warn('Error searching Firestore users:', err);
    return [];
  }
};

/**
 * -------------------------------------------------------------
 * 2. CHATROOMS COLLECTION (Document ID: auto roomId or deterministic room_uid1_uid2)
 * -------------------------------------------------------------
 */

// Generate deterministic 1-to-1 room ID to prevent duplicate rooms between two users
export const getDeterministicRoomId = (uid1, uid2) => {
  const sorted = [uid1, uid2].sort();
  return `room_${sorted[0]}_${sorted[1]}`;
};

// Get existing 1-to-1 room or create new one
export const getOrCreateOneToOneRoom = async (currentUser, targetUser) => {
  if (!currentUser?.uid || !targetUser?.uid) return null;
  const db = getFirebaseFirestore();
  if (!db) return null;

  const roomId = getDeterministicRoomId(currentUser.uid, targetUser.uid);
  const roomRef = doc(db, 'ChatRooms', roomId);

  try {
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }

    // Create new room
    const newRoomData = {
      id: roomId,
      type: 'one-to-one',
      participants: [currentUser.uid, targetUser.uid],
      participantProfiles: {
        [currentUser.uid]: {
          uid: currentUser.uid,
          displayName: currentUser.displayName || currentUser.name || 'User',
          username: currentUser.username || '',
          photoURL: currentUser.photoURL || currentUser.avatar || ''
        },
        [targetUser.uid]: {
          uid: targetUser.uid,
          displayName: targetUser.displayName || targetUser.name || 'User',
          username: targetUser.username || '',
          photoURL: targetUser.photoURL || targetUser.avatar || ''
        }
      },
      lastMessage: '',
      lastMessageTimestamp: serverTimestamp(),
      lastSenderId: '',
      createdAt: serverTimestamp()
    };

    await setDoc(roomRef, newRoomData);
    return newRoomData;
  } catch (err) {
    console.error('Error creating/getting 1-to-1 room:', err);
    throw err;
  }
};

// Create new Group Room
export const createFirestoreGroupRoom = async (currentUser, groupName, groupAvatar, members = []) => {
  if (!currentUser?.uid || !groupName) return null;
  const db = getFirebaseFirestore();
  if (!db) return null;

  const participantUids = Array.from(new Set([currentUser.uid, ...members.map((m) => m.uid || m.id).filter(Boolean)]));
  const participantProfiles = {
    [currentUser.uid]: {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.name || 'User',
      username: currentUser.username || '',
      photoURL: currentUser.photoURL || currentUser.avatar || ''
    }
  };

  members.forEach((m) => {
    const id = m.uid || m.id;
    if (id) {
      participantProfiles[id] = {
        uid: id,
        displayName: m.displayName || m.name || 'Member',
        username: m.username || '',
        photoURL: m.photoURL || m.avatar || ''
      };
    }
  });

  const newGroupData = {
    type: 'group',
    roomName: groupName.trim(),
    roomAvatar: groupAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(groupName)}`,
    participants: participantUids,
    participantProfiles: participantProfiles,
    lastMessage: `Group created by ${currentUser.displayName || currentUser.username}`,
    lastMessageTimestamp: serverTimestamp(),
    lastSenderId: currentUser.uid,
    createdAt: serverTimestamp()
  };

  try {
    const docRef = await addDoc(collection(db, 'ChatRooms'), newGroupData);
    return { id: docRef.id, ...newGroupData };
  } catch (err) {
    console.error('Error creating Firestore group room:', err);
    throw err;
  }
};

// Listen to all real-time ChatRooms for current user (via onSnapshot)
export const subscribeToUserRooms = (currentUid, onRoomsUpdate, onError) => {
  if (!currentUid) return () => {};
  const db = getFirebaseFirestore();
  if (!db) return () => {};

  try {
    const roomsQuery = query(
      collection(db, 'ChatRooms'),
      where('participants', 'array-contains', currentUid)
    );

    const unsubscribe = onSnapshot(
      roomsQuery,
      (snapshot) => {
        const rooms = [];
        snapshot.forEach((d) => {
          rooms.push({ id: d.id, ...d.data() });
        });

        // Client-side sort by lastMessageTimestamp descending (avoids requiring a composite index)
        rooms.sort((a, b) => {
          const timeA = a.lastMessageTimestamp?.toMillis?.() || a.lastMessageTimestamp?.seconds * 1000 || 0;
          const timeB = b.lastMessageTimestamp?.toMillis?.() || b.lastMessageTimestamp?.seconds * 1000 || 0;
          return timeB - timeA;
        });

        onRoomsUpdate && onRoomsUpdate(rooms);
      },
      (err) => {
        if (!err?.message?.includes('Database') && !err?.message?.includes('offline')) {
          console.warn('Error in subscribeToUserRooms snapshot:', err);
        }
        onError && onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribeToUserRooms:', err);
    return () => {};
  }
};

/**
 * -------------------------------------------------------------
 * 3. MESSAGES SUB-COLLECTION (ChatRooms/{roomId}/Messages)
 * -------------------------------------------------------------
 */

// Send message to a ChatRoom and update parent room's lastMessage
export const sendFirestoreMessage = async (roomId, currentUser, messagePayload) => {
  if (!roomId || !currentUser?.uid) return null;
  const db = getFirebaseFirestore();
  if (!db) return null;

  const textContent = messagePayload.text || '';
  const mediaUrl = messagePayload.url || messagePayload.fileUrl || messagePayload.mediaUrl || null;
  const messageData = {
    roomId: roomId,
    senderId: currentUser.uid,
    senderUsername: currentUser.username || '',
    senderName: currentUser.displayName || currentUser.name || 'User',
    senderAvatar: currentUser.photoURL || currentUser.avatar || '',
    text: textContent,
    type: messagePayload.type || 'text',
    url: mediaUrl,
    fileUrl: mediaUrl,
    fileName: messagePayload.fileName || null,
    fileSize: messagePayload.fileSize || null,
    caption: messagePayload.caption || null,
    clientMsgId: messagePayload.id || messagePayload.clientMsgId || null,
    status: 'sent',
    timestamp: serverTimestamp()
  };

  try {
    // 1. Add document to Messages sub-collection
    const msgRef = await addDoc(collection(db, 'ChatRooms', roomId, 'Messages'), messageData);

    // 2. Update parent ChatRooms document with lastMessage & timestamp
    const roomRef = doc(db, 'ChatRooms', roomId);
    const lastPreview = textContent 
      || (messagePayload.type === 'image' ? '📷 Photo' : null)
      || (messagePayload.type === 'voice' ? '🎤 Voice message' : null)
      || (messagePayload.type === 'document' ? `📄 ${messagePayload.fileName || 'Document'}` : null)
      || 'Sent a message';

    await updateDoc(roomRef, {
      lastMessage: lastPreview,
      lastMessageTimestamp: serverTimestamp(),
      lastSenderId: currentUser.uid
    });

    return { id: msgRef.id, ...messageData };
  } catch (err) {
    console.error('Error sending Firestore message:', err);
    throw err;
  }
};

// Real-time listener for messages in a room (via onSnapshot)
export const subscribeToRoomMessages = (roomId, onMessagesUpdate, onError) => {
  if (!roomId) return () => {};
  const db = getFirebaseFirestore();
  if (!db) return () => {};

  try {
    const messagesQuery = query(
      collection(db, 'ChatRooms', roomId, 'Messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const messages = [];
        snapshot.forEach((d) => {
          const data = d.data();
          // Normalize timestamp to milliseconds / formatted time
          let formattedTime = 'Just now';
          let numericTimestamp = Date.now();

          if (data.timestamp?.toMillis) {
            numericTimestamp = data.timestamp.toMillis();
            formattedTime = new Date(numericTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } else if (data.timestamp?.seconds) {
            numericTimestamp = data.timestamp.seconds * 1000;
            formattedTime = new Date(numericTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }

          messages.push({
            id: d.id,
            ...data,
            time: formattedTime,
            timestamp: numericTimestamp
          });
        });

        onMessagesUpdate && onMessagesUpdate(messages);
      },
      (err) => {
        console.warn('Error in subscribeToRoomMessages snapshot:', err);
        onError && onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to room messages:', err);
    return () => {};
  }
};

/**
 * -------------------------------------------------------------
 * 4. STORIES / STATUS COLLECTION (Document ID: uid)
 * Real-time 24hr disappearing stories synced across all users & devices
 * -------------------------------------------------------------
 */

// Mark incoming messages in a room as read / seen
export const markFirestoreRoomMessagesAsRead = async (roomId, currentUid) => {
  if (!roomId || !currentUid) return;
  const db = getFirebaseFirestore();
  if (!db) return;

  try {
    const q = query(
      collection(db, 'ChatRooms', roomId, 'Messages'),
      where('status', '!=', 'read'),
      limit(25)
    );
    const snap = await getDocs(q);
    const updates = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.senderId !== currentUid) {
        updates.push(updateDoc(docSnap.ref, { status: 'read' }));
      }
    });
    if (updates.length > 0) {
      await Promise.all(updates);
    }
  } catch (e) {
    // Non-blocking
  }
};

// Publish or update a user's story in Firestore
export const publishFirestoreStory = async (currentUser, storyItem) => {
  const uid = currentUser?.uid || currentUser?.id;
  if (!uid) return null;
  const db = getFirebaseFirestore();
  if (!db) return null;

  const userStoryRef = doc(db, 'Stories', uid);

  try {
    const snap = await getDoc(userStoryRef);
    let existingItems = [];

    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    if (snap.exists()) {
      const data = snap.data();
      // Keep only active items from the last 24 hours
      existingItems = (data.items || []).filter((item) => {
        const itemTime = item.timestamp || item.createdAt || now;
        return (now - itemTime) < TWENTY_FOUR_HOURS;
      });
    }

    const newItem = {
      ...storyItem,
      id: storyItem.id || 'item_' + Date.now(),
      timestamp: storyItem.timestamp || now,
      seenBy: []
    };

    const storyData = {
      uid: uid,
      contactId: uid,
      contactName: currentUser.displayName || currentUser.name || currentUser.username || 'My Status',
      username: currentUser.username || '',
      avatar: currentUser.photoURL || currentUser.avatar || '',
      timestamp: serverTimestamp(),
      timeText: 'Just now',
      items: [...existingItems, newItem],
      updatedAt: serverTimestamp()
    };

    await setDoc(userStoryRef, storyData, { merge: true });
    return storyData;
  } catch (err) {
    console.error('Error publishing story to Firestore:', err);
    throw err;
  }
};

// Listen to all active stories across users (via onSnapshot)
export const subscribeToFirestoreStories = (currentUid, onStoriesUpdate, onError) => {
  const db = getFirebaseFirestore();
  if (!db) return () => {};

  try {
    const storiesRef = collection(db, 'Stories');
    const unsubscribe = onSnapshot(
      storiesRef,
      (snapshot) => {
        const stories = [];
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        snapshot.forEach((d) => {
          const data = d.data();
          // Filter items younger than 24 hours
          const activeItems = (data.items || []).filter((item) => {
            const itemTime = item.timestamp || item.createdAt || now;
            return (now - itemTime) < TWENTY_FOUR_HOURS;
          });

          if (activeItems.length > 0) {
            const isMe = currentUid && (data.uid === currentUid || data.contactId === currentUid);
            stories.push({
              id: d.id,
              uid: data.uid,
              contactId: isMe ? 'user' : data.uid,
              contactName: isMe ? 'My Status' : (data.contactName || data.username || 'Friend'),
              username: data.username || '',
              avatar: data.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${data.uid}`,
              timeText: data.timeText || 'Today',
              timestamp: data.updatedAt?.toMillis?.() || data.timestamp?.toMillis?.() || now,
              items: activeItems
            });
          }
        });

        // Sort stories: current user's story first, then recent updates descending
        stories.sort((a, b) => {
          if (a.contactId === 'user') return -1;
          if (b.contactId === 'user') return 1;
          return (b.timestamp || 0) - (a.timestamp || 0);
        });

        onStoriesUpdate && onStoriesUpdate(stories);
      },
      (err) => {
        console.warn('Stories snapshot error:', err);
        onError && onError(err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribeToFirestoreStories:', err);
    return () => {};
  }
};

// Delete entire user story document from Firestore
export const deleteFirestoreStory = async (uid) => {
  if (!uid) return;
  const db = getFirebaseFirestore();
  if (!db) return;

  try {
    await deleteDoc(doc(db, 'Stories', uid));
  } catch (e) {
    console.warn('Error deleting Firestore story:', e);
  }
};

// Delete specific story item from user's story in Firestore
export const deleteFirestoreStoryItem = async (uid, itemId) => {
  if (!uid || !itemId) return;
  const db = getFirebaseFirestore();
  if (!db) return;

  try {
    const storyRef = doc(db, 'Stories', uid);
    const snap = await getDoc(storyRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const remaining = (data.items || []).filter((it) => it.id !== itemId);

    if (remaining.length === 0) {
      await deleteDoc(storyRef);
    } else {
      await updateDoc(storyRef, {
        items: remaining,
        updatedAt: serverTimestamp()
      });
    }
  } catch (e) {
    console.warn('Error deleting story item:', e);
  }
};

// Mark story as seen by a contact
export const markFirestoreStorySeen = async (storyDocId, viewerUid, viewerName) => {
  if (!storyDocId || !viewerUid || storyDocId === viewerUid || storyDocId === 'user') return;
  const db = getFirebaseFirestore();
  if (!db) return;

  try {
    const storyRef = doc(db, 'Stories', storyDocId);
    const snap = await getDoc(storyRef);
    if (!snap.exists()) return;

    const data = snap.data();
    let hasChanged = false;
    const updatedItems = (data.items || []).map((item) => {
      const seenBy = item.seenBy || [];
      if (!seenBy.some((v) => (typeof v === 'string' ? v === viewerUid : v.uid === viewerUid))) {
        hasChanged = true;
        return {
          ...item,
          seenBy: [...seenBy, { uid: viewerUid, name: viewerName || 'Contact', time: Date.now() }]
        };
      }
      return item;
    });

    if (hasChanged) {
      await updateDoc(storyRef, { items: updatedItems });
    }
  } catch (e) {
    // Non-blocking
  }
};

/**
 * -------------------------------------------------------------
 * 6. PERSISTENT OFFLINE MESSAGE INBOX (OfflineInbox/{recipient}/Messages)
 * Ensures 100% reliable message delivery even when recipient is offline.
 * -------------------------------------------------------------
 */

// Save message to recipient's persistent offline inbox in Firestore
export const sendOfflineInboxMessage = async (recipientIdOrUsername, wirePayload) => {
  if (!recipientIdOrUsername || !wirePayload) return null;
  const db = getFirebaseFirestore();
  if (!db) return null;

  const cleanRecipient = String(recipientIdOrUsername).toLowerCase().trim().replace(/^@+/, '').replace(/^wa_user_/, '');
  if (!cleanRecipient) return null;

  try {
    const inboxRef = collection(db, 'OfflineInbox', cleanRecipient, 'Messages');
    const docData = {
      payload: wirePayload,
      recipient: cleanRecipient,
      createdAt: serverTimestamp()
    };
    const res = await addDoc(inboxRef, docData);
    return res.id;
  } catch (err) {
    console.warn('OfflineInbox dispatch notice:', err);
    return null;
  }
};

// Listen and auto-consume offline inbox messages for the current user across all their channels
export const subscribeToOfflineInbox = (userChannels = [], onMessageReceived) => {
  const db = getFirebaseFirestore();
  if (!db || !Array.isArray(userChannels) || userChannels.length === 0) return () => {};

  const cleanChannels = Array.from(
    new Set(
      userChannels
        .map((ch) => String(ch || '').toLowerCase().trim().replace(/^@+/, '').replace(/^wa_user_/, ''))
        .filter(Boolean)
    )
  );

  if (cleanChannels.length === 0) return () => {};

  const unsubscribes = [];

  cleanChannels.forEach((channel) => {
    try {
      const inboxRef = collection(db, 'OfflineInbox', channel, 'Messages');
      const unsub = onSnapshot(
        inboxRef,
        (snapshot) => {
          if (!snapshot.empty) {
            snapshot.docs.forEach(async (docSnap) => {
              const data = docSnap.data();
              if (data?.payload) {
                try {
                  onMessageReceived && onMessageReceived([data.payload]);
                } catch (e) {
                  console.error('Error handling offline inbox message:', e);
                }
                // Once delivered locally, delete the message from the inbox queue
                try {
                  await deleteDoc(docSnap.ref);
                } catch (delErr) {
                  console.warn('Error clearing consumed offline message:', delErr);
                }
              }
            });
          }
        },
        (err) => {
          // Graceful fallback if database permissions or offline
        }
      );
      unsubscribes.push(unsub);
    } catch (e) {
      console.warn('Error subscribing to channel:', channel, e);
    }
  });

  return () => {
    unsubscribes.forEach((unsub) => {
      try { unsub(); } catch (e) {}
    });
  };
};

// Manually fetch and sync all pending offline messages (e.g., on Refresh button click)
export const fetchOfflineInboxMessagesOnce = async (userChannels = [], onMessageReceived) => {
  const db = getFirebaseFirestore();
  if (!db || !Array.isArray(userChannels) || userChannels.length === 0) return 0;

  const cleanChannels = Array.from(
    new Set(
      userChannels
        .map((ch) => String(ch || '').toLowerCase().trim().replace(/^@+/, '').replace(/^wa_user_/, ''))
        .filter(Boolean)
    )
  );

  let totalFetched = 0;

  for (const channel of cleanChannels) {
    try {
      const inboxRef = collection(db, 'OfflineInbox', channel, 'Messages');
      const snap = await getDocs(inboxRef);
      if (!snap.empty) {
        for (const docSnap of snap.docs) {
          const data = docSnap.data();
          if (data?.payload) {
            try {
              onMessageReceived && onMessageReceived([data.payload]);
              totalFetched++;
            } catch (e) {}
            try {
              await deleteDoc(docSnap.ref);
            } catch (delErr) {}
          }
        }
      }
    } catch (err) {
      console.warn('Manual offline inbox fetch notice:', err);
    }
  }

  return totalFetched;
};

