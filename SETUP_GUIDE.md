# 🚀 Chatz Authentication & Setup Guide

## 💻 1. App Kaise Start Karein (Localhost)
Terminal mein dev server background mein chal raha hai:
👉 **`http://localhost:5173/`**

Agar dobara chalana ho:
```bash
npm run dev
```

---

## 🔐 2. Authentication System (Gmail & Phone OTP)

Chatz mein 2 primary login methods hain:
1. **📱 Phone Number Login** (Firebase Real SMS OTP & Fast Demo Mode)
2. **✉️ Gmail Login** (1-Click Google OAuth & Email Code)

---

### A. 📱 Phone Number Login

Aapko screen par do options milenge:

1. **🔥 Real Firebase SMS OTP:**
   - Real mobile number par actual SMS code bhejta hai.
   - Invisible Google reCAPTCHA automatically verify karta hai.
   - Firebase SDK (`signInWithPhoneNumber`) se SMS deliver hota hai.
   - 6-digit SMS OTP daal kar **"Verify Code"** dabayein.

2. **⚡ Fast Demo OTP Mode:**
   - Agar aapko test karte waqt SMS quota use nahi karna ya phone balance nahi hai.
   - Koi bhi number daal kar **Next** karein.
   - **"Auto-fill demo code (734921)"** par click karein aur instant login karein!

> 💡 **Tip:** Agar real SMS aane mein time lage ya network issue ho, screen par **"Didn't receive SMS? Switch to Fast Demo Mode"** ka one-click button diya gaya hai.

---

### B. ✉️ Gmail Login

**Gmail** tab select karne par aapko 2 tareeqe milte hain:

1. **Continue with Google (1-Click Google Sign-In):**
   - Official Google popup khulta hai.
   - Aapka Gmail account select hote hi:
     - Aapka Google Name auto-fill ho jata hai.
     - Google Profile Picture auto-set ho jati hai.
     - Unique `@username` automatically suggest ho jata hai.
   - Seedha profile setup screen par pahunch kar **"Get Started & Chat"** dabayein!

2. **Quick Demo Google Account:**
   - Bina popup open kiye instant 1-click test Google profile (`Sonu Kumar` / `sonu@gmail.com`).

3. **Verify with Email Code:**
   - Apna Gmail address daalein (e.g. `sonu@gmail.com`) ➔ **Send Verification Code** dabayein ➔ 6-digit code enter karein.

---

## ⚙️ 3. Firebase Console Configuration (For Live Real SMS & Google Popup)

`.env` file mein Firebase keys already configured hain:
- Project ID: `chatz-e3af3`

Real Google Sign-In aur Phone SMS live chalane ke liye Firebase Console mein bas yeh 2 cheezein check karein:

1. **Firebase Console par jayein:** [console.firebase.google.com](https://console.firebase.google.com/)
2. Project **`chatz-e3af3`** open karein.
3. Left menu se **Authentication** ➔ **Sign-in method** par click karein:
   - **Phone**: Status **Enabled** hona chahiye.
   - **Google**: Status **Enabled** hona chahiye (apna support email select karke save karein).
4. **Settings tab** ➔ **Authorized domains**:
   - Make sure **`localhost`** list mein ho (usually default rehta hai).
   - Jab Vercel par live karein, to Vercel ka domain (e.g. `chatz-xyz.vercel.app`) bhi yahan add kar dein.

---

## 📁 Key Files Reference:
- [src/components/Auth/PhoneLogin.jsx](file:///c:/Users/sonus/Downloads/antigravity/src/components/Auth/PhoneLogin.jsx) - Phone & Gmail Auth UI + Step 1/2/3 flow
- [src/services/firebase.js](file:///c:/Users/sonus/Downloads/antigravity/src/services/firebase.js) - Firebase SDK (Phone SMS, Google Popup, reCAPTCHA, Error Formatter)
- [src/index.css](file:///c:/Users/sonus/Downloads/antigravity/src/index.css) - Auth pills, badges, Google button styles
- [.env](file:///c:/Users/sonus/Downloads/antigravity/.env) - Firebase Project API keys
