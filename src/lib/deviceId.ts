export function getDeviceId(): string {
  const DEVICE_ID_KEY = 'chat_device_id';
  const DEVICE_ID_LENGTH = 100;
  
  // Try to get existing device ID
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    // Generate new device ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < DEVICE_ID_LENGTH; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    deviceId = result;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  
  return deviceId;
}

export function containsProfanity(text: string): boolean {
  const offensiveWords = [
    'anal', 'anus', 'arse', 'ass', 'asshole', 'ballsack', 'bastard', 'bitch', 'bloody', 
    'blowjob', 'bollock', 'bollocks', 'cock', 'cocksucker', 'crap', 'cunt', 'damn', 'dick', 
    'dyke', 'fag', 'fuck', 'fucking', 'jackass', 'jerk', 'jizz', 'motherfucker', 'piss', 
    'pissed', 'prick', 'pussy', 'shit', 'sodomy', 'son of a bitch', 'spunk', 'tits', 
    'titty', 'twat', 'wanker', 'whore', 'pissed off', 'piece of shit', 'bullshit',
    // Additional enhanced detection
    'slut', 'tranny', 'cockroach', 'fucktard', 'retard', 'gayboy', 'lesbo', 'faggot',
    'rape', 'kill', 'die', 'murder', 'suicide', 'hitler', 'nazi', 'terrorist'
  ];
  
  const lowerText = text.toLowerCase();
  
  // Check for exact matches in words
  const words = lowerText.split(/\s+/);
  for (const word of words) {
    if (offensiveWords.includes(word)) {
      return true;
    }
  }
  
  // Check if any offensive word is contained within
  for (const offensive of offensiveWords) {
    if (lowerText.includes(offensive)) {
      return true;
    }
  }
  
  // Enhanced leetspeak and variation detection
  const leetspeakPatterns = [
    /\b4ss\b|\b4ssh0l3\b|\b4ssh01e\b/gi,
    /\b6itch\b|\bb1tch\b/gi, 
    /\b5h1t\b|\b5h1tt3\b/gi,
    /\bfu[c|k]*\b|f[a|@]ck/gi,
    /\bcu[n|t]t?\b/gi,
    /\bd[a|@]m[n|]t?\b/gi,
    /p[\W_]*[i|1|l][\W_]*s[\W_]*s/gi,
    // Additional patterns
    /r[a|@]p[e|3]/gi,
    /k[i|1]ll/gi,
    /d[i|1][e|3]/gi,
    /m[u|]rd[e|3]r/gi,
    /su[i|1]c[i|1]d[e|3]/gi,
    /h[i|1]tl[e|3]r/gi,
    /n[a|@]z[i|1]/gi,
    /t[e|3]rr[o|0]r[i|1]st/gi,
  ];
  
  for (const pattern of leetspeakPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // Check for excessive caps (shouting)
  if (text.length > 5 && /[A-Z].*[A-Z].*[A-Z]/.test(text)) {
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.7) {
      return true; // Excessive capitalization
    }
  }
  
  // Check for spam-like repeated characters
  if (/(.)\1{4,}/.test(text)) {
    return true; // Repeated character spam
  }
  
  // Check for threats/violence patterns
  const violencePatterns = [
    /\bi\s+(will|gonna|want\sto)\s+(kill|murder|harm|hurt)/gi,
    /\bkill\s+yourself\b|\bgo\s+kill\s+yourself\b/gi,
    /\bi\s+will\s+find\s+you\b/gi,
  ];
  
  for (const pattern of violencePatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

export function getBanReason(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('fuck') || lowerText.includes('cunt') || lowerText.includes(' cocksucker')) {
    return "Strong profanity detected";
  }
  if (lowerText.includes('kill') || lowerText.includes('murder') || lowerText.includes('harm') || lowerText.includes('hurt')) {
    return "Violent threats detected";
  }
  if (lowerText.includes('rape') || lowerText.includes('sexual') || lowerText.includes('naked')) {
    return "Inappropriate sexual content";
  }
  if (/(.)\1{4,}/.test(text)) {
    return "Spam message (repeated characters)";
  }
  if (text.length > 5 && /[A-Z].*[A-Z].*[A-Z]/.test(text)) {
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.7) {
      return "Excessive shouting (all caps)";
    }
  }
  return "Profanity detected";
}
