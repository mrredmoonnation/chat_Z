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

// Fetch user profile from Firestore Users collection
export const getFirestoreUserProfile = async (uid) => {
  if (!uid) return null;
  const db = getFirebaseFirestore();
  if (!db) return null;

  try {
    const userDocRef = doc(db, 'Users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.warn('Error fetching Firestore user profile:', err);
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
    await setDoc(userDocRef, data, { merge: true });
    return data;
  } catch (err) {
    console.error('Error saving Firestore user profile:', err);
    throw err;
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
        console.warn('Error in subscribeToUserRooms snapshot:', err);
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
  const messageData = {
    roomId: roomId,
    senderId: currentUser.uid,
    senderUsername: currentUser.username || '',
    senderName: currentUser.displayName || currentUser.name || 'User',
    senderAvatar: currentUser.photoURL || currentUser.avatar || '',
    text: textContent,
    type: messagePayload.type || 'text',
    fileUrl: messagePayload.fileUrl || messagePayload.mediaUrl || null,
    fileName: messagePayload.fileName || null,
    status: 'sent',
    timestamp: serverTimestamp()
  };

  try {
    // 1. Add document to Messages sub-collection
    const msgRef = await addDoc(collection(db, 'ChatRooms', roomId, 'Messages'), messageData);

    // 2. Update parent ChatRooms document with lastMessage & timestamp
    const roomRef = doc(db, 'ChatRooms', roomId);
    await updateDoc(roomRef, {
      lastMessage: textContent || (messagePayload.type ? `[${messagePayload.type}]` : 'Sent a file'),
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
