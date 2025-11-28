import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "./deviceId";

interface BanPattern {
  _row_id: number;
  pattern_name: string;
  regex_pattern: string;
  ban_reason: string;
  severity_level: number;
  is_active: number;
}

interface AdvancedBanResult {
  shouldBan: boolean;
  reason: string;
  severity: number;
  threatScore: number;
}

export class AdvancedBanDetection {
  private static patterns: BanPattern[] = [];

  static async loadPatterns(): Promise<void> {
    try {
      const patterns = await db.query("ban_patterns", { is_active: `eq.1` });
      this.patterns = patterns;
    } catch (error) {
      console.error("Error loading ban patterns:", error);
    }
  }

  static async analyzeMessage(message: string, username: string): Promise<AdvancedBanResult> {
    if (this.patterns.length === 0) {
      await this.loadPatterns();
    }

    let maxSeverity = 0;
    let detectedReason = "Content violation detected";
    let threatScore = 0;

    const lowerMessage = message.toLowerCase();
    
    // Check against all patterns
    for (const pattern of this.patterns) {
      try {
        const regex = new RegExp(pattern.regex_pattern, 'gi');
        if (regex.test(message)) {
          maxSeverity = Math.max(maxSeverity, pattern.severity_level);
          detectedReason = pattern.ban_reason;
          threatScore += pattern.severity_level * 10;
        }
      } catch (error) {
        console.error(`Invalid regex pattern: ${pattern.pattern_name}`, error);
      }
    }

    // Advanced linguistic analysis
    threatScore += this.calculateThreatScore(message);
    
    // Behavioral patterns
    if (this.isSpamBehavior(message)) {
      threatScore += 50;
      if (maxSeverity < 3) {
        maxSeverity = 3;
        detectedReason = "Spam-like behavior detected";
      }
    }

    // Threat escalation tracking
    await this.updateThreatLevel(username, threatScore);

    const shouldBan = maxSeverity >= 4 || threatScore >= 100;

    return {
      shouldBan,
      reason: detectedReason,
      severity: maxSeverity,
      threatScore
    };
  }

  private static calculateThreatScore(message: string): number {
    let score = 0;
    const words = message.toLowerCase().split(/\s+/);

    // Aggressive language indicators
    const aggressiveWords = ['destroy', 'hate', 'kill', 'die', 'harm', 'attack', 'violent'];
    score += words.filter(word => aggressiveWords.includes(word)).length * 20;

    // Repetitive patterns (caps, punctuation)
    if (message === message.toUpperCase() && message.length > 10) {
      score += 30;
    }

    if ((message.match(/[!]/g) || []).length > 5) {
      score += 25;
    }

    // Personal attacks
    if (/\b(you\s+are|you're|u\s+are)\s+(stupid|idiot|dumb|moron)\b/gi.test(message)) {
      score += 40;
    }

    // Rapid succession indicators (short consecutive messages)
    if (message.length < 5 && message.trim()) {
      score += 15;
    }

    return score;
  }

  private static isSpamBehavior(message: string): boolean {
    // Check for spam indicators
    const spamPatterns = [
      /(.)\1{8,}/, // Repeated characters
      /\b(watch|join|click|visit|free)\b.*\b(https?:\/\/|discord\.gg|\.gg)/gi, // Links with call to action
      /\b(buy|sell|trade|cheap|discount|offer)\b.*\$\d+/gi, // Commercial spam
      /^[A-Z\s!]{20,}$/, // All caps spam
    ];

    return spamPatterns.some(pattern => pattern.test(message));
  }

  private static async updateThreatLevel(username: string, threatScore: number): Promise<void> {
    try {
      const deviceId = getDeviceId();
      const existing = await db.query("threat_levels", { username: `eq.${username}` });
      
      const now = Date.now();
      const fingerprint = this.generateDeviceFingerprint();

      if (existing.length > 0) {
        // Update existing threat level
        const updated = {
          threat_score: existing[0].threat_score + threatScore,
          last_activity: now,
          warning_count: existing[0].warning_count + (threatScore > 50 ? 1 : 0),
          device_fingerprint: fingerprint,
        };
        
        await db.update("threat_levels", { username: `eq.${username}` }, updated);
      } else {
        // Create new threat level record
        await db.insert("threat_levels", {
          username,
          threat_score: threatScore,
          last_activity: now,
          warning_count: threatScore > 50 ? 1 : 0,
          device_fingerprint: fingerprint,
        });
      }
    } catch (error) {
      console.error("Error updating threat level:", error);
    }
  }

  private static generateDeviceFingerprint(): string {
    // Create a device fingerprint for additional tracking
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    return btoa(fingerprint).substring(0, 100);
  }

  static async getThreatLevel(username: string): Promise<number> {
    try {
      const existing = await db.query("threat_levels", { username: `eq.${username}` });
      return existing.length > 0 ? existing[0].threat_score : 0;
    } catch (error) {
      return 0;
    }
  }

  static async getHighRiskUsers(): Promise<string[]> {
    try {
      const highRisk = await db.query("threat_levels", { threat_score: `gte.80`, order: "threat_score.desc" });
      return highRisk.map(level => level.username);
    } catch (error) {
      return [];
    }
  }

  // Context-based ban detection
  static async checkContextRisk(username: string, message: string, roomId: number): Promise<boolean> {
    try {
      // Check user's recent message frequency
      const recentMessages = await db.query("messages", {
        sender_name: `eq.${username}`,
        room_id: `eq.${roomId}`,
        _created_at: `gte.${Date.now() - 60000}` // Last minute
      });

      // More than 10 messages in a minute = possible spam
      if (recentMessages.length > 10) {
        return true;
      }

      // Check if user has been warned before
      const warnings = await db.query("threat_levels", { 
        username: `eq.${username}`,
        warning_count: `gte.2`
      });

      return warnings.length > 0;
    } catch (error) {
      return false;
    }
  }
}

export default AdvancedBanDetection;