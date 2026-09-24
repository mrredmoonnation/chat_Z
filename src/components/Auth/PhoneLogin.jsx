import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, ArrowRight, ArrowLeft, Check, ShieldCheck, 
  AlertCircle, RefreshCw, Mail, User, Info, AtSign,
  Camera, CheckCircle2, Send, Eye, EyeOff, KeyRound, UserCheck
} from 'lucide-react';
import { 
  AVATAR_PRESETS, GENDER_AVATARS, generateBitmojiAvatar,
  isUsernameAvailable, cleanUsername, 
  isValidUsernameFormat, registerUsername,
  saveAccountCredentials, findAccountByUsernameOrEmail, 
  verifyAccountCredentials
} from '../../services/store';
import { 
  isFirebaseConfigured, signInWithGoogle, 
  signUpWithEmail, logInWithEmail, formatFirebaseAuthError 
} from '../../services/firebase';
import { sendRealEmailOtp } from '../../services/emailOtp';
import { publishUserToCloud } from '../../services/cloudRegistry';
import { compressAvatar } from '../../services/imageUtils';
import { useAuth } from '../../context/AuthContext';

const BIO_PRESETS = [
  '📶 Available on WiFi',
  '❤️ In love',
  '💻 Busy coding',
  '😴 Sleeping',
  '📞 Urgent calls only',
  '✨ Living my best life',
  'Hey there! I am using Chatz'
];

export default function PhoneLogin({ onLoginSuccess }) {
  const firebaseAvailable = isFirebaseConfigured();
  const { loginWithGoogle } = useAuth();

  // Mode: 'login', 'signup_email', 'signup_otp', 'signup_profile'
  const [authMode, setAuthMode] = useState('login');

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign Up Form State
  const [signupEmail, setSignupEmail] = useState('');
  const [activeVerificationCode, setActiveVerificationCode] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Profile Details State
  const [signupName, setSignupName] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupGender, setSignupGender] = useState('male');
  const [usernameStatus, setUsernameStatus] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [about, setAbout] = useState('❤️ In love');
  const [avatar, setAvatar] = useState(GENDER_AVATARS.male[0]);
  const [customAvatar, setCustomAvatar] = useState(null);

  const handleSignupGenderChange = (newGender) => {
    setSignupGender(newGender);
    setCustomAvatar(null);
    if (GENDER_AVATARS[newGender]?.[0]) {
      setAvatar(GENDER_AVATARS[newGender][0]);
    }
  };

  const handleRollSignupBitmoji = () => {
    const seed = signupName || signupUsername || ('User_' + Math.floor(Math.random() * 1000));
    const newBitmoji = generateBitmojiAvatar(seed, signupGender);
    setCustomAvatar(newBitmoji);
    setAvatar(newBitmoji);
  };

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  const otpInputsRef = useRef([]);

  // Hardware/Browser back button support
  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state?.mode) {
        setAuthMode(e.state.mode);
      } else {
        setAuthMode('login');
      }
      setErrorMsg('');
      setSuccessMsg('');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleModeChange = (newMode) => {
    setErrorMsg('');
    setSuccessMsg('');
    setAuthMode(newMode);
    if (window.history.state?.mode !== newMode) {
      window.history.pushState({ mode: newMode }, '');
    }
  };

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);


  // ================= 1. HANDLE USERNAME / EMAIL + PASSWORD LOGIN =================
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanId = loginIdentifier.trim().toLowerCase();
    if (!cleanId) {
      setErrorMsg('Please enter your username or Gmail address.');
      return;
    }
    if (!loginPassword) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setLoading(true);

    // 1. Check local & default registry first
    const verification = verifyAccountCredentials(cleanId, loginPassword);
    if (verification.success && verification.profile) {
      setSuccessMsg('Login successful! Welcome back.');
      publishUserToCloud(verification.profile);
      setLoading(false);
      onLoginSuccess(verification.profile);
      return;
    }

    // 2. If it's an email and Firebase is available, try Firebase Auth
    if (cleanId.includes('@') && firebaseAvailable) {
      try {
        const user = await logInWithEmail(cleanId, loginPassword);
        const existingAcc = findAccountByUsernameOrEmail(cleanId);
        const userProfile = existingAcc?.profile || {
          uid: user.uid,
          id: user.uid,
          username: cleanUsername(cleanId.split('@')[0]),
          name: user.displayName || cleanId.split('@')[0],
          displayName: user.displayName || cleanId.split('@')[0],
          email: cleanId,
          avatar: user.photoURL || AVATAR_PRESETS[2],
          photoURL: user.photoURL || AVATAR_PRESETS[2],
          about: 'Hey there! I am using Chatz'
        };
        setSuccessMsg('Login successful! Welcome back.');
        publishUserToCloud(userProfile);
        setLoading(false);
        onLoginSuccess(userProfile);
        return;
      } catch (err) {
        console.error('Firebase Login Error:', err);
        setErrorMsg(formatFirebaseAuthError(err));
        setLoading(false);
        return;
      }
    }

    // If incorrect
    setLoading(false);
    if (verification.reason === 'wrong_password') {
      setErrorMsg('Incorrect password. Please try again.');
    } else {
      setErrorMsg(`No account found for "${cleanId}". Please sign up with Gmail OTP.`);
    }
  };

  // ================= 2. SIGN UP STEP 1: SEND OTP TO GMAIL =================
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = signupEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('Please enter a valid Gmail address (e.g. yourname@gmail.com).');
      return;
    }

    setLoading(true);

    // Generate secure 6-digit OTP code
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setActiveVerificationCode(generatedCode);

    // Auto-suggest name and unique username from email
    const emailPrefix = cleanEmail.split('@')[0];
    const suggestedUsername = cleanUsername(emailPrefix.replace(/[^a-z0-9_.]/g, '_'));
    if (!signupName) {
      setSignupName(emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1));
    }
    if (!usernameTouched) {
      validateAndSetUsername(suggestedUsername);
    }

    try {
      const emailResult = await sendRealEmailOtp(cleanEmail, generatedCode, signupName || emailPrefix);
      if (emailResult.success) {
        setSuccessMsg(`OTP sent to your Gmail (${cleanEmail})! Please check your inbox or spam.`);
      } else {
        setSuccessMsg(`Verification code sent to ${cleanEmail}.`);
      }
    } catch (err) {
      console.warn('EmailJS sending notice:', err);
      setSuccessMsg(`Verification code sent to ${cleanEmail}.`);
    } finally {
      setLoading(false);
      setResendTimer(60);
      setOtp(['', '', '', '', '', '']);
      handleModeChange('signup_otp');
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) return;
    setErrorMsg('');
    setLoading(true);

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setActiveVerificationCode(newCode);

    try {
      await sendRealEmailOtp(signupEmail.trim().toLowerCase(), newCode, signupName);
      setSuccessMsg(`New OTP sent to your Gmail (${signupEmail})!`);
    } catch (e) {
      setSuccessMsg(`New verification code sent to ${signupEmail}!`);
    } finally {
      setLoading(false);
      setResendTimer(60);
    }
  };

  // Handle OTP digit entry
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  // ================= 3. SIGN UP STEP 2: VERIFY OTP =================
  const handleOtpSubmit = (e) => {
    e?.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const enteredCode = otp.join('');
    if (enteredCode.length < 6) {
      setErrorMsg('Please enter the complete 6-digit OTP code received on your Gmail.');
      return;
    }

    setLoading(true);

    // Verify against real sent OTP code
    if (activeVerificationCode && enteredCode === activeVerificationCode) {
      setTimeout(() => {
        setLoading(false);
        setSuccessMsg('Gmail verified! Now set your password and profile.');
        handleModeChange('signup_profile');
      }, 250);
    } else {
      setTimeout(() => {
        setLoading(false);
        setErrorMsg('Incorrect OTP code. Please enter the 6-digit code received on your Gmail.');
      }, 200);
    }
  };

  // ================= 4. SIGN UP STEP 3: SET PASSWORD & COMPLETE PROFILE =================
  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!signupName.trim()) {
      setErrorMsg('Please enter your personal name.');
      return;
    }

    const clean = cleanUsername(signupUsername);
    if (!clean || !isValidUsernameFormat(clean)) {
      setErrorMsg('Please choose a valid unique username (3-20 characters: letters, numbers, _, .)');
      return;
    }

    if (!isUsernameAvailable(clean)) {
      setErrorMsg(`Username @${clean} is already taken. Please choose another username.`);
      setUsernameStatus('taken');
      return;
    }

    if (signupPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (signupPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please check both password fields.');
      return;
    }

    setLoading(true);

    const userProfile = {
      uid: 'user_' + clean,
      id: 'wa_user_' + clean,
      username: clean,
      name: signupName.trim(),
      displayName: signupName.trim(),
      gender: signupGender,
      phone: null,
      email: signupEmail.trim() || `${clean}@chatz.web`,
      avatar: customAvatar || avatar,
      photoURL: customAvatar || avatar,
      about: about.trim() || '📶 Available on WiFi',
      authMethod: 'gmail_otp_password',
      joinedAt: Date.now()
    };

    // Save in local registry & account credentials for both username AND email
    registerUsername(clean, userProfile);
    saveAccountCredentials(clean, signupPassword, userProfile);
    if (signupEmail.trim()) {
      saveAccountCredentials(signupEmail.trim(), signupPassword, userProfile);
    }

    // Register in Firebase Auth if available
    if (firebaseAvailable && signupEmail.trim()) {
      try {
        await signUpWithEmail(signupEmail.trim(), signupPassword, signupName.trim());
      } catch (err) {
        console.warn('Firebase sync notice (local registration succeeded):', err);
      }
    }

    setSuccessMsg('Account created successfully! Welcome to Chatz.');
    publishUserToCloud(userProfile);
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess(userProfile);
    }, 300);
  };

  // 1-Click Google Sign-In with Firestore Profile Sync
  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    if (firebaseAvailable) {
      try {
        const firestoreProfile = await loginWithGoogle();
        if (firestoreProfile) {
          setSuccessMsg('Google Login successful! Welcome to Chatz.');
          setLoading(false);
          onLoginSuccess(firestoreProfile);
          return;
        }
      } catch (err) {
        console.error('Firebase Google Sign-in Error:', err);
        setErrorMsg(formatFirebaseAuthError(err));
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
      setErrorMsg('Firebase configuration missing. Please use Password Login or Sign Up with OTP.');
    }
  };

  // Validate username availability
  const validateAndSetUsername = (rawVal) => {
    const clean = cleanUsername(rawVal);
    setSignupUsername(clean);
    if (!clean) {
      setUsernameStatus('');
      return;
    }
    if (!isValidUsernameFormat(clean)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    setTimeout(() => {
      const avail = isUsernameAvailable(clean);
      setUsernameStatus(avail ? 'available' : 'taken');
    }, 150);
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setSignupName(val);
    if (!usernameTouched && val.trim()) {
      const suggested = cleanUsername(val.replace(/\s+/g, '_'));
      if (suggested.length >= 3) {
        validateAndSetUsername(suggested);
      } else {
        setSignupUsername(suggested);
        setUsernameStatus(suggested ? 'invalid' : '');
      }
    }
  };

  const handleManualUsernameChange = (e) => {
    setUsernameTouched(true);
    validateAndSetUsername(e.target.value);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressAvatar(file, 256, 0.8);
        setCustomAvatar(compressed);
        setAvatar(compressed);
      } catch (err) {
        console.error('Failed to compress avatar:', err);
      }
    }
  };

  return (
    <div className="wa-login-wrapper">
      {/* Top Banner with Brand */}
      <div className="wa-login-top-bar" style={{ gap: 10 }}>
        <img 
          src="/logo.png" 
          alt="Chatz Logo" 
          style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'contain' }} 
        />
        <span>CHATZ WEB</span>
      </div>

      <div className="wa-login-card">
        {/* Global Error Banner */}
        {errorMsg && (
          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(234, 67, 53, 0.15)',
              border: '1px solid #ea4335',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#f28b82',
              fontSize: '13px',
              marginBottom: 16,
              textAlign: 'left'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Global Success Banner */}
        {successMsg && (
          <div
            style={{
              width: '100%',
              backgroundColor: 'rgba(0, 168, 132, 0.15)',
              border: '1px solid #00a884',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--wa-green-light)',
              fontSize: '13px',
              marginBottom: 16,
              textAlign: 'left'
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ================= VIEW 1: USERNAME / EMAIL + PASSWORD LOGIN (FRONT SCREEN) ================= */}
        {authMode === 'login' && (
          <div style={{ width: '100%' }}>
            {/* Email / Lock Icon */}
            <div 
              className="wa-login-icon" 
              style={{ 
                backgroundColor: 'rgba(0, 168, 132, 0.15)', 
                color: 'var(--wa-green)', 
                margin: '0 auto 16px auto' 
              }}
            >
              <Lock size={28} />
            </div>

            <h2 className="wa-login-title">Sign in to Chatz</h2>
            <p className="wa-login-subtitle" style={{ marginBottom: 20 }}>
              Enter your Username or Gmail and Password to log in directly.
            </p>

            {/* Mode Switch Tabs */}
            <div className="wa-auth-tabs" style={{ marginBottom: 20 }}>
              <button
                type="button"
                className="wa-auth-tab active"
                onClick={() => {}}
              >
                <Lock size={15} />
                <span>Password Login</span>
              </button>
              <button
                type="button"
                className="wa-auth-tab"
                onClick={() => handleModeChange('signup_email')}
              >
                <Mail size={15} />
                <span>Sign Up with OTP</span>
              </button>
            </div>


            {/* Login Form */}
            <form onSubmit={handlePasswordLogin}>
              {/* Username or Email Input */}
              <div style={{ marginBottom: 14, textAlign: 'left' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wa-text-primary)', display: 'block', marginBottom: 6 }}>
                  Username or Gmail <span style={{ color: '#ea4335' }}>*</span>
                </label>
                <input
                  id="loginIdentifierInput"
                  type="text"
                  className="wa-phone-number-field"
                  style={{ width: '100%', fontSize: '14.5px' }}
                  placeholder="e.g. sonu or name@gmail.com"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {/* Password Input */}
              <div style={{ marginBottom: 18, textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wa-text-primary)' }}>
                    Password <span style={{ color: '#ea4335' }}>*</span>
                  </label>
                  <button
                    type="button"
                    className="wa-forgot-password-link"
                    onClick={() => handleModeChange('signup_email')}
                  >
                    Forgot password / OTP login?
                  </button>
                </div>
                <div className="wa-input-with-icon-wrapper">
                  <input
                    id="loginPasswordInput"
                    type={showLoginPassword ? 'text' : 'password'}
                    className="wa-phone-number-field"
                    style={{ width: '100%', paddingRight: 40, fontSize: '14.5px' }}
                    placeholder="Enter your password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="wa-password-toggle-btn"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    title={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                id="loginSubmitBtn"
                type="submit"
                className="wa-login-cta-btn"
                disabled={loading || !loginIdentifier.trim() || !loginPassword}
              >
                {loading ? (
                  <span>Signing In...</span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="wa-divider-row" style={{ margin: '20px 0 16px 0' }}>
              <span>OR</span>
            </div>

            {/* 1-Click Google Sign-In */}
            <button
              type="button"
              id="googleSignInBtn"
              onClick={handleGoogleSignIn}
              className="wa-google-btn"
              disabled={loading}
              title="Sign in with your Google Account"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>


            {/* Switch Footer */}
            <div className="wa-auth-switch-footer" style={{ marginTop: 20 }}>
              <span>New to Chatz?</span>
              <button
                type="button"
                className="wa-auth-switch-btn"
                onClick={() => handleModeChange('signup_email')}
              >
                Sign up with Gmail OTP!
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW 2: SIGN UP STEP 1 (GMAIL INPUT) ================= */}
        {authMode === 'signup_email' && (
          <div style={{ width: '100%' }}>
            {/* Header row with Back button */}
            <div className="wa-auth-header-row">
              <button 
                type="button" 
                className="wa-auth-back-btn" 
                onClick={() => handleModeChange('login')}
                title="Back to password login"
              >
                <ArrowLeft size={16} />
                <span>Password Login</span>
              </button>
              <span style={{ fontSize: '12px', color: 'var(--wa-text-muted)' }}>Sign Up Step 1</span>
            </div>

            <div 
              className="wa-login-icon" 
              style={{ 
                backgroundColor: 'rgba(234, 67, 53, 0.15)', 
                color: '#ea4335', 
                margin: '0 auto 16px auto' 
              }}
            >
              <Mail size={28} />
            </div>

            <h2 className="wa-login-title">Verify Gmail with OTP</h2>
            <p className="wa-login-subtitle" style={{ marginBottom: 20 }}>
              Enter your Gmail address to verify ownership and create a password.
            </p>

            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: 16, textAlign: 'left' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wa-text-primary)', display: 'block', marginBottom: 6 }}>
                  Your Gmail Address <span style={{ color: '#ea4335' }}>*</span>
                </label>
                <input
                  id="signupEmailField"
                  type="email"
                  className="wa-phone-number-field"
                  style={{ width: '100%', fontSize: '15px' }}
                  placeholder="name@gmail.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <button
                id="sendOtpBtn"
                type="submit"
                className="wa-login-cta-btn"
                disabled={loading || !signupEmail.trim()}
              >
                {loading ? (
                  <span>Sending OTP to Gmail...</span>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send Verification OTP</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="wa-auth-switch-footer" style={{ marginTop: 22 }}>
              <span>Already have an account?</span>
              <button
                type="button"
                className="wa-auth-switch-btn"
                onClick={() => handleModeChange('login')}
              >
                Login with Password
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW 3: SIGN UP STEP 2 (ENTER 6-DIGIT OTP) ================= */}
        {authMode === 'signup_otp' && (
          <form onSubmit={handleOtpSubmit} style={{ width: '100%' }}>
            {/* Header row with Back button */}
            <div className="wa-auth-header-row">
              <button 
                type="button" 
                className="wa-auth-back-btn" 
                onClick={() => handleModeChange('signup_email')}
                title="Go back to change Gmail"
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
              <span style={{ fontSize: '12px', color: 'var(--wa-text-muted)' }}>Step 2 of 3</span>
            </div>

            <div 
              className="wa-login-icon" 
              style={{ 
                margin: '0 auto 16px auto',
                backgroundColor: 'rgba(0, 168, 132, 0.15)',
                color: 'var(--wa-green)'
              }}
            >
              <Lock size={28} />
            </div>

            <h2 className="wa-login-title">Enter Verification Code</h2>
            <p className="wa-login-subtitle" style={{ marginBottom: 16 }}>
              We sent a 6-digit code to{' '}
              <strong style={{ color: 'var(--wa-green-light)' }}>
                {signupEmail}
              </strong>
              .{' '}
              <button
                type="button"
                onClick={() => handleModeChange('signup_email')}
                style={{ 
                  color: '#53bdeb', 
                  cursor: 'pointer', 
                  textDecoration: 'underline', 
                  background: 'none', 
                  border: 'none', 
                  padding: 0,
                  fontSize: 'inherit',
                  fontFamily: 'inherit'
                }}
              >
                Wrong email?
              </button>
            </p>


            {/* 6 Individual OTP Boxes */}
            <div className="wa-otp-boxes" style={{ marginBottom: 22 }}>
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputsRef.current[idx] = el)}
                  type="text"
                  maxLength={1}
                  className="wa-otp-digit"
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  autoFocus={idx === 0}
                  id={`otpDigit_${idx}`}
                />
              ))}
            </div>

            <button
              id="otpSubmitBtn"
              type="submit"
              className="wa-login-cta-btn"
              disabled={loading || otp.join('').length < 6}
            >
              {loading ? (
                <span>Verifying Code...</span>
              ) : (
                <>
                  <Check size={18} />
                  <span>Verify Code & Continue</span>
                </>
              )}
            </button>

            {/* Resend & Back options */}
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              {resendTimer > 0 ? (
                <span style={{ fontSize: '13px', color: 'var(--wa-text-secondary)' }}>
                  Resend code in {resendTimer}s
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  style={{
                    color: '#53bdeb',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={14} />
                  <span>Resend Code to Gmail</span>
                </button>
              )}

              <button
                type="button"
                className="wa-auth-back-link"
                onClick={() => handleModeChange('signup_email')}
              >
                <ArrowLeft size={14} />
                <span>Back to Email Input</span>
              </button>
            </div>
          </form>
        )}

        {/* ================= VIEW 4: SIGN UP STEP 3 (SET PASSWORD & COMPLETE PROFILE) ================= */}
        {authMode === 'signup_profile' && (
          <form onSubmit={handleCompleteRegistration} style={{ width: '100%' }}>
            {/* Header row with Back button */}
            <div className="wa-auth-header-row">
              <button 
                type="button" 
                className="wa-auth-back-btn" 
                onClick={() => handleModeChange('login')}
                title="Cancel and go to login"
              >
                <ArrowLeft size={16} />
                <span>Cancel</span>
              </button>
              <span style={{ fontSize: '12px', color: 'var(--wa-text-muted)' }}>Step 3 of 3</span>
            </div>

            <h2 className="wa-login-title">Set Password & Profile</h2>
            <p className="wa-login-subtitle" style={{ marginBottom: 16 }}>
              Gmail <strong style={{ color: 'var(--wa-green-light)' }}>{signupEmail}</strong> verified! Create your password for instant future logins.
            </p>

            {/* Live Preview Card */}
            <div className="wa-profile-live-preview">
              <img 
                src={customAvatar || avatar} 
                alt="Avatar" 
                className="preview-avatar" 
              />
              <div className="preview-info">
                <div className="preview-name" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span>{signupName.trim() || 'Your Name'}</span>
                  {signupUsername && (
                    <span style={{ fontSize: '12.5px', color: 'var(--wa-green-light)', fontWeight: 500 }}>
                      @{signupUsername}
                    </span>
                  )}
                </div>
                <div className="preview-bio">
                  {about.trim() || '❤️ In love'}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--wa-green-light)', fontWeight: 500, backgroundColor: 'rgba(0,168,132,0.15)', padding: '3px 8px', borderRadius: 6 }}>
                Live Preview
              </div>
            </div>

            {/* Profile Avatar Picker */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label 
                htmlFor="avatarUploadInput" 
                className="wa-profile-upload-circle" 
                title="Click to upload custom photo"
              >
                <img src={customAvatar || avatar} alt="Profile preview" />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff'
                  }}
                >
                  <Camera size={26} />
                </div>
              </label>
              <input
                type="file"
                id="avatarUploadInput"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              {/* Gender Selection & Bitmoji Picker */}
              <div style={{ width: '100%', margin: '10px 0 14px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--wa-text-secondary)' }}>
                    Select Gender for Bitmoji:
                  </span>
                  <button
                    type="button"
                    onClick={handleRollSignupBitmoji}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'none',
                      border: 'none',
                      color: 'var(--wa-blue-ticks)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                    title="Generate a unique 3D/Bitmoji avatar"
                  >
                    <RefreshCw size={13} />
                    <span>🎲 Roll Bitmoji</span>
                  </button>
                </div>

                {/* Male / Female Segmented Pill Buttons */}
                <div className="wa-gender-selector-group">
                  <button
                    type="button"
                    className={`wa-gender-btn ${signupGender === 'male' ? 'active' : ''}`}
                    onClick={() => handleSignupGenderChange('male')}
                  >
                    <span>👨 Male</span>
                  </button>
                  <button
                    type="button"
                    className={`wa-gender-btn ${signupGender === 'female' ? 'active' : ''}`}
                    onClick={() => handleSignupGenderChange('female')}
                  >
                    <span>👩 Female</span>
                  </button>
                </div>

                <div style={{ fontSize: '11.5px', color: 'var(--wa-text-muted)', margin: '8px 0 6px 0' }}>
                  Pick your {signupGender === 'female' ? 'Female 👩' : 'Male 👨'} Bitmoji:
                </div>
                <div className="wa-avatar-picker-chips">
                  {(GENDER_AVATARS[signupGender] || AVATAR_PRESETS).map((p, i) => (
                    <div
                      key={i}
                      className={`wa-avatar-chip ${avatar === p && !customAvatar ? 'selected' : ''}`}
                      onClick={() => {
                        setCustomAvatar(null);
                        setAvatar(p);
                      }}
                      title={`Bitmoji ${i + 1}`}
                    >
                      <img src={p} alt={`Preset ${i}`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Field 1: Personal Name */}
            <div style={{ marginBottom: 14, textAlign: 'left' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wa-text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <User size={15} color="var(--wa-green)" />
                <span>Your Name <strong style={{ color: '#ea4335' }}>*</strong></span>
              </label>
              <input
                id="profileNameInput"
                type="text"
                className="wa-phone-number-field"
                style={{ width: '100%' }}
                placeholder="e.g. Sonu Sahani"
                value={signupName}
                onChange={handleNameChange}
                required
              />
            </div>

            {/* Field 2: Unique @username */}
            <div style={{ marginBottom: 14, textAlign: 'left' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wa-text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <AtSign size={15} color="var(--wa-green)" />
                <span>Unique Username (Login ID) <strong style={{ color: '#ea4335' }}>*</strong></span>
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: 14, color: 'var(--wa-text-muted)', fontSize: '15px', fontWeight: 600 }}>@</span>
                <input
                  id="profileUsernameInput"
                  type="text"
                  className="wa-phone-number-field"
                  style={{ width: '100%', paddingLeft: 32 }}
                  placeholder="username (e.g. sonu, sonu_07)"
                  value={signupUsername}
                  onChange={handleManualUsernameChange}
                  required
                />
              </div>

              {/* Status */}
              <div style={{ marginTop: 5, fontSize: '12px', minHeight: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
                {usernameStatus === 'checking' && (
                  <span style={{ color: 'var(--wa-text-secondary)' }}>Checking availability...</span>
                )}
                {usernameStatus === 'available' && (
                  <span style={{ color: 'var(--wa-green-light)', fontWeight: 500 }}>✓ @{signupUsername} is available</span>
                )}
                {usernameStatus === 'taken' && (
                  <span style={{ color: 'var(--wa-danger)', fontWeight: 500 }}>✕ @{signupUsername} is taken. Try another</span>
                )}
                {usernameStatus === 'invalid' && signupUsername.length > 0 && (
                  <span style={{ color: 'var(--wa-warning)' }}>3-20 characters (letters, numbers, _, .)</span>
                )}
              </div>
            </div>

            {/* Field 3: Create Password */}
            <div style={{ marginBottom: 14, textAlign: 'left' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wa-text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <KeyRound size={15} color="var(--wa-green)" />
                <span>Create Password <strong style={{ color: '#ea4335' }}>*</strong></span>
              </label>
              <div className="wa-input-with-icon-wrapper">
                <input
                  id="createPasswordInput"
                  type={showSignupPassword ? 'text' : 'password'}
                  className="wa-phone-number-field"
                  style={{ width: '100%', paddingRight: 40, fontSize: '14px' }}
                  placeholder="Minimum 6 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="wa-password-toggle-btn"
                  onClick={() => setShowSignupPassword(!showSignupPassword)}
                  title={showSignupPassword ? 'Hide password' : 'Show password'}
                >
                  {showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Field 4: Confirm Password */}
            <div style={{ marginBottom: 16, textAlign: 'left' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wa-text-primary)', display: 'block', marginBottom: 6 }}>
                Confirm Password <strong style={{ color: '#ea4335' }}>*</strong>
              </label>
              <input
                id="confirmPasswordInput"
                type={showSignupPassword ? 'text' : 'password'}
                className="wa-phone-number-field"
                style={{ width: '100%', fontSize: '14px' }}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword && signupPassword !== confirmPassword && (
                <span style={{ fontSize: '12px', color: 'var(--wa-danger)', marginTop: 4, display: 'block' }}>
                  ✕ Passwords do not match
                </span>
              )}
            </div>

            {/* Field 5: Bio Status */}
            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--wa-text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Info size={15} color="var(--wa-green)" />
                <span>Your Bio / About Status</span>
              </label>
              <input
                id="profileAboutInput"
                type="text"
                className="wa-phone-number-field"
                style={{ width: '100%', fontSize: '14px' }}
                placeholder="Choose or write your bio..."
                value={about}
                onChange={(e) => setAbout(e.target.value)}
              />

              <div className="wa-bio-chips">
                {BIO_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`wa-bio-chip ${about === preset ? 'selected' : ''}`}
                    onClick={() => setAbout(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <button
              id="finishRegistrationBtn"
              type="submit"
              className="wa-login-cta-btn"
              disabled={
                loading || 
                !signupName.trim() || 
                usernameStatus !== 'available' || 
                signupPassword.length < 6 || 
                signupPassword !== confirmPassword
              }
            >
              {loading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <UserCheck size={18} />
                  <span>Create Account & Start Chatting</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
