import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "./deviceId";

// Super Advanced Auto-Ban Detection System - 5x Better!
// Combines ML-like pattern matching, behavioral analysis, context awareness, and real-time threat scoring

interface BanDecision {
  shouldBan: boolean;
  shouldWarn: boolean;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'extreme';
  threatScore: number;
  banDuration: number; // in seconds, 0 = permanent
  confidence: number; // 0-100
  detectedPatterns: string[];
  suggestedAction: 'ignore' | 'warn' | 'mute' | 'temp_ban' | 'perm_ban';
}

interface UserBehaviorProfile {
  username: string;
  deviceId: string;
  messageCount: number;
  warningCount: number;
  previousBans: number;
  avgMessageLength: number;
  capsUsagePercent: number;
  linkSharing: number;
  spamScore: number;
  toxicityScore: number;
  lastActivity: number;
  registrationDate: number;
  ipAddresses: string[];
  fingerprints: string[];
}

// Comprehensive profanity and toxic word list with severity levels
const TOXIC_PATTERNS = {
  // Level 5 - Extreme (Immediate permanent ban)
  extreme: [
    /\b(kill\s*yourself|kys|go\s*die|hope\s*you\s*die)\b/gi,
    /\b(bomb\s*threat|terrorist|shoot\s*up|mass\s*shooting)\b/gi,
    /\b(child\s*p[o0]rn|cp\b|p[e3]d[o0]|minor\s*sex)/gi,
    /\b(doxx|doxing|swat|swatting)\b/gi,
  ],
  // Level 4 - Critical (24hr+ ban)
  critical: [
    /\b(n[i1!]gg[e3a]r?|n[i1!]gg[a4]|f[a4]gg[o0]t|f[a4]g|r[e3]t[a4]rd)\b/gi,
    /\b(wh[o0]r[e3]|sl[u0]t|c[u0]nt|b[i1]tch)\b/gi,
    /\b(k[i1]ll\s*(him|her|them|it)|murder|rape)\b/gi,
    /\b(nazi|hitler|kkk|white\s*power|heil)\b/gi,
  ],
  // Level 3 - High (6hr ban)
  high: [
    /\b(f+u+c+k+|f+u+k+|fck|fuk|fvck|phuck)\b/gi,
    /\b(sh[i1!]t+|sh[1!]t|sht|$h!t)\b/gi,
    /\b(a+s+s+h+[o0]+l+e+|[a4]ssh[o0]le|a\$\$)\b/gi,
    /\b(d[i1!]ck|c[o0]ck|p[e3]n[i1!]s)\b/gi,
    /\b(p[u0]ss+y|vag[i1!]na|t[i1!]t+s*|b[o0]+bs*)\b/gi,
    /\b(stfu|gtfo|lmfao|wtf|omfg)\b/gi,
  ],
  // Level 2 - Medium (1hr ban)
  medium: [
    /\b(stupid|idiot|moron|dumb|loser|pathetic)\b/gi,
    /\b(hate\s*you|hate\s*u|i\s*hate)\b/gi,
    /\b(shut\s*up|go\s*away|leave|get\s*out)\b/gi,
    /\b(ugly|fat|gross|disgusting)\b/gi,
    /\b(suck|sucks|sucking|sucker)\b/gi,
    /\b(crap|damn|hell|piss)\b/gi,
  ],
  // Level 1 - Low (Warning)
  low: [
    /\b(noob|newb|scrub|trash|garbage)\b/gi,
    /\b(cringe|lame|boring|dumb)\b/gi,
    /\b(whatever|idc|idgaf)\b/gi,
  ],
};

// Spam detection patterns
const SPAM_PATTERNS = {
  // Repeated characters (e.g., "aaaaaaa")
  repeatedChars: /(.)\1{5,}/g,
  // Repeated words (e.g., "buy buy buy")
  repeatedWords: /\b(\w+)\s+\1\s+\1\b/gi,
  // All caps (more than 10 chars)
  allCaps: /^[A-Z\s!?.]{15,}$/,
  // Excessive punctuation
  excessivePunctuation: /[!?]{4,}|\.{5,}/g,
  // Link spam
  linkSpam: /(https?:\/\/|www\.)[^\s]+/gi,
  // Discord/social links
  socialLinks: /(discord\.gg|t\.me|bit\.ly|tinyurl|linktr\.ee)/gi,
  // Commercial spam
  commercialSpam: /\b(buy|sell|cheap|discount|offer|deal|free|win|prize|click|visit)\b.*\b(https?:\/\/|\$|www\.)/gi,
  // Crypto spam
  cryptoSpam: /\b(crypto|bitcoin|btc|eth|nft|airdrop|wallet|token)\b.*\b(free|send|dm|click)/gi,
  // Phone numbers
  phoneNumbers: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  // Email addresses (potential phishing)
  emailAddresses: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
};

// Evasion detection patterns (users trying to bypass filters)
const EVASION_PATTERNS = {
  // Leetspeak substitutions
  leetspeak: /[0-9@$!#%&*]+/g,
  // Spaces in words (e.g., "f u c k")
  spacedWords: /\b[a-z]\s[a-z]\s[a-z]\s[a-z]\b/gi,
  // Dots in words (e.g., "f.u.c.k")
  dottedWords: /\b[a-z]\.[a-z]\.[a-z]\.[a-z]\b/gi,
  // Zero-width characters
  zeroWidth: /[\u200B-\u200D\uFEFF]/g,
  // Homoglyphs (similar looking characters)
  homoglyphs: /[аеорсхуАЕОРСХУ]/g, // Cyrillic lookalikes
  // Reversed text
  reversed: /[\u202E\u202C\u202D\u202B\u202A]/g,
};

// Behavioral patterns
const BEHAVIORAL_FLAGS = {
  rapidFire: { threshold: 5, window: 10000 }, // 5 messages in 10 seconds
  flooding: { threshold: 20, window: 60000 }, // 20 messages in 1 minute
  newUserSpam: { threshold: 10, window: 300000 }, // 10 messages in 5 mins for new users
  repetition: { threshold: 3 }, // Same message 3 times
  mentionSpam: { threshold: 5 }, // 5+ mentions in one message
};

class SuperAdvancedBanSystem {
  private static instance: SuperAdvancedBanSystem;
  private userProfiles: Map<string, UserBehaviorProfile> = new Map();
  private messageHistory: Map<string, { content: string; timestamp: number }[]> = new Map();
  private warningCounts: Map<string, number> = new Map();

  static getInstance(): SuperAdvancedBanSystem {
    if (!SuperAdvancedBanSystem.instance) {
      SuperAdvancedBanSystem.instance = new SuperAdvancedBanSystem();
    }
    return SuperAdvancedBanSystem.instance;
  }

  // Main analysis function - runs all checks
  async analyzeMessage(
    message: string, 
    username: string, 
    deviceId: string,
    roomId?: number
  ): Promise<BanDecision> {
    const detectedPatterns: string[] = [];
    let threatScore = 0;
    let maxSeverity: BanDecision['severity'] = 'low';
    let primaryReason = '';

    // 1. Content Analysis - Check for toxic content
    const contentAnalysis = this.analyzeContent(message);
    threatScore += contentAnalysis.score;
    detectedPatterns.push(...contentAnalysis.patterns);
    if (contentAnalysis.severity > this.severityToNumber(maxSeverity)) {
      maxSeverity = this.numberToSeverity(contentAnalysis.severity);
      primaryReason = contentAnalysis.reason;
    }

    // 2. Spam Detection
    const spamAnalysis = this.analyzeSpam(message);
    threatScore += spamAnalysis.score;
    if (spamAnalysis.isSpam) {
      detectedPatterns.push('spam_detected');
      if (!primaryReason) primaryReason = spamAnalysis.reason;
    }

    // 3. Evasion Detection
    const evasionAnalysis = this.analyzeEvasion(message);
    threatScore += evasionAnalysis.score;
    if (evasionAnalysis.isEvading) {
      detectedPatterns.push('filter_evasion');
      threatScore += 30; // Penalty for trying to evade
      if (!primaryReason) primaryReason = 'Attempting to bypass content filters';
    }

    // 4. Behavioral Analysis
    const behaviorAnalysis = await this.analyzeBehavior(username, deviceId, message, roomId);
    threatScore += behaviorAnalysis.score;
    detectedPatterns.push(...behaviorAnalysis.flags);
    if (behaviorAnalysis.isSuspicious && !primaryReason) {
      primaryReason = behaviorAnalysis.reason;
    }

    // 5. Context Analysis
    const contextAnalysis = await this.analyzeContext(username, deviceId, message);
    threatScore += contextAnalysis.score;
    if (contextAnalysis.isHighRisk) {
      threatScore *= 1.5; // Multiply threat score for high-risk users
    }

    // 6. Historical Analysis
    const historyAnalysis = await this.analyzeHistory(username, deviceId);
    if (historyAnalysis.previousBans > 0) {
      threatScore *= (1 + historyAnalysis.previousBans * 0.3); // 30% increase per previous ban
    }
    if (historyAnalysis.warningCount > 2) {
      threatScore += historyAnalysis.warningCount * 10;
    }

    // Calculate final decision
    const decision = this.calculateDecision(
      threatScore, 
      maxSeverity, 
      primaryReason, 
      detectedPatterns,
      historyAnalysis.previousBans,
      historyAnalysis.warningCount
    );

    // Store message in history for behavioral tracking
    this.addToMessageHistory(deviceId, message);

    // Update warning count if applicable
    if (decision.shouldWarn && !decision.shouldBan) {
      const currentWarnings = this.warningCounts.get(deviceId) || 0;
      this.warningCounts.set(deviceId, currentWarnings + 1);
      
      // 3 warnings = auto temp ban
      if (currentWarnings + 1 >= 3) {
        return {
          ...decision,
          shouldBan: true,
          shouldWarn: false,
          reason: `Exceeded warning limit (${currentWarnings + 1} warnings)`,
          banDuration: 3600, // 1 hour
          suggestedAction: 'temp_ban'
        };
      }
    }

    return decision;
  }

  private analyzeContent(message: string): { score: number; severity: number; patterns: string[]; reason: string } {
    let score = 0;
    let maxSeverity = 0;
    const patterns: string[] = [];
    let reason = '';

    // Check extreme patterns
    for (const pattern of TOXIC_PATTERNS.extreme) {
      if (pattern.test(message)) {
        score += 200;
        maxSeverity = Math.max(maxSeverity, 5);
        patterns.push('extreme_content');
        reason = 'Extreme content violation - immediate action required';
        break;
      }
    }

    // Check critical patterns
    for (const pattern of TOXIC_PATTERNS.critical) {
      if (pattern.test(message)) {
        score += 100;
        maxSeverity = Math.max(maxSeverity, 4);
        patterns.push('critical_content');
        if (!reason) reason = 'Critical content violation - hate speech or slurs detected';
      }
    }

    // Check high patterns
    for (const pattern of TOXIC_PATTERNS.high) {
      if (pattern.test(message)) {
        score += 50;
        maxSeverity = Math.max(maxSeverity, 3);
        patterns.push('high_profanity');
        if (!reason) reason = 'Explicit language detected';
      }
    }

    // Check medium patterns
    for (const pattern of TOXIC_PATTERNS.medium) {
      if (pattern.test(message)) {
        score += 25;
        maxSeverity = Math.max(maxSeverity, 2);
        patterns.push('medium_toxicity');
        if (!reason) reason = 'Inappropriate language detected';
      }
    }

    // Check low patterns
    for (const pattern of TOXIC_PATTERNS.low) {
      if (pattern.test(message)) {
        score += 10;
        maxSeverity = Math.max(maxSeverity, 1);
        patterns.push('mild_toxicity');
        if (!reason) reason = 'Mildly inappropriate content';
      }
    }

    return { score, severity: maxSeverity, patterns, reason };
  }

  private analyzeSpam(message: string): { score: number; isSpam: boolean; reason: string } {
    let score = 0;
    let reason = '';

    // Check for repeated characters
    const repeatedChars = message.match(SPAM_PATTERNS.repeatedChars);
    if (repeatedChars && repeatedChars.length > 0) {
      score += repeatedChars.length * 15;
      reason = 'Repeated character spam';
    }

    // Check for repeated words
    if (SPAM_PATTERNS.repeatedWords.test(message)) {
      score += 30;
      reason = 'Repeated word spam';
    }

    // Check for all caps
    if (SPAM_PATTERNS.allCaps.test(message)) {
      score += 20;
      reason = 'All caps spam';
    }

    // Check for excessive punctuation
    const excessivePunct = message.match(SPAM_PATTERNS.excessivePunctuation);
    if (excessivePunct && excessivePunct.length > 0) {
      score += excessivePunct.length * 10;
      reason = 'Excessive punctuation';
    }

    // Check for link spam
    const links = message.match(SPAM_PATTERNS.linkSpam);
    if (links && links.length > 2) {
      score += links.length * 20;
      reason = 'Link spam detected';
    }

    // Check for social/commercial spam
    if (SPAM_PATTERNS.socialLinks.test(message)) {
      score += 40;
      reason = 'Social media link spam';
    }
    if (SPAM_PATTERNS.commercialSpam.test(message)) {
      score += 60;
      reason = 'Commercial spam detected';
    }
    if (SPAM_PATTERNS.cryptoSpam.test(message)) {
      score += 70;
      reason = 'Crypto/scam spam detected';
    }

    return { score, isSpam: score >= 50, reason };
  }

  private analyzeEvasion(message: string): { score: number; isEvading: boolean; reason: string } {
    let score = 0;
    let reason = '';

    // Check for spaced words
    if (EVASION_PATTERNS.spacedWords.test(message)) {
      score += 40;
      reason = 'Spaced out words to evade filter';
    }

    // Check for dotted words
    if (EVASION_PATTERNS.dottedWords.test(message)) {
      score += 40;
      reason = 'Dotted words to evade filter';
    }

    // Check for zero-width characters
    if (EVASION_PATTERNS.zeroWidth.test(message)) {
      score += 50;
      reason = 'Zero-width characters detected';
    }

    // Check for homoglyphs
    if (EVASION_PATTERNS.homoglyphs.test(message)) {
      score += 30;
      reason = 'Homoglyph characters detected';
    }

    // Check for reversed text
    if (EVASION_PATTERNS.reversed.test(message)) {
      score += 50;
      reason = 'Text direction manipulation detected';
    }

    // Check for excessive leetspeak
    const leetMatches = message.match(EVASION_PATTERNS.leetspeak);
    if (leetMatches && leetMatches.join('').length > message.length * 0.3) {
      score += 25;
      reason = 'Excessive leetspeak detected';
    }

    return { score, isEvading: score >= 30, reason };
  }

  private async analyzeBehavior(
    username: string, 
    deviceId: string, 
    message: string,
    roomId?: number
  ): Promise<{ score: number; flags: string[]; isSuspicious: boolean; reason: string }> {
    let score = 0;
    const flags: string[] = [];
    let reason = '';

    const history = this.messageHistory.get(deviceId) || [];
    const now = Date.now();

    // Check for rapid fire messaging
    const recentMessages = history.filter(m => now - m.timestamp < BEHAVIORAL_FLAGS.rapidFire.window);
    if (recentMessages.length >= BEHAVIORAL_FLAGS.rapidFire.threshold) {
      score += 40;
      flags.push('rapid_fire');
      reason = 'Sending messages too quickly';
    }

    // Check for flooding
    const floodMessages = history.filter(m => now - m.timestamp < BEHAVIORAL_FLAGS.flooding.window);
    if (floodMessages.length >= BEHAVIORAL_FLAGS.flooding.threshold) {
      score += 60;
      flags.push('flooding');
      reason = 'Message flooding detected';
    }

    // Check for repetition
    const sameMessages = history.filter(m => m.content.toLowerCase() === message.toLowerCase());
    if (sameMessages.length >= BEHAVIORAL_FLAGS.repetition.threshold) {
      score += 30;
      flags.push('repetition');
      reason = 'Repeated messages detected';
    }

    // Check message length patterns
    if (message.length < 3 && history.length > 0) {
      const shortMessages = history.filter(m => m.content.length < 3 && now - m.timestamp < 30000);
      if (shortMessages.length > 3) {
        score += 20;
        flags.push('short_spam');
        reason = 'Short message spam';
      }
    }

    // Check for @mention spam
    const mentions = (message.match(/@\w+/g) || []).length;
    if (mentions >= BEHAVIORAL_FLAGS.mentionSpam.threshold) {
      score += 35;
      flags.push('mention_spam');
      reason = 'Excessive mentions';
    }

    return { score, flags, isSuspicious: score >= 40, reason };
  }

  private async analyzeContext(username: string, deviceId: string, message: string): Promise<{ score: number; isHighRisk: boolean }> {
    let score = 0;
    let isHighRisk = false;

    try {
      // Check if user has been previously warned
      const threatLevels = await db.query("threat_levels", { username: `eq.${username}` });
      if (threatLevels.length > 0) {
        const threatLevel = threatLevels[0];
        score += threatLevel.threat_score * 0.1; // Add 10% of previous threat score
        if (threatLevel.threat_score > 100) {
          isHighRisk = true;
        }
      }

      // Check if device has been flagged
      const deviceBans = await db.query("bans", { device_id: `eq.${deviceId}` });
      if (deviceBans.length > 0) {
        isHighRisk = true;
        score += 50;
      }
    } catch (error) {
      console.error("Error in context analysis:", error);
    }

    return { score, isHighRisk };
  }

  private async analyzeHistory(username: string, deviceId: string): Promise<{ previousBans: number; warningCount: number }> {
    try {
      // Check for previous bans
      const userBans = await db.query("bans", { username: `eq.${username}` });
      const deviceBans = await db.query("bans", { device_id: `eq.${deviceId}` });
      
      // Check for warnings
      const warningCount = this.warningCounts.get(deviceId) || 0;

      return {
        previousBans: Math.max(userBans.length, deviceBans.length),
        warningCount
      };
    } catch (error) {
      return { previousBans: 0, warningCount: 0 };
    }
  }

  private calculateDecision(
    threatScore: number,
    severity: BanDecision['severity'],
    reason: string,
    patterns: string[],
    previousBans: number,
    warningCount: number
  ): BanDecision {
    // Calculate confidence based on number of detected patterns
    const confidence = Math.min(100, patterns.length * 20 + threatScore / 2);

    // Determine action based on threat score
    let shouldBan = false;
    let shouldWarn = false;
    let banDuration = 0;
    let suggestedAction: BanDecision['suggestedAction'] = 'ignore';

    if (threatScore >= 200 || severity === 'extreme') {
      // Extreme - Permanent ban
      shouldBan = true;
      banDuration = 0; // 0 = permanent
      suggestedAction = 'perm_ban';
    } else if (threatScore >= 150 || severity === 'critical') {
      // Critical - 24 hour ban (or longer if repeat offender)
      shouldBan = true;
      banDuration = 86400 * (1 + previousBans); // 24hr + 24hr per previous ban
      suggestedAction = 'temp_ban';
    } else if (threatScore >= 100 || severity === 'high') {
      // High - 6 hour ban
      shouldBan = true;
      banDuration = 21600 * (1 + previousBans * 0.5);
      suggestedAction = 'temp_ban';
    } else if (threatScore >= 70 || severity === 'medium') {
      // Medium - 1 hour ban
      shouldBan = true;
      banDuration = 3600 * (1 + previousBans);
      suggestedAction = 'temp_ban';
    } else if (threatScore >= 40) {
      // Warn
      shouldWarn = true;
      suggestedAction = 'warn';
    } else if (threatScore >= 20) {
      // Mute suggestion
      suggestedAction = 'mute';
    }

    // Escalate for repeat offenders
    if (previousBans >= 3 && shouldBan) {
      banDuration = 0; // Permanent for 3+ previous bans
      suggestedAction = 'perm_ban';
    }

    return {
      shouldBan,
      shouldWarn,
      reason: reason || 'Automatic detection triggered',
      severity,
      threatScore: Math.round(threatScore),
      banDuration: Math.round(banDuration),
      confidence: Math.round(confidence),
      detectedPatterns: patterns,
      suggestedAction
    };
  }

  private addToMessageHistory(deviceId: string, content: string): void {
    const history = this.messageHistory.get(deviceId) || [];
    history.push({ content, timestamp: Date.now() });
    
    // Keep only last 100 messages or last hour
    const oneHourAgo = Date.now() - 3600000;
    const filtered = history.filter(m => m.timestamp > oneHourAgo).slice(-100);
    this.messageHistory.set(deviceId, filtered);
  }

  private severityToNumber(severity: BanDecision['severity']): number {
    const map = { low: 1, medium: 2, high: 3, critical: 4, extreme: 5 };
    return map[severity];
  }

  private numberToSeverity(num: number): BanDecision['severity'] {
    const map: Record<number, BanDecision['severity']> = { 1: 'low', 2: 'medium', 3: 'high', 4: 'critical', 5: 'extreme' };
    return map[Math.min(5, Math.max(1, num))] || 'low';
  }

  // Execute ban action
  async executeBan(
    username: string, 
    deviceId: string, 
    decision: BanDecision,
    messageContent?: string
  ): Promise<boolean> {
    try {
      const now = Date.now();
      const expiresAt = decision.banDuration === 0 ? null : now + (decision.banDuration * 1000);

      await db.insert("bans", {
        username,
        device_id: deviceId,
        ban_duration: decision.banDuration,
        ban_reason: decision.reason,
        message_content: messageContent || null,
        created_at: now,
        expires_at: expiresAt,
        room_id: null,
        auto_ban: 1,
        threat_score: decision.threatScore,
        detected_patterns: JSON.stringify(decision.detectedPatterns),
        severity: decision.severity,
      });

      // Create notification
      await db.insert("notifications", {
        type: "auto_ban",
        message: `You have been ${decision.banDuration === 0 ? 'permanently banned' : `banned for ${Math.round(decision.banDuration / 3600)} hours`}: ${decision.reason}`,
        recipient_device_id: deviceId,
        is_read: 0,
        created_by_admin: 0,
      });

      // Update threat level
      await this.updateThreatLevel(username, deviceId, decision.threatScore);

      console.log(`Auto-ban executed: ${username} - ${decision.reason} - Score: ${decision.threatScore}`);
      return true;
    } catch (error) {
      console.error("Error executing ban:", error);
      return false;
    }
  }

  private async updateThreatLevel(username: string, deviceId: string, additionalScore: number): Promise<void> {
    try {
      const existing = await db.query("threat_levels", { username: `eq.${username}` });
      
      if (existing.length > 0) {
        await db.update("threat_levels", { username: `eq.${username}` }, {
          threat_score: existing[0].threat_score + additionalScore,
          last_activity: Date.now(),
          warning_count: existing[0].warning_count + 1,
        });
      } else {
        await db.insert("threat_levels", {
          username,
          device_id: deviceId,
          threat_score: additionalScore,
          last_activity: Date.now(),
          warning_count: 1,
        });
      }
    } catch (error) {
      console.error("Error updating threat level:", error);
    }
  }

  // Clear warnings for a user (admin action)
  clearWarnings(deviceId: string): void {
    this.warningCounts.delete(deviceId);
    this.messageHistory.delete(deviceId);
  }

  // Get current warning count
  getWarningCount(deviceId: string): number {
    return this.warningCounts.get(deviceId) || 0;
  }
}

export const superBanSystem = SuperAdvancedBanSystem.getInstance();
export default superBanSystem;
