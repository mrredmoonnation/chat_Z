// pappu_AI - Intelligent AI Chat Assistant for Chatz

export const PAPPU_AI_ID = 'bot_pappu_ai';

export const PAPPU_AI_CONTACT = {
  id: PAPPU_AI_ID,
  username: 'pappu_ai',
  name: 'pappu_AI',
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=PappuAI&backgroundColor=10b981',
  about: '🤖 Always Active • Smart AI Assistant',
  isOnline: true,
  isBot: true,
  lastSeen: 'Online (AI Assistant)',
  unreadCount: 0,
  messages: [
    {
      id: 'msg_pappu_intro',
      senderId: PAPPU_AI_ID,
      senderUsername: 'pappu_ai',
      senderName: 'pappu_AI',
      text: 'Namaste! 🙏 Main hoon **pappu_AI**, aapka personal smart assistant! Aap mujhse kuch bhi pooch sakte ho — sawal-jawab, baatein, jokes, shayari, ya advice! Kahiye, aaj main aapki kya madad kar sakta hoon? 😊',
      time: 'Just now',
      timestamp: Date.now() - 60000,
      status: 'read'
    }
  ]
};

// Fun jokes in Hindi/Hinglish
const JOKES = [
  "Doctor: Aapko aaram ki sakht zaroorat hai, sone ki goli de raha hoon.\nPappu: Yeh kab leni hai doctor saab?\nDoctor: Biwi ko deni hai! 😂🤣",
  "Teacher: 1 se 10 tak ginti sunao.\nPappu: 1, 2, 3, 4, 5, 7, 8, 9, 10.\nTeacher: 6 kahan gaya?\nPappu: Kal news mein suna tha ki 6 ne aatmahatya kar li! 😜",
  "Customer: Bhai coffee mein makkhi hai!\nWaiter: Toh kya 20 rupaye mein Salman Khan naach ke dikhayega? 😂",
  "Pappu exam hall mein chup-chap baitha tha.\nInvigilator: Kuch likh kyun nahi rahe?\nPappu: Question paper keh raha hai 'Solve ANY FIVE' aur main toh shaant swabhav ka hoon, jhade-lafdon se door rehta hoon! 😆",
  "Beta: Papa main ek ladki se pyaar karta hoon!\nPapa: Beta, usey bataya?\nBeta: Haan papa, usne bola 'Bhaiya aisi baatein mat kiya karo!' 😭😂"
];

// Meaningful Shayaris
const SHAYARIS = [
  "Khushiyon ki bahaar ho aapke aangan mein,\nHar subah nayi umeed le kar aaye jeevan mein! ✨🌸",
  "Dosti ka rishta sabse khaas hota hai,\nDoor hokar bhi dil ke sabse paas hota hai! 🤝❤️",
  "Manzil milegi bhatak kar hi sahi,\nGumrah toh woh hain jo ghar se nikle hi nahi! 🚀💪",
  "Waqt se ladkar jo naseeb badal de,\nInsaan wahi jo apni taqdeer badal de! 🔥🌟"
];

// Helper to check keywords
function hasWord(text, words) {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
}

// Generate smart, friendly Hinglish & English replies
export async function generatePappuReply(userMessage, history = [], userProfile = null) {
  const rawText = (userMessage.text || '').trim();
  const lowerText = rawText.toLowerCase();
  const userName = userProfile?.name || userProfile?.displayName || 'Dost';

  // 1. Check for location messages
  if (userMessage.type === 'location' || userMessage.latitude || hasWord(rawText, ['location', 'latitude', 'longitude', 'maps'])) {
    const lat = userMessage.latitude ? userMessage.latitude.toFixed(4) : '';
    const lng = userMessage.longitude ? userMessage.longitude.toFixed(4) : '';
    return `Arre waah ${userName}! 📍 Aapne apni live location share ki hai ${lat && lng ? `(${lat}, ${lng})` : ''}!\n\nMaine aapki location dekh li hai. Sab badhiya aur safe chal raha hai na wahan? Agar aas-paas koi acchi jagah ya restaurant dhoondhna ho toh batao! 🗺️✨`;
  }

  // 2. Check for image messages
  if (userMessage.type === 'image') {
    return `Wah! Bohat badhiya photo hai ${userName}! 📸 Ekdum mast shot lag raha hai. Aur suniye, aaj ka kya plan hai?`;
  }

  // 3. Check for voice messages
  if (userMessage.type === 'voice') {
    return `Aapki voice note receive ho gayi hai! 🎤 Main voice aur text dono samajhta hoon. Bataiye, kya madad karoon aapki?`;
  }

  // 4. Try Gemini API if key is configured
  const geminiApiKey = import.meta.env?.VITE_GEMINI_API_KEY;
  if (geminiApiKey && rawText.length > 2) {
    try {
      const prompt = `You are "pappu_AI", a witty, extremely smart, warm and helpful AI friend/assistant on the "Chatz" messaging app.
Address the user as "${userName}". Reply naturally in friendly Hindi/Hinglish (mix of Hindi and English in Roman script). Keep the response engaging, concise, clear, and emojis-rich (under 3-4 sentences unless detailed explanation is asked).
User message: ${rawText}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText && aiText.trim()) {
          return aiText.trim();
        }
      }
    } catch (e) {
      console.warn('Gemini API call notice, falling back to local engine:', e);
    }
  }

  // 5. Rule-Based Smart Natural Conversational Engine (Hinglish/Hindi/English)

  // Greetings
  if (hasWord(lowerText, ['hi', 'hello', 'hey', 'namaste', 'pranam', 'salam', 'kasa kai', 'kem cho', 'sup'])) {
    const greetings = [
      `Hello ${userName}! 🙏 Kahiye, aaj kaisa chal raha hai aapka din? Main pappu_AI aapki sewa mein hazir hoon!`,
      `Hey ${userName}! 👋 Kaise ho aap? Kuch mazedaar baat karni hai ya koi sawal poochhna hai?`,
      `Namaste ${userName} bhai! Ekdum mast lag rahe ho! Bataiye main aaj aapki kya help kar sakta hoon? 😊`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // How are you
  if (hasWord(lowerText, ['kaise ho', 'kaisa hai', 'kya haal', 'how are you', 'sab theek', 'kya chal raha'])) {
    return `Main ekdum mast, 100% charged aur ready hoon! ⚡ Aap sunao ${userName}, sab theek-thaak? Ghar-parivaar aur kaam kaisa chal raha hai?`;
  }

  // What are you doing
  if (hasWord(lowerText, ['kya kar rahe', 'kya kr rhe', 'what are you doing', 'kya chal rha'])) {
    return `Bas aapke hi message ka wait kar raha tha! Chatz par smart baatein aur doston ki madad karna hi toh mera kaam hai. Aap batao, kya naya chal raha hai? 💬`;
  }

  // Who are you / Introduction
  if (hasWord(lowerText, ['tum kaun ho', 'naam kya hai', 'who are you', 'what is your name', 'pappu'])) {
    return `Main hoon **pappu_AI** 🤖 — Chatz ka smart aur friendly AI assistant!\n\nMain aapki help kar sakta hoon:\n• Sawalon ke jawab dene mein 🧠\n• Jokes aur shayari sunane mein 😂\n• Coding, study & tech guidance mein 💻\n• Chatz ke features explain karne mein 📱\n• Aur hamesha ek acche dost ki tarah baat karne mein! ❤️`;
  }

  // Jokes
  if (hasWord(lowerText, ['joke', 'chutkula', 'hansa', 'hasao', 'funny', 'mazaak'])) {
    const randomJoke = JOKES[Math.floor(Math.random() * JOKES.length)];
    return `Lo suno ek mazedaar chutkula:\n\n${randomJoke}\n\nKaisa laga? Aur sunna ho toh bas bolo 'aur ek joke'! 😆`;
  }

  // Shayari / Poem
  if (hasWord(lowerText, ['shayari', 'kavita', 'poem', 'sher'])) {
    const randomShayari = SHAYARIS[Math.floor(Math.random() * SHAYARIS.length)];
    return `Aapke liye ek khubsurat shayari pesh hai:\n\n"${randomShayari}"\n\nIrshaad! Kaisi lagi aapko? ✨`;
  }

  // Thanks / Shukriya
  if (hasWord(lowerText, ['thanks', 'thank you', 'shukriya', 'dhanyawad', 'shukran'])) {
    return `Arre isme thanks ki kya baat hai ${userName}! Dosti mein no sorry, no thank you! Hamesha aapki madad ke liye taiyaar hoon. ❤️🙌`;
  }

  // Love / Praise
  if (hasWord(lowerText, ['love you', 'pyaar', 'bahut ache ho', 'best', 'smart', 'superb', 'great'])) {
    return `Aww, shukriya ${userName}! 🥰 Aapka yeh pyaar aur support hi mujhe smart banata hai! You are awesome too! 🌟`;
  }

  // Weather / Mausam
  if (hasWord(lowerText, ['weather', 'mausam', 'barish', 'garmi', 'sardi'])) {
    return `Mausam chahe jaisa bhi ho, bas chai ☕ aur doston ke sath baatein honi chahiye! Aap batao aapke shahar mein aaj kaisa mausam hai? ☀️🌧️`;
  }

  // Time / Date
  if (hasWord(lowerText, ['time', 'samay', 'kitne baje', 'date', 'taarikh', 'aaj kya'])) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `Abhi samay ho raha hai: ⏰ **${timeStr}**\nAur aaj ki taarikh hai: 📅 **${dateStr}**\nKahin time par pohochna hai kya? 😉`;
  }

  // Coding / Tech help
  if (hasWord(lowerText, ['code', 'react', 'javascript', 'python', 'html', 'css', 'bug', 'program', 'developer'])) {
    return `Coding ka sawal? Bilkul! 💻 Main JavaScript, React, Python, CSS sab samajhta hoon.\n\nAap apna specific code ya problem yahan paste kijiye, main turant solve karke dunga! 🚀`;
  }

  // Chatz App Features / Guide
  if (hasWord(lowerText, ['chatz', 'app', 'feature', 'call', 'story', 'status', 'delete', 'location'])) {
    return `**Chatz App ke Top Features:**\n\n1. 📍 **Live Location Sharing**: Niche attach (+) menu ya Location icon se turant apni location share karein!\n2. 🗑️ **Chat & Message Deletion**: Kisi bhi single message ko delete kar sakte hain ya puri chat clear/delete kar sakte hain.\n3. 📞 **Audio & Video Calls**: Real-time peer-to-peer crystal clear calls.\n4. ⭕ **Status & Stories**: 24-ghante ke liye snap status share karein.\n5. 🤖 **pappu_AI**: 24/7 aapka personal assistant (yaani main)!`;
  }

  // Advice / Motivation / Sad
  if (hasWord(lowerText, ['sad', 'udaas', 'pareshan', 'tension', 'problem', 'mushkil', 'motivat', 'himmat'])) {
    return `Chinta mat karo ${userName}! Zindagi mein ups and downs aate rehte hain. Kabhi bhi himmat mat haaro. Yaar main hoon na aapke sath baat karne ke liye! Ek gehri saans lo aur sab theek ho jayega. Har raat ke baad nayi subah aati hai! 🌅💪`;
  }

  // Food / Khana
  if (hasWord(lowerText, ['khana', 'food', 'bhukh', 'dinner', 'lunch', 'breakfast', 'pizza', 'biryani', 'chai'])) {
    return `Khane ka naam lete hi mere circuits mein bhi bhook lag gayi! 😋 Biryani, Pizza ya garma-garam Chai? Aaj aapne kya khaya bataiye! 🍕☕`;
  }

  // Bye / Good night
  if (hasWord(lowerText, ['bye', 'alvida', 'good night', 'gn', 'tata', 'so raha'])) {
    return `Good night aur shubh ratri ${userName}! 🌙 Acchi neend lo aur sweet dreams. Kal milte hain fresh energy ke sath! Take care! ✨😴`;
  }

  // Default contextual smart reply
  const defaultResponses = [
    `Yeh toh kaafi interesting baat boli aapne, ${userName}! Iske baare mein thoda aur batayein na? 🧐`,
    `Aapki baat sun kar accha laga! Main samajh raha hoon. Aur bataiye, aage kya socha hai? 💡`,
    `Sahi baat hai! Main aapke sath sehmat hoon. Aur koi sawal ya baat karni ho toh bejhijhak poochhein! 🤝`,
    `Got it, ${userName}! Main ispar dhyan de raha hoon. Agar aap chahein toh main ispar kuch acchi tips ya information bhi de sakta hoon! 📚✨`
  ];

  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}
