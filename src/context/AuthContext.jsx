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
        // Construct fast profile immediately from Firebase Auth user
        const defaultUsername = (user.email ? user.email.split('@')[0] : (user.displayName || 'user'))
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '') || `user_${Math.floor(Math.random() * 10000)}`;

        const fastProfile = {
          uid: user.uid,
          id: user.uid,
          email: user.email || '',
          displayName: user.displayName || defaultUsername,
          name: user.displayName || defaultUsername,
          username: defaultUsername,
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
          avatar: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
          about: 'Hey there! I am using Chatz',
          authMethod: 'google',
          joinedAt: Date.now()
        };

        // Immediately activate user session (0ms delay)
        setCurrentUser(fastProfile);
        localStorage.setItem('chatz_user_v1', JSON.stringify(fastProfile));
        setLoading(false);

        // Background check for custom Firestore profile attributes (non-blocking)
        getFirestoreUserProfile(user.uid)
          .then((profile) => {
            if (profile) {
              const merged = {
                ...fastProfile,
                ...profile,
                id: profile.uid || user.uid,
                name: profile.displayName || profile.name || fastProfile.name,
                avatar: profile.photoURL || profile.avatar || fastProfile.avatar
              };
              setCurrentUser(merged);
              localStorage.setItem('chatz_user_v1', JSON.stringify(merged));
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

      // Derive clean username and instant profile
      const baseName = user.email ? user.email.split('@')[0] : (user.displayName || 'user');
      const cleanU = baseName.toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${Math.floor(Math.random() * 10000)}`;

      const newProfile = {
        uid: user.uid,
        id: user.uid,
        email: user.email || '',
        displayName: user.displayName || cleanU,
        name: user.displayName || cleanU,
        username: cleanU,
        photoURL: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanU}`,
        avatar: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanU}`,
        about: 'Hey there! I am using Chatz',
        authMethod: 'google',
        joinedAt: Date.now()
      };

      // Set user immediately! 0ms latency, never stuck on Signing In
      setCurrentUser(newProfile);
      localStorage.setItem('chatz_user_v1', JSON.stringify(newProfile));
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
    if (!currentUser?.uid) return;
    try {
      const merged = { ...currentUser, ...updatedData };
      await saveFirestoreUserProfile(merged);
      setCurrentUser(merged);
      localStorage.setItem('chatz_user_v1', JSON.stringify(merged));
      return merged;
    } catch (err) {
      console.error('Failed to update profile in Firestore:', err);
      // Update locally
      const merged = { ...currentUser, ...updatedData };
      setCurrentUser(merged);
      localStorage.setItem('chatz_user_v1', JSON.stringify(merged));
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
