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
        try {
          // Check if profile exists in Firestore Users collection
          const profile = await getFirestoreUserProfile(user.uid);
          if (profile) {
            setCurrentUser(profile);
            localStorage.setItem('chatz_user_v1', JSON.stringify(profile));
          } else {
            // New user without Firestore profile yet: prompt or auto-register
            const defaultUsername = (user.email ? user.email.split('@')[0] : (user.displayName || 'user'))
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '');

            const newProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || defaultUsername,
              username: defaultUsername || `user_${Math.floor(Math.random() * 10000)}`,
              photoURL: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
              about: 'Hey there! I am using Chatz'
            };

            await saveFirestoreUserProfile(newProfile);
            setCurrentUser(newProfile);
            localStorage.setItem('chatz_user_v1', JSON.stringify(newProfile));
          }
        } catch (err) {
          console.warn('Error fetching Firestore user on auth change:', err);
          // Graceful fallback to Firebase Auth user fields
          const fallback = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'User',
            username: (user.email ? user.email.split('@')[0] : 'user').toLowerCase().replace(/[^a-z0-9_]/g, ''),
            photoURL: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`,
            about: 'Hey there! I am using Chatz'
          };
          setCurrentUser(fallback);
          localStorage.setItem('chatz_user_v1', JSON.stringify(fallback));
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem('chatz_user_v1');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 1-Click Google Sign-In Flow
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

      // Check if user exists in Firestore
      const existingProfile = await getFirestoreUserProfile(user.uid);
      if (existingProfile) {
        // Existing user: log in directly
        setCurrentUser(existingProfile);
        localStorage.setItem('chatz_user_v1', JSON.stringify(existingProfile));
        setLoading(false);
        return existingProfile;
      }

      // New User: derive username and create Firestore Users document
      const baseName = user.email ? user.email.split('@')[0] : (user.displayName || 'user');
      const cleanU = baseName.toLowerCase().replace(/[^a-z0-9_]/g, '') || `user_${Math.floor(Math.random() * 10000)}`;

      const newProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || cleanU,
        username: cleanU,
        photoURL: user.photoURL || `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanU}`,
        about: 'Hey there! I am using Chatz'
      };

      await saveFirestoreUserProfile(newProfile);
      setCurrentUser(newProfile);
      localStorage.setItem('chatz_user_v1', JSON.stringify(newProfile));
      setLoading(false);
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
