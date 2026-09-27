import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { 
  getFirebaseAuth, 
  googleProvider, 
  isFirebaseConfigured 
} from '../services/firebase';
import { 
  getFirestoreUserProfile, 
  saveFirestoreUserProfile 
} from '../services/firestoreChat';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null); // When a new user needs username confirmation

  // Sync auth state with Firebase Auth
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      // Local fallback from localStorage if Firebase is not active
      const local = localStorage.getItem('chatz_user_v1');
      if (local) {
        try { setCurrentUser(JSON.parse(local)); } catch (e) {}
      }
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        // Read existing local profile first to NEVER overwrite user's saved avatar, name, or username
        let localProfile = null;
        try {
          const raw = localStorage.getItem('chatz_user_v1');
          if (raw) localProfile = JSON.parse(raw);
        } catch (e) {}

        const isSameAccount = localProfile && (
          localProfile.uid === user.uid ||
          localProfile.id === user.uid ||
          (localProfile.email && user.email && localProfile.email.toLowerCase() === user.email.toLowerCase())
        );

        const defaultUsername = (user.email ? user.email.split('@')[0] : (user.displayName || 'user'))
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '') || `user_${Math.floor(Math.random() * 10000)}`;

        const preservedAvatar = (isSameAccount && (localProfile.avatar || localProfile.photoURL))
          ? (localProfile.avatar || localProfile.photoURL)
          : (user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`);

        const fastProfile = {
          uid: user.uid,
          id: user.uid,
          email: user.email || (isSameAccount ? localProfile.email : ''),
          displayName: (isSameAccount && localProfile.displayName) ? localProfile.displayName : (user.displayName || defaultUsername),
          name: (isSameAccount && localProfile.name) ? localProfile.name : (user.displayName || defaultUsername),
          username: (isSameAccount && localProfile.username) ? localProfile.username : defaultUsername,
          photoURL: preservedAvatar,
          avatar: preservedAvatar,
          about: (isSameAccount && localProfile.about) ? localProfile.about : 'Hey there! I am using baat chit',
          gender: (isSameAccount && localProfile.gender) ? localProfile.gender : 'male',
          authMethod: (isSameAccount && localProfile.authMethod) ? localProfile.authMethod : 'google',
          joinedAt: (isSameAccount && localProfile.joinedAt) ? localProfile.joinedAt : Date.now()
        };

        // Immediately activate user session preserving custom avatar
        setCurrentUser(fastProfile);
        try {
          localStorage.setItem('chatz_user_v1', JSON.stringify(fastProfile));
        } catch (e) {}
        setLoading(false);

        // Background check for custom Firestore profile attributes (non-blocking)
        getFirestoreUserProfile(user.uid)
          .then((remoteProfile) => {
            if (remoteProfile) {
              let currentLocal = null;
              try {
                const raw = localStorage.getItem('chatz_user_v1');
                if (raw) currentLocal = JSON.parse(raw);
              } catch (e) {}

              // Never overwrite a custom avatar with an older one or empty one
              const finalAvatar = currentLocal?.avatar || currentLocal?.photoURL || remoteProfile.photoURL || remoteProfile.avatar || fastProfile.avatar;

              const merged = {
                ...fastProfile,
                ...remoteProfile,
                ...currentLocal,
                id: remoteProfile.uid || user.uid,
                uid: remoteProfile.uid || user.uid,
                name: currentLocal?.name || remoteProfile.displayName || remoteProfile.name || fastProfile.name,
                displayName: currentLocal?.displayName || remoteProfile.displayName || remoteProfile.name || fastProfile.name,
                username: currentLocal?.username || remoteProfile.username || fastProfile.username,
                avatar: finalAvatar,
                photoURL: finalAvatar
              };
              setCurrentUser(merged);
              try {
                localStorage.setItem('chatz_user_v1', JSON.stringify(merged));
              } catch (e) {}
            }
          })
          .catch(() => {});
      } else {
        // User not logged into Firebase Auth. Check if we have a locally active user session!
        const local = localStorage.getItem('chatz_user_v1');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (parsed && (parsed.username || parsed.name || parsed.id || parsed.uid)) {
              // Maintain local session (e.g. password login, demo mode, guest)
              setCurrentUser(parsed);
              setLoading(false);
              return;
            }
          } catch (e) {}
        }
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 1-Click Google Sign-In Flow (Instant, non-blocking)
  const loginWithGoogle = async () => {
    setAuthError(null);
    setLoading(true);

    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      throw new Error('Firebase Auth is not configured.');
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (!user) throw new Error('No user returned from Google Sign-In.');

      // Check existing local profile to preserve custom avatar
      let localProfile = null;
      try {
        const raw = localStorage.getItem('chatz_user_v1');
        if (raw) localProfile = JSON.parse(raw);
      } catch (e) {}

      const isSameAccount = localProfile && (
        localProfile.uid === user.uid ||
        localProfile.id === user.uid ||
        (localProfile.email && user.email && localProfile.email.toLowerCase() === user.email.toLowerCase())
      );

      const baseName = user.email ? user.email.split('@')[0] : (user.displayName || 'user');
      const cleanU = (isSameAccount && localProfile.username) 
        ? localProfile.username 
        : (baseName.toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${Math.floor(Math.random() * 10000)}`);

      const preservedAvatar = (isSameAccount && (localProfile.avatar || localProfile.photoURL))
        ? (localProfile.avatar || localProfile.photoURL)
        : (user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanU}`);

      const newProfile = {
        uid: user.uid,
        id: user.uid,
        email: user.email || '',
        displayName: (isSameAccount && localProfile.displayName) ? localProfile.displayName : (user.displayName || cleanU),
        name: (isSameAccount && localProfile.name) ? localProfile.name : (user.displayName || cleanU),
        username: cleanU,
        photoURL: preservedAvatar,
        avatar: preservedAvatar,
        about: (isSameAccount && localProfile.about) ? localProfile.about : 'Hey there! I am using baat chit',
        gender: (isSameAccount && localProfile.gender) ? localProfile.gender : 'male',
        authMethod: 'google',
        joinedAt: (isSameAccount && localProfile.joinedAt) ? localProfile.joinedAt : Date.now()
      };

      // Set user immediately! 0ms latency, never stuck on Signing In
      setCurrentUser(newProfile);
      try {
        localStorage.setItem('chatz_user_v1', JSON.stringify(newProfile));
      } catch (e) {}
      setLoading(false);

      // Background Firestore sync (fire-and-forget, never blocks UI)
      saveFirestoreUserProfile(newProfile).catch(() => {});

      return newProfile;
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      setAuthError(err.message || 'Google Sign-In failed');
      setLoading(false);
      throw err;
    }
  };

  // Logout Flow
  const logout = async () => {
    try {
      const auth = getFirebaseAuth();
      if (auth) {
        await signOut(auth);
      }
    } catch (e) {
      console.warn('SignOut warning:', e);
    }
    setCurrentUser(null);
    setFirebaseUser(null);
    localStorage.removeItem('chatz_user_v1');
    localStorage.removeItem('wa_clone_current_user_v2');
  };

  // Update Profile
  const updateUserProfile = async (updatedData) => {
    try {
      let localProfile = null;
      try {
        const raw = localStorage.getItem('chatz_user_v1');
        if (raw) localProfile = JSON.parse(raw);
      } catch (e) {}

      const targetAvatar = updatedData.avatar || updatedData.photoURL || localProfile?.avatar || currentUser?.avatar;
      const merged = {
        ...localProfile,
        ...currentUser,
        ...updatedData,
        avatar: targetAvatar,
        photoURL: targetAvatar
      };

      setCurrentUser(merged);
      try {
        localStorage.setItem('chatz_user_v1', JSON.stringify(merged));
      } catch (e) {}

      if (merged.uid) {
        saveFirestoreUserProfile(merged).catch((err) => console.warn('Firestore profile sync error:', err));
      }

      return merged;
    } catch (err) {
      console.error('Failed to update profile in Firestore:', err);
      const merged = { ...currentUser, ...updatedData };
      setCurrentUser(merged);
      try {
        localStorage.setItem('chatz_user_v1', JSON.stringify(merged));
      } catch (e) {}
      return merged;
    }
  };

  const value = {
    currentUser,
    firebaseUser,
    loading,
    authError,
    loginWithGoogle,
    logout,
    updateUserProfile,
    setCurrentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
