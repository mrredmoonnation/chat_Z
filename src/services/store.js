// State Management, Persistence, Cross-Tab/Device Realtime Broadcast

const STORAGE_KEY = 'chatz_contacts_v1';
const USER_KEY = 'chatz_user_v1';
const SETTINGS_KEY = 'chatz_settings_v1';
const STORIES_KEY = 'chatz_stories_v1';
const USERNAMES_KEY = 'chatz_usernames_registry_v1';

// Format username: lowercase, trim, remove leading @, keep only valid characters
export const cleanUsername = (username) => {
  if (!username) return '';
  return username.replace(/^@+/, '').trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
};

// Validate username format: 3 to 20 characters, lowercase letters, numbers, underscores, periods
export const isValidUsernameFormat = (username) => {
  const clean = cleanUsername(username);
  return /^[a-z0-9_.]{3,20}$/.test(clean);
};

// Universal matcher to identify if a contact matches a given ID, Room, Username, UID, or sender object
export const matchesContact = (contact, identifierOrObj) => {
  if (!contact || !identifierOrObj) return false;

  // 1. If identifierOrObj is a plain string
  if (typeof identifierOrObj === 'string') {
    const raw = identifierOrObj.trim();
    if (!raw) return false;
    const clean = raw.toLowerCase().replace(/^wa_user_|^user_/, '');

    if (contact.id === raw || contact.roomId === raw) return true;
    if (contact.uid === raw || contact.otherUid === raw) return true;
    if (contact.username && contact.username.toLowerCase() === clean) return true;
    if (contact.phone && contact.phone === raw) return true;

    const contactClean = String(contact.id || '').toLowerCase().replace(/^wa_user_|^user_/, '');
    if (contactClean && contactClean === clean) return true;

    const contactRoomClean = String(contact.roomId || '').toLowerCase();
    if (contactRoomClean && contactRoomClean.includes(clean)) return true;

    return false;
  }

  // 2. If identifierOrObj is an object (sender payload or another contact)
  const obj = identifierOrObj;
  const targetId = obj.id || obj.roomId || obj.senderId || obj.peerId;
  const targetUsername = cleanUsername(obj.username || obj.senderUsername || '');
  const targetUid = obj.uid || obj.otherUid;

  if (targetId && (contact.id === targetId || contact.roomId === targetId)) return true;
  if (targetUid && (contact.uid === targetUid || contact.otherUid === targetUid)) return true;
  if (targetUsername && contact.username && cleanUsername(contact.username) === targetUsername) return true;

  if (targetId) {
    const cleanTarget = String(targetId).toLowerCase().replace(/^wa_user_|^user_/, '');
    const cleanContactId = String(contact.id || '').toLowerCase().replace(/^wa_user_|^user_/, '');
    if (cleanTarget && cleanContactId && cleanTarget === cleanContactId) return true;
    if (contact.username && cleanUsername(contact.username) === cleanTarget) return true;
  }

  if (obj.roomId && contact.roomId && obj.roomId === contact.roomId) return true;

  return false;
};

// Get registered usernames registry map { [cleanUsername]: userProfile }
export const getRegisteredUsernames = () => {
  try {
    const raw = localStorage.getItem(USERNAMES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

// Check if username is available (case-insensitive)
export const isUsernameAvailable = (username, currentUserId = null) => {
  const clean = cleanUsername(username);
  if (!isValidUsernameFormat(clean)) return false;
  const registry = getRegisteredUsernames();
  const existing = registry[clean];
  if (!existing) return true;
  // If the same logged-in user owns this username, it's valid for them
  if (currentUserId && existing.id === currentUserId) return true;
  return false;
};

// Register or update a username
export const registerUsername = (username, userProfile) => {
  const clean = cleanUsername(username);
  if (!clean || !userProfile) return false;
  const registry = getRegisteredUsernames();
  registry[clean] = {
    id: userProfile.id,
    username: clean,
    name: userProfile.name,
    avatar: userProfile.avatar,
    about: userProfile.about || 'Hey there! I am using Chatz',
    phone: userProfile.phone || '',
    email: userProfile.email || '',
    registeredAt: registry[clean]?.registeredAt || Date.now(),
    lastSeen: 'Online'
  };
  localStorage.setItem(USERNAMES_KEY, JSON.stringify(registry));
  broadcastChange('USERNAMES_UPDATED', registry);
  return true;
};

// Search users by username or name (Instagram style search)
export const searchUsersByUsername = (query) => {
  if (!query || !query.trim()) return [];
  const q = cleanUsername(query);
  const rawQ = query.trim().toLowerCase();
  const registry = getRegisteredUsernames();
  return Object.values(registry).filter((u) => {
    const uMatch = u.username.toLowerCase().includes(q);
    const nMatch = u.name.toLowerCase().includes(rawQ);
    return uMatch || nMatch;
  });
};

// BroadcastChannel for instant cross-tab real-time sync (Zero-cost realtime)
const channel = typeof window !== 'undefined' && window.BroadcastChannel
  ? new BroadcastChannel('chatz_web_sync_v1')
  : null;

// Curated Bitmoji & 3D Cartoon Avatar Presets categorized by Gender (Male & Female)
export const GENDER_AVATARS = {
  male: [
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix&backgroundColor=b6e3f4',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Liam&backgroundColor=c0aede',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka&backgroundColor=d1d4f9',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Alexander&backgroundColor=b6e3f4',
    'https://api.dicebear.com/7.x/notionists/svg?seed=Sonu&backgroundColor=ffdfbf',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver&backgroundColor=c0aede',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=CoolBoy&backgroundColor=b6e3f4',
    'https://api.dicebear.com/7.x/bottts/svg?seed=CyberBro&backgroundColor=d1d4f9'
  ],
  female: [
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Chloe&backgroundColor=ffd5dc',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Zoe&backgroundColor=ffdfbf',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Mia&backgroundColor=c0aede',
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Aria&backgroundColor=ffd5dc',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia&backgroundColor=d1d4f9',
    'https://api.dicebear.com/7.x/adventurer/svg?seed=Lily&backgroundColor=ffd5dc',
    'https://api.dicebear.com/7.x/fun-emoji/svg?seed=SweetGirl&backgroundColor=ffd5dc',
    'https://api.dicebear.com/7.x/lorelei/svg?seed=Princess&backgroundColor=ffdfbf'
  ]
};

// Generate custom Bitmoji avatar by seed and gender
export const generateBitmojiAvatar = (seed = '', gender = 'male') => {
  const cleanSeed = encodeURIComponent(seed || (gender === 'female' ? 'CuteGirl_' + Date.now() : 'CoolGuy_' + Date.now()));
  const style = gender === 'female' ? 'lorelei' : 'adventurer';
  const bg = gender === 'female' ? 'ffd5dc' : 'b6e3f4';
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${cleanSeed}&backgroundColor=${bg}`;
};

// Default avatars
export const AVATAR_PRESETS = [
  ...GENDER_AVATARS.male.slice(0, 4),
  ...GENDER_AVATARS.female.slice(0, 4)
];

// Clean empty default contacts & stories (Only user-added contacts will appear)
const DEFAULT_CONTACTS = [];
const DEFAULT_STORIES = [];

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const saveStoredUser = (user) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (user?.username) {
    registerUsername(user.username, user);
  }
  broadcastChange('USER_UPDATED', user);
};

export const getStoredContacts = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Clear legacy dummy data if any from previous versions
      localStorage.removeItem('wa_clone_data_v2');
      return [];
    }
    const parsed = JSON.parse(raw);
    // Purge any legacy dummy contacts (Jaan, Friends Gang, Rahul)
    const cleaned = parsed.filter(
      (c) => c.id !== 'contact_gf' && c.id !== 'group_family' && c.id !== 'contact_rahul'
    );
    return cleaned;
  } catch (e) {
    return [];
  }
};

export const saveStoredContacts = (contacts) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  } catch (err) {
    console.warn('LocalStorage quota warning in saveStoredContacts:', err);
    try {
      // Auto-prune message history per contact (keep latest 30 messages) to prevent crashing
      const pruned = contacts.map((c) => ({
        ...c,
        messages: (c.messages || []).slice(-30)
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch (e2) {
      console.warn('Failed to prune contacts in localStorage:', e2);
    }
  }
  broadcastChange('CONTACTS_UPDATED', contacts);
};

export const addStoredContact = (newContact) => {
  const current = getStoredContacts();
  const existing = current.find(
    (c) => c.id === newContact.id || (newContact.phone && c.phone === newContact.phone) || (newContact.email && c.email === newContact.email)
  );
  if (existing) return existing;
  const updated = [newContact, ...current];
  saveStoredContacts(updated);
  return newContact;
};

export const getStoredStories = () => {
  try {
    const raw = localStorage.getItem(STORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
};

export const saveStoredStories = (stories) => {
  try {
    localStorage.setItem(STORIES_KEY, JSON.stringify(stories));
  } catch (err) {
    console.warn('LocalStorage quota warning in saveStoredStories:', err);
    try {
      // Prune to most recent active stories
      const recent = stories.slice(0, 10);
      localStorage.setItem(STORIES_KEY, JSON.stringify(recent));
    } catch (e2) {
      console.warn('Failed to prune stories in localStorage:', e2);
    }
  }
  broadcastChange('STORIES_UPDATED', stories);
};

export const getSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {
      pin: '1234',
      theme: 'dark',
      disappearingTimer: 'off', // off, 24h, 7d
      soundEnabled: true
    };
  } catch (e) {
    return { pin: '1234', theme: 'dark', disappearingTimer: 'off', soundEnabled: true };
  }
};

export const saveSettings = (settings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const broadcastChange = (type, payload) => {
  if (channel) {
    try {
      channel.postMessage({ type, payload, senderTab: window.name || 'main' });
    } catch (e) {
      console.warn('Broadcast error:', e);
    }
  }
};

export const subscribeToBroadcast = (callback) => {
  if (!channel) return () => {};
  const handler = (e) => {
    callback(e.data);
  };
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
};

// Local Account Credentials & Profile Indexing
const ACCOUNTS_KEY = 'chatz_accounts_v1';

export const getStoredAccounts = () => {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

export const saveAccountCredentials = (email, password, profile) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return;
  const accounts = getStoredAccounts();
  accounts[cleanEmail] = {
    email: cleanEmail,
    password: password,
    profile: profile,
    updatedAt: Date.now()
  };
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

export const findAccountByEmail = (email) => {
  const cleanEmail = (email || '').trim().toLowerCase();
  const accounts = getStoredAccounts();
  return accounts[cleanEmail] || null;
};

export const findAccountByUsernameOrEmail = (identifier) => {
  if (!identifier) return null;
  const clean = identifier.trim().toLowerCase().replace(/^@+/, '');
  const accounts = getStoredAccounts();

  // 1. Direct email match
  if (accounts[clean]) return accounts[clean];

  // 2. Search by username in profile
  for (const acc of Object.values(accounts)) {
    if (acc.profile?.username?.toLowerCase() === clean || acc.email?.toLowerCase() === clean) {
      return acc;
    }
  }

  // 3. Search in usernames registry
  const registry = getRegisteredUsernames();
  if (registry[clean]) {
    const regUser = registry[clean];
    const regEmail = regUser.email?.toLowerCase();
    if (regEmail && accounts[regEmail]) {
      return accounts[regEmail];
    }
    return { email: regEmail || '', profile: regUser, password: '' };
  }

  return null;
};

export const verifyAccountCredentials = (identifier, password) => {
  const account = findAccountByUsernameOrEmail(identifier);
  if (!account) return { success: false, reason: 'user_not_found' };
  if (account.password && account.password !== password) {
    return { success: false, reason: 'wrong_password' };
  }
  return { success: true, profile: account.profile, email: account.email };
};
