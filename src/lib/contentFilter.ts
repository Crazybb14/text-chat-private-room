// Content Safety Filter - Detects and blocks personal information

export interface FilterResult {
  blocked: boolean;
  reasons: string[];
  threatScore: number;
  filteredContent: string;
  hasProfanity: boolean;
}

export interface FilterSettings {
  block_phone_numbers: boolean;
  block_emails: boolean;
  block_addresses: boolean;
  block_social_security: boolean;
  block_credit_cards: boolean;
  block_ip_addresses: boolean;
  block_personal_info: boolean;
  profanity_filter: boolean;
}

// Phone number patterns (US, international formats)
const PHONE_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,  // 123-456-7890
  /\b\(\d{3}\)\s*\d{3}[-.\s]?\d{4}\b/g,   // (123) 456-7890
  /\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,  // +1 234 567 8900
  /\b\d{10,11}\b/g,  // 1234567890
];

// Email pattern
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Address patterns
const ADDRESS_PATTERNS = [
  /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl)\b/gi,
  /\b\d{5}(-\d{4})?\b/g,  // ZIP codes
];

// SSN pattern
const SSN_PATTERN = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;

// Credit card patterns
const CREDIT_CARD_PATTERNS = [
  /\b4\d{3}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,  // Visa
  /\b5[1-5]\d{2}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,  // Mastercard
  /\b3[47]\d{2}[-.\s]?\d{6}[-.\s]?\d{5}\b/g,  // Amex
  /\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b/g,  // Generic 16 digit
];

// IP address pattern
const IP_PATTERN = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

// EXPANDED Profanity list with variations
const PROFANITY_LIST = [
  // Extreme (instant ban)
  'fuck', 'fck', 'fuk', 'fuq', 'f u c k', 'f.u.c.k', 'fvck', 'phuck',
  'shit', 'sh1t', 'sht', 's h i t', 'sh!t', '$hit',
  'bitch', 'b1tch', 'biatch', 'b!tch',
  'dick', 'd1ck', 'dik', 'd!ck',
  'cock', 'c0ck',
  'pussy', 'puss', 'pu$$y',
  'ass', 'a$$', '@ss', 'azz',
  'bastard', 'b4stard',
  'slut', 'sl0t', 's1ut',
  'whore', 'wh0re', 'h0e', 'hoe',
  'cunt', 'c0nt', 'cvnt',
  'fag', 'f4g', 'faggot', 'f4ggot',
  'nigger', 'n1gger', 'nigg4', 'n!gga', 'nigga', 'n1gga',
  'retard', 'r3tard', 'retrd',
  'kys', 'kill yourself',
  // Medium
  'damn', 'crap', 'hell', 'piss', 
  'stfu', 'gtfo', 'wtf', 'omfg',
  // Hate speech
  'nazi', 'hitler', 'kkk',
];

// Spam patterns
const SPAM_PATTERNS = [
  /(.)\1{5,}/g,  // Repeated characters
  /(https?:\/\/[^\s]+\s*){3,}/g,  // Multiple links
  /(?:free|win|winner|congratulations|click here|subscribe|buy now)/gi,
];

export function filterContent(content: string, settings: Partial<FilterSettings>): FilterResult {
  const reasons: string[] = [];
  let threatScore = 0;
  let filteredContent = content;
  let hasProfanity = false;
  
  // Check phone numbers
  if (settings.block_phone_numbers !== false) {
    for (const pattern of PHONE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        reasons.push(`Phone number detected: ${matches.length} found`);
        threatScore += 30 * matches.length;
        filteredContent = filteredContent.replace(pattern, '[PHONE BLOCKED]');
      }
    }
  }
  
  // Check emails
  if (settings.block_emails !== false) {
    const emailMatches = content.match(EMAIL_PATTERN);
    if (emailMatches && emailMatches.length > 0) {
      reasons.push(`Email address detected: ${emailMatches.length} found`);
      threatScore += 25 * emailMatches.length;
      filteredContent = filteredContent.replace(EMAIL_PATTERN, '[EMAIL BLOCKED]');
    }
  }
  
  // Check addresses
  if (settings.block_addresses !== false) {
    for (const pattern of ADDRESS_PATTERNS) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        reasons.push(`Address/ZIP detected`);
        threatScore += 20;
        filteredContent = filteredContent.replace(pattern, '[ADDRESS BLOCKED]');
      }
    }
  }
  
  // Check SSN
  if (settings.block_social_security !== false) {
    const ssnMatches = content.match(SSN_PATTERN);
    if (ssnMatches && ssnMatches.length > 0) {
      reasons.push(`⚠️ SSN detected - CRITICAL`);
      threatScore += 100;
      filteredContent = filteredContent.replace(SSN_PATTERN, '[SSN BLOCKED]');
    }
  }
  
  // Check credit cards
  if (settings.block_credit_cards !== false) {
    for (const pattern of CREDIT_CARD_PATTERNS) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        // Validate with Luhn algorithm for more accuracy
        for (const match of matches) {
          const digits = match.replace(/\D/g, '');
          if (digits.length >= 13 && digits.length <= 19) {
            reasons.push(`⚠️ Credit card detected - CRITICAL`);
            threatScore += 100;
            filteredContent = filteredContent.replace(match, '[CARD BLOCKED]');
          }
        }
      }
    }
  }
  
  // Check IP addresses
  if (settings.block_ip_addresses !== false) {
    const ipMatches = content.match(IP_PATTERN);
    if (ipMatches && ipMatches.length > 0) {
      reasons.push(`IP address detected: ${ipMatches.length} found`);
      threatScore += 15 * ipMatches.length;
      filteredContent = filteredContent.replace(IP_PATTERN, '[IP BLOCKED]');
    }
  }
  
  // Check profanity - STRICT MODE (any profanity = ban)
  if (settings.profanity_filter !== false) {
    const lowerContent = content.toLowerCase().replace(/[^a-z0-9\s]/g, ''); // Remove special chars for matching
    const originalLower = content.toLowerCase();
    
    for (const word of PROFANITY_LIST) {
      // Check normal match
      const regex = new RegExp(`\\b${word.replace(/\s+/g, '\\s*')}\\b`, 'gi');
      // Also check for spaced out letters: f u c k
      const spacedRegex = new RegExp(word.split('').join('\\s*'), 'gi');
      
      if (regex.test(originalLower) || spacedRegex.test(lowerContent)) {
        reasons.push(`🚫 BANNED WORD: "${word}"`);
        threatScore += 100; // High score = instant block
        hasProfanity = true;
        filteredContent = filteredContent.replace(regex, '***BLOCKED***');
        filteredContent = filteredContent.replace(spacedRegex, '***BLOCKED***');
      }
    }
  }
  
  // Check spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      reasons.push(`Spam pattern detected`);
      threatScore += 20;
    }
  }
  
  return {
    blocked: threatScore >= 50 || reasons.some(r => r.includes('CRITICAL')) || hasProfanity,
    reasons,
    threatScore,
    filteredContent,
    hasProfanity
  };
}

export function isMediaFile(fileType: string): boolean {
  return fileType.startsWith('image/') || fileType.startsWith('video/');
}

export function getFileTypeLabel(fileType: string): string {
  if (fileType.startsWith('image/')) return 'Image';
  if (fileType.startsWith('video/')) return 'Video';
  if (fileType.includes('pdf')) return 'PDF';
  if (fileType.includes('document') || fileType.includes('word')) return 'Document';
  return 'File';
}
