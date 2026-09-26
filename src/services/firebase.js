import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta?.env?.VITE_FIREBASE_API_KEY || 'AIzaSyDWj2HnwMUA5TIkMwH4xfPskzrNVrfPpdI',
  authDomain: import.meta?.env?.VITE_FIREBASE_AUTH_DOMAIN || 'chatz-e3af3.firebaseapp.com',
  projectId: import.meta?.env?.VITE_FIREBASE_PROJECT_ID || 'chatz-e3af3',
  storageBucket: import.meta?.env?.VITE_FIREBASE_STORAGE_BUCKET || 'chatz-e3af3.firebasestorage.app',
  messagingSenderId: import.meta?.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '210827278981',
  appId: import.meta?.env?.VITE_FIREBASE_APP_ID || '1:210827278981:web:d4854b336d3b32d88e87ec'
};

export const isFirebaseConfigured = () => {
  return Boolean(
    firebaseConfig.apiKey && 
    firebaseConfig.authDomain && 
    firebaseConfig.projectId
  );
};

export const getFirebaseProjectId = () => {
  return firebaseConfig.projectId || '';
};

let app = null;
let auth = null;
let db = null;

export const getFirebaseApp = () => {
  if (!app && isFirebaseConfigured()) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
};

export const getFirebaseAuth = () => {
  if (!auth && isFirebaseConfigured()) {
    const firebaseApp = getFirebaseApp();
    auth = getAuth(firebaseApp);
  }
  return auth;
};

export const getFirebaseFirestore = () => {
  if (!db && isFirebaseConfigured()) {
    const firebaseApp = getFirebaseApp();
    db = getFirestore(firebaseApp);
  }
  return db;
};

// Initialize early if configured
if (isFirebaseConfigured()) {
  getFirebaseAuth();
  getFirebaseFirestore();
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { auth, db };

/**
 * Setup invisible reCAPTCHA verifier for phone auth
 * @param {string} containerId DOM element ID for reCAPTCHA widget
 */
export const setupRecaptcha = (containerId = 'recaptcha-container') => {
  const authInstance = getFirebaseAuth();
  if (!authInstance) return null;

  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      console.warn('Recaptcha clear warning:', e);
    }
    window.recaptchaVerifier = null;
  }

  // Clear any existing DOM children to avoid "placeholder must be empty" error
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
  }

  window.recaptchaVerifier = new RecaptchaVerifier(authInstance, containerId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved
    },
    'expired-callback': () => {
      console.warn('reCAPTCHA expired, please try again.');
    }
  });

  return window.recaptchaVerifier;
};

/**
 * Send real SMS OTP to phone number using Firebase
 * @param {string} fullPhoneNumber Phone number in E.164 format (e.g. +919876543210)
 * @param {string} containerId DOM ID for reCAPTCHA
 */
export const sendFirebaseOtp = async (fullPhoneNumber, containerId = 'recaptcha-container') => {
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    throw new Error('Firebase credentials not found. Please setup .env or use Demo OTP mode.');
  }

  const appVerifier = setupRecaptcha(containerId);
  const confirmationResult = await signInWithPhoneNumber(authInstance, fullPhoneNumber, appVerifier);
  return confirmationResult;
};

/**
 * Verify OTP entered by user
 * @param {import('firebase/auth').ConfirmationResult} confirmationResult
 * @param {string} otpCode 6-digit OTP code
 */
export const verifyFirebaseOtp = async (confirmationResult, otpCode) => {
  if (!confirmationResult) {
    throw new Error('Verification session expired. Please request a new OTP.');
  }
  const result = await confirmationResult.confirm(otpCode);
  return result.user;
};

/**
 * Sign up a new user with Email and Password
 * @param {string} email User email address
 * @param {string} password User password (min 6 characters)
 * @param {string} displayName Optional full name
 */
export const signUpWithEmail = async (email, password, displayName = '') => {
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    throw new Error('Firebase is not configured in .env. Please check your Firebase settings or use Demo mode.');
  }
  const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
  if (displayName && userCredential.user) {
    try {
      await updateProfile(userCredential.user, { displayName });
    } catch (e) {
      console.warn('Could not set displayName on Firebase user:', e);
    }
  }
  return userCredential.user;
};

/**
 * Sign in existing user with Email and Password (0 OTP, instant login)
 * @param {string} email User email address
 * @param {string} password User password
 */
export const logInWithEmail = async (email, password) => {
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    throw new Error('Firebase is not configured in .env. Please check your Firebase settings or use Demo mode.');
  }
  const userCredential = await signInWithEmailAndPassword(authInstance, email, password);
  return userCredential.user;
};

/**
 * Send Password Reset Email link to user's inbox
 * @param {string} email User email address
 */
export const sendPasswordReset = async (email) => {
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    throw new Error('Firebase is not configured.');
  }
  await sendPasswordResetEmail(authInstance, email);
};

/**
 * Send email verification link to user
 * @param {import('firebase/auth').User} user
 */
export const sendVerificationEmail = async (user) => {
  if (user) {
    await sendEmailVerification(user);
  }
};

/**
 * Sign in using Google popup via Firebase Auth
 */
export const signInWithGoogle = async () => {
  const authInstance = getFirebaseAuth();
  if (!authInstance) {
    throw new Error('Firebase is not configured in .env. Please configure Firebase or use Demo Gmail login.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(authInstance, provider);
  return result.user;
};

/**
 * User-friendly error message formatter for Firebase Auth errors
 */
export const formatFirebaseAuthError = (err) => {
  if (!err) return 'An error occurred during authentication.';
  const code = err.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Yeh email pehle se registered hai! Kripya neeche "Sign In" par click karke login karein.';
    case 'auth/invalid-email':
      return 'Email address ka format sahi nahi hai. Kripya apna valid email check karein.';
    case 'auth/weak-password':
      return 'Password kam se kam 6 characters ka hona chahiye.';
    case 'auth/user-not-found':
      return 'Is email se koi account nahi mila. Kripya neeche "Sign Up" par click karke naya account banayein.';
    case 'auth/wrong-password':
      return 'Galat password dala hai. Kripya dubara check karein ya "Forgot Password" karein.';
    case 'auth/invalid-credential':
      return 'Galat email ya password. Agar aap naye hain, toh neeche "Sign Up" par click karke account banayein.';
    case 'auth/operation-not-allowed':
      return 'Firebase Console me "Email/Password" method enable nahi hai. Firebase Console > Authentication > Sign-in method > Email/Password ko Enable karein (100% Free).';
    case 'auth/api-key-not-valid':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return 'Firebase API Key is invalid or expired. Check VITE_FIREBASE_API_KEY in .env or use Fast Demo Mode.';
    case 'auth/invalid-phone-number':
      return 'Invalid phone number format. Please check the country code and number.';
    case 'auth/quota-exceeded':
      return 'Firebase quota limit reached. Please wait a few minutes or switch to Fast Demo Mode.';
    case 'auth/billing-not-enabled':
      return 'Firebase billing not enabled. You can use free Email/Password or Google login without billing.';
    case 'auth/too-many-requests':
      return 'Bahut jyada baar galat try kiya gaya. Kripya 2-3 minute rukiye ya password reset karein.';
    case 'auth/unauthorized-domain':
      return 'Domain not authorized. Firebase Console (console.firebase.google.com) > Authentication > Settings > Authorized domains me jakar "chat-z-blue.vercel.app" add karein.';
    case 'auth/popup-closed-by-user':
      return 'Google Sign-In window close ho gayi. Kripya dubara try karein.';
    case 'auth/popup-blocked':
      return 'Browser ne Google popup block kar diya. Browser setting me popups allow karein.';
    case 'auth/network-request-failed':
      return 'Network connection error. Kripya apna internet connection check karein.';
    default:
      return err.message || 'Authentication error. Please try again.';
  }
};
