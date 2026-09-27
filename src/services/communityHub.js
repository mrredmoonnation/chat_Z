// Tech Community & Ideas Hub Service
// Real-time public discussion room for feature ideas and support
// Admin: sonusahani96122 (Sonu Sahani)

export const COMMUNITY_HUB_ID = 'community_tech_ideas';
export const COMMUNITY_ADMIN_USERNAME = 'sonusahani96122';
export const COMMUNITY_STORAGE_KEY = 'chatz_community_messages_v1';

export const INITIAL_COMMUNITY_MESSAGE = {
  id: 'msg_community_admin_welcome',
  senderId: 'user_sonusahani96122',
  senderUsername: 'sonusahani96122',
  senderName: 'Sonu Sahani',
  isAdmin: true,
  text: '👋 Welcome to **Baat Chit Tech Community**! 🚀\n\n📌 **Zaroori Soochna (Notice)**:\nIs group mein wahi log message karein jinko koi dikkat/issue hai ya naye features ke baare mein discuss karna chahte hain aur apna new idea share karna chahte hain.\n\n🔒 **Privacy Protection**: Is group mein kisi ka bhi User ID / Phone number show nahi hoga, sirf aapka Display Name aayega taaki aap freely discuss kar sakein!\n\n👑 **Admin**: Sonu Sahani (@sonusahani96122)',
  time: 'Pinned',
  timestamp: 1710000000000,
  status: 'read'
};

export const COMMUNITY_CONTACT = {
  id: COMMUNITY_HUB_ID,
  username: 'Tech_Community',
  name: 'Tech Community & Ideas 💡',
  avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=TechIdeasCommunityBaatChit',
  about: 'Public Community • Share New Ideas, Feedback & Discuss Tech',
  isOnline: true,
  isCommunity: true,
  isGroup: true,
  lastSeen: 'Public Tech Discussion',
  unreadCount: 0,
  messages: [INITIAL_COMMUNITY_MESSAGE]
};

export function getStoredCommunityMessages() {
  try {
    const raw = localStorage.getItem(COMMUNITY_STORAGE_KEY);
    if (!raw) return [INITIAL_COMMUNITY_MESSAGE];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [INITIAL_COMMUNITY_MESSAGE];
    return parsed;
  } catch (e) {
    return [INITIAL_COMMUNITY_MESSAGE];
  }
}

export function saveStoredCommunityMessages(messages) {
  try {
    if (Array.isArray(messages)) {
      localStorage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(messages));
    }
  } catch (e) {
    console.warn('Failed to save community messages:', e);
  }
}
