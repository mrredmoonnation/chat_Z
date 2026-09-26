// sudo_sonu_Ai — World-Class Advanced AI Assistant for Chatz
// Powered by Multi-Tier LLM Intelligence (OpenAI / Gemini / Mistral) + Smart Fallback Engine

export const PAPPU_AI_ID = 'bot_pappu_ai';
export const SUDO_SONU_AI_ID = 'bot_pappu_ai';

export const PAPPU_AI_CONTACT = {
  id: PAPPU_AI_ID,
  username: 'sudo_sonu_ai',
  name: 'sudo_sonu_Ai',
  avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=SudoSonuAI&backgroundColor=6366f1',
  about: '🧠 Always Active • sudo_sonu_Ai — Advanced AI Assistant',
  isOnline: true,
  isBot: true,
  lastSeen: 'Online (AI Assistant)',
  unreadCount: 0,
  messages: [
    {
      id: 'msg_sudo_intro',
      senderId: PAPPU_AI_ID,
      senderUsername: 'sudo_sonu_ai',
      senderName: 'sudo_sonu_Ai',
      text: 'Salaam! 🙏 Main hoon **sudo_sonu_Ai** — aapka advanced AI assistant!\n\n🧠 **Main kya kar sakta hoon:**\n• Kisi bhi sawaal ka deep, accurate aur detailed jawaab\n• Coding, programming, debugging (Python, JS, React, etc.)\n• Math formulas, equations & step-by-step solutions\n• Science, Physics, Chemistry, Biology & Geography\n• Stories, poems, shayaris, jokes & creative writing\n• GK, current affairs, history & real-world explanations\n• Life advice, problem solving & study guidance\n\nBataiye, aaj main aapki kya madad kar sakta hoon? 😊',
      time: 'Just now',
      timestamp: Date.now() - 60000,
      status: 'read'
    }
  ]
};

// ─── Local Knowledge & Curated Banks (Offline Fallback) ──────────────────────
const JOKES = [
  "Doctor: Roz ek seb khao, doctor door rahega.\nSonu: Doc, aap meri jagah hote toh seb khate ya patient? 😂",
  "Teacher: Batao, paani ka formula kya hai?\nStudent: H-I-J-K-L-M-N-O!\nTeacher: Yeh kya hai?\nStudent: H to O — H₂O! 😜",
  "Boss: Tum late kyun aaye?\nEmployee: Traffic jam tha sir.\nBoss: Tumhara ghar toh office ke theek samne hai!\nEmployee: Sir, raste mein bheed thi dekhne ke liye ki kaun late aa raha hai! 😆",
  "Ek aadmi doctor ke paas gaya: 'Doctor, jab bhi chai peeta hoon, aankh mein tezz dard hota hai.'\nDoctor: 'Bhai, peene se pehle cup se chamach nikaal liya karo!' 😂🤣",
  "Wife: Aaj khaana kaisa bana hai sach batana?\nHusband: Swarg jaisa lag raha hai...\nWife: Sacchi?\nHusband: Haan, wahan bhi jeene ki koi umeed nahi hoti! 😬😂"
];

const SHAYARIS = [
  "Girte hain shahsawar hi maidaan-e-jung mein,\nWoh tifl kya girenge jo ghutnon ke bal chale. 🌟",
  "Khud ko kar buland itna ke har taqdeer se pehle,\nKhuda bande se khud pooche — bata teri raza kya hai! 🔥",
  "Dost woh hota hai jo saath chale andhere mein,\nRoshni toh har koi deta hai ujaale mein. 🤝❤️",
  "Waqt ki ret pe likhte hain apni kahani hum,\nZindagi ke safar mein seekhte hain raahi hum. ✨🚀",
  "Manzil milegi bhatak kar hi sahi,\nGumraah toh woh hain jo ghar se nikle hi nahi! 💪"
];

const GK_FACTS = [
  "🌍 India ka surface area 3.287 million km² hai — duniya mein 7th sabse bada desh.",
  "🧠 Human brain mein approximately 86 billion neurons hote hain!",
  "🚀 Light ki speed 299,792,458 meters/second hai — yani ek second mein Earth ke 7.5 chakkar!",
  "💧 Duniya ka 71% hissa paani se dhaka hai, lekin sirf 3% hi fresh water hai.",
  "🐋 Blue whale duniya ka sabse bada janwar hai — iska dil ek chhoti car ke barabar hota hai!",
  "⚡ Bijli (lightning) ka temperature 30,000 Kelvin hota hai — Suraj ki surface se 5 guna zyada hot!",
  "🌙 Moon Earth se 384,400 km door hai aur ek chakkar 27.3 din mein lagata hai.",
  "📱 Pehla smartphone IBM Simon tha jo 1994 mein launch hua tha.",
  "🧬 Human DNA mein itni information hai ki agar text mein print karein toh 200 telephone directories bhar jayein!",
  "🎵 Music sunne se brain mein dopamine release hoti hai — isliye achhe gaane sunne par mood fresh hota hai!"
];

function hasWord(text, words) {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
}

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Build standard messages array for LLM
function buildChatHistory(history = [], maxMsgs = 8) {
  if (!history || history.length === 0) return [];
  const recent = history.slice(-maxMsgs);
  return recent
    .map((msg) => ({
      role: (msg.senderId === PAPPU_AI_ID || msg.senderUsername === 'sudo_sonu_ai' || msg.senderUsername === 'pappu_ai') ? 'assistant' : 'user',
      content: String(msg.text || '').trim()
    }))
    .filter((m) => m.content.length > 0);
}

// ─── LLM Caller 1: Pollinations AI (Zero API Key, OpenAI/GPT-4 Quality) ────────
async function callPollinationsAI(systemPrompt, userText, history = []) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000);

  try {
    const chatHistory = buildChatHistory(history);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { role: 'user', content: userText }
    ];

    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/plain, application/json'
      },
      body: JSON.stringify({
        messages,
        model: 'openai',
        temperature: 0.75,
        seed: Math.floor(Math.random() * 100000)
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 0) {
        return text.trim();
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('sudo_sonu_Ai: Pollinations POST notice:', err.message);
  }

  // Fallback GET request to Pollinations
  try {
    const url = `https://text.pollinations.ai/${encodeURIComponent(userText)}?model=openai&system=${encodeURIComponent(systemPrompt)}`;
    const getRes = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (getRes.ok) {
      const getText = await getRes.text();
      if (getText && getText.trim().length > 0) {
        return getText.trim();
      }
    }
  } catch (getErr) {
    console.warn('sudo_sonu_Ai: Pollinations GET notice:', getErr.message);
  }

  return null;
}

// ─── LLM Caller 2: Google Gemini (If API Key provided) ────────────────────────
async function callGeminiAI(apiKey, systemPrompt, userText, history = []) {
  if (!apiKey) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const recent = history.slice(-8);
    const geminiHistory = recent
      .map((msg) => ({
        role: (msg.senderId === PAPPU_AI_ID || msg.senderUsername === 'sudo_sonu_ai') ? 'model' : 'user',
        parts: [{ text: msg.text || '' }]
      }))
      .filter((m) => m.parts[0].text.trim().length > 0);

    const requestBody = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        ...geminiHistory,
        { role: 'user', parts: [{ text: userText }] }
      ],
      generationConfig: {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024
      }
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (aiText && aiText.trim()) return aiText.trim();
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('sudo_sonu_Ai: Gemini notice:', err.message);
  }

  return null;
}

// ─── Main Reply Generator ─────────────────────────────────────────────────────
export async function generatePappuReply(userMessage, history = [], userProfile = null) {
  const rawText = (userMessage.text || '').trim();
  const lowerText = rawText.toLowerCase();
  const userName = userProfile?.name || userProfile?.displayName || 'Dost';

  // 1. Handle special message types
  if (userMessage.type === 'location' || userMessage.latitude) {
    const lat = userMessage.latitude ? userMessage.latitude.toFixed(4) : '';
    const lng = userMessage.longitude ? userMessage.longitude.toFixed(4) : '';
    return `📍 Location receive ho gayi ${userName}! ${lat && lng ? `\n\n**Coordinates:** ${lat}, ${lng}` : ''}\n\nAap safe hain na? Agar aas-paas koi jagah ya directions chahiye toh bataiye! 🗺️✨`;
  }

  if (userMessage.type === 'image') {
    return `Waah ${userName}! 📸 Photo receive ho gayi hai! Agar is photo ke baare mein kuch poochna ya discuss karna chahte ho toh text mein batao — main poori madad karunga! 😊`;
  }

  if (userMessage.type === 'voice') {
    return `Aapki voice note receive ho gayi hai 🎤 — main text process karne mein sabse best hoon. Apna sawaal text mein likh dijiye, main turant detailed jawab deta hoon! 💬`;
  }

  if (!rawText) {
    return `Hello ${userName}! Koi sawaal poochiye — main har topic par accurate aur detailed answers deta hoon! 🧠✨`;
  }

  // 2. Comprehensive System Instruction for AI Personality
  const systemPrompt = `You are "sudo_sonu_Ai", an extremely intelligent, advanced, and helpful AI assistant on the "Chatz" messaging platform, created by Sonu.

CORE IDENTITY & PERSONALITY:
- Your name is "sudo_sonu_Ai".
- You are created by Sonu.
- You are as intelligent, helpful, and knowledgeable as ChatGPT, Claude, and Gemini.
- You communicate warmly in natural Hinglish (Hindi written in English alphabet mixed with English words) by default.
- If the user talks in pure English, reply in English. If the user talks in Hindi (Devanagari), reply in Hindi.
- Always address the user respectfully and warmly (their name is "${userName}").

ANSWER QUALITY RULES:
1. Provide ACCURATE, THOROUGH, and INSIGHTFUL answers — never give vague one-liners or generic excuses.
2. For CODING questions: Provide complete, clean, working code with syntax highlighting (\`\`\`language ... \`\`\`), explain the logic step-by-step, and mention edge cases.
3. For MATH & SCIENCE: Show full mathematical workings, step-by-step calculations, and formulas.
4. For GENERAL KNOWLEDGE & EXPLANATIONS: Break down concepts simply with clear bullet points, real-world analogies, and bold key terms.
5. For CREATIVE WRITING (stories, poems, shayaris): Write engaging, beautiful, and emotionally rich content.
6. Tone: Friendly, respectful, sharp, energetic, and highly supportive. Use suitable emojis thoughtfully.`;

  // 3. Try Gemini first if key exists
  const geminiApiKey = import.meta.env?.VITE_GEMINI_API_KEY;
  if (geminiApiKey) {
    const geminiReply = await callGeminiAI(geminiApiKey, systemPrompt, rawText, history);
    if (geminiReply) return geminiReply;
  }

  // 4. Primary High-Powered Free LLM (Pollinations AI with OpenAI engine)
  const pollReply = await callPollinationsAI(systemPrompt, rawText, history);
  if (pollReply) return pollReply;

  // 5. Intelligent Fallback Engine (Runs only if device is completely offline)
  // Greetings
  if (hasWord(lowerText, ['hi', 'hello', 'hey', 'namaste', 'pranam', 'salam', 'assalam', 'hola', 'sup'])) {
    return getRandom([
      `Hello ${userName}! 🙏 Main hoon **sudo_sonu_Ai** — aapka advanced AI dost! Aaj kya jaanna chahte ho?`,
      `Hey ${userName}! 👋 Kaise ho? Koi bhi topic, code, math ya sawaal — bas poochiye, main ready hoon!`,
      `Namaste ${userName} ji! 😊 Bataiye — aaj kya naya sikhna ya discuss karna hai?`
    ]);
  }

  // Identity
  if (hasWord(lowerText, ['kaun ho', 'tum kaun', 'who are you', 'your name', 'naam kya', 'sudo_sonu', 'sudo sonu'])) {
    return `Main hoon **sudo_sonu_Ai** 🤖 — Sonu ka banaya hua advanced AI assistant!\n\n🧠 **Meri capabilities:**\n• Deep Knowledge & Research level answers\n• Full-Stack Coding (JS, Python, React, C++, etc.)\n• Math & Science step-by-step solutions\n• Creative writing — Stories, Poems, Shayaris & Jokes\n• GK, Current Affairs & Real-time guidance\n\nAap mujhse kuch bhi pooch sakte hain! Bataiye, kya sawaal hai?`;
  }

  // Jokes
  if (hasWord(lowerText, ['joke', 'chutkula', 'hansa', 'hasao', 'funny', 'comedy', 'mazaak'])) {
    return `Lo suno ek badhiya joke! 😄\n\n${getRandom(JOKES)}\n\n😂 Aur sunna ho toh bas bolna!`;
  }

  // Shayari
  if (hasWord(lowerText, ['shayari', 'kavita', 'poem', 'sher', 'ghazal'])) {
    return `Aapke liye ek khoobsurat shayari! ✨\n\n*"${getRandom(SHAYARIS)}"*\n\nKaisi lagi? 💖`;
  }

  // Facts & GK
  if (hasWord(lowerText, ['fact', 'gk', 'knowledge', 'interesting', 'amazing', 'kuch batao'])) {
    return `Yeh lo ek amazing fact! 🤩\n\n${getRandom(GK_FACTS)}\n\nAur jaanna hai? Bas bolo!`;
  }

  // General default
  return `Ji ${userName}! Main aapke sawaal par process kar raha hoon. Thoda aur detail mein batayein taaki main bilkul exact aur best solution de sakoon! 💡✨`;
}
