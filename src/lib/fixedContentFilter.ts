import db from "@/lib/shared/kliv-database.js";

// Load dynamic banned words from database
const getBannedWords = async () => {
  try {
    // Get permanently banned words from admin settings
    const bannedSettings = await db.query("admin_settings", { 
      setting_key: "eq.banned_words" 
    });
    
    // Get custom banned words
    const customSettings = await db.query("admin_settings", { 
      setting_key: "eq.custom_banned_words" 
    });
    
    let permanentWords: string[] = [];
    let customWords: string[] = [];
    
    if (bannedSettings.length > 0) {
      try {
        permanentWords = JSON.parse(bannedSettings[0].setting_value || "[]");
      } catch {}
    }
    
    if (customSettings.length > 0) {
      try {
        customWords = JSON.parse(customSettings[0].setting_value || "[]");
      } catch {}
    }
    
    // Hardcoded extremely offensive words that should always trigger autoban
    const extremeWords = [
      'nigger', 'nigga', 'faggot', 'kike', 'cunt', 'retard', 'spic'
    ];
    
    // Combine all banned words
    return [...new Set([...extremeWords, ...permanentWords, ...customWords])];
  } catch (error) {
    console.log("Error loading banned words:", error);
    return [
      'nigger', 'nigga', 'faggot', 'kike', 'cunt', 'retard', 'spic'
    ];
  }
};

export const checkMessage = async (message: string, username: string) => {
  const bannedWords = await getBannedWords();
  const lowerMessage = message.toLowerCase().trim();
  
  // Check for exact matches with banned words
  for (const word of bannedWords) {
    if (lowerMessage.includes(word.toLowerCase())) {
      console.log(`BANNED WORD DETECTED: ${word} in message: "${message}" by ${username}`);
      return {
        shouldBan: true,
        reason: `Banned word detected: ${word}`,
        filtered: message.replace(new RegExp(word, 'gi'), '***')
      };
    }
  }
  
  // NO MORE AUTOBAN FOR SINGLE LETTERS
  // Only autoban for truly offensive content
  
  // Check for severe harassment patterns (multiple violations)
  const harassmentPatterns = [
    /kill\s+yourself/i,
    /go\s+die/i,
    /kill\s+yourself/i,
    /\b rape \b/i,
    /sexual\s+assault/i
  ];
  
  for (const pattern of harassmentPatterns) {
    if (pattern.test(lowerMessage)) {
      console.log(`HARASSMENT DETECTED in message: "${message}" by ${username}`);
      return {
        shouldBan: true,
        reason: "Harassment or threatening content",
        filtered: message.replace(pattern, '***')
      };
    }
  }
  
  // Filter mild profanity without autoban
  const mildProfanity = /\b(fuck|shit|damn|hell|ass|bitch|bastard)\b/gi;
  const hasProfanity = mildProfanity.test(lowerMessage);
  
  if (hasProfanity) {
    console.log(`PROFANITY DETECTED (no ban): "${message}" by ${username}`);
    return {
      shouldBan: false,
      reason: "Mild profanity (not banned)",
      filtered: message.replace(mildProfanity, '***')
    };
  }
  
  return {
    shouldBan: false,
    reason: null,
    filtered: message
  };
};

export const checkUsername = async (username: string) => {
  const bannedWords = await getBannedWords();
  const lowerUsername = username.toLowerCase().trim();
  
  // Only ban usernames that contain actual offensive words
  for (const word of bannedWords) {
    if (lowerUsername.includes(word.toLowerCase())) {
      return {
        shouldBan: true,
        reason: `Username contains banned word: ${word}`
      };
    }
  }
  
  // Don't ban single letters anymore
  if (lowerUsername.length === 1) {
    return { shouldBan: false, reason: null };
  }
  
  return { shouldBan: false, reason: null };
};