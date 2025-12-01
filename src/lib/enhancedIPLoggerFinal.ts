class EnhancedIPLogger {
  private static instance: EnhancedIPLogger;
  private readonly deviceId: string;
  private fingerprint: string;
  private lastIP: string | null = null;
  private trackingEnabled: boolean = true;

  private constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.fingerprint = this.generateFingerprint();
  }

  static getInstance(): EnhancedIPLogger {
    if (!EnhancedIPLogger.instance) {
      EnhancedIPLogger.instance = new EnhancedIPLogger();
    }
    return EnhancedIPLogger.instance;
  }

  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('device_identifier');
    if (deviceId) {
      return deviceId;
    }

    // Create new persistent device ID that doesn't rely on IP
    const newId = this.generateSecureDeviceId();
    localStorage.setItem('device_identifier', newId);
    return newId;
  }

  private generateSecureDeviceId(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Generate fingerprint from browser characteristics
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(2)
    };

    // Simple hash for the fingerprint
    const fingerprintString = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < fingerprintString.length; i++) {
      const char = fingerprintString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `dev_${Math.abs(hash).toString(16)}_${Date.now().toString(36)}`;
  }

  private generateFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    try {
      // Canvas fingerprinting
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 2);
      
      const canvasFingerprint = canvas.toDataURL().slice(-50);
      
      return btoa(navigator.userAgent + canvasFingerprint + screen.width + screen.height).slice(0, 32);
    } catch (error) {
      // Fallback if canvas is not available
      return btoa(navigator.userAgent + screen.width + screen.height).slice(0, 32);
    }
  }

  private async getCurrentIP(): Promise<string | null> {
    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.ip || null;
      }
    } catch (error) {
      console.warn('Failed to get IP address:', error);
    }
    
    return null;
  }

  async logActivity(activity: {
    username: string;
    action: string;
    room_id?: number | null;
    message_preview?: string;
    additional_data?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.trackingEnabled) return;

    try {
      const currentIP = await this.getCurrentIP();
      
      // Only log if IP has changed or if it's the first time
      if (this.lastIP !== currentIP) {
        this.lastIP = currentIP;
      }

      const logEntry = {
        device_id: this.deviceId,
        fingerprint: this.fingerprint,
        username: activity.username,
        action: activity.action,
        room_id: activity.room_id || null,
        message_preview: activity.message_preview?.substring(0, 100) || null,
        ip_address: currentIP,
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        timestamp: Date.now(),
        additional_data: activity.additional_data || null
      };

      // Send to database
      const db = (await import('./shared/kliv-database.js')).default;
      await db.insert("ip_activity_logs", logEntry);

    } catch (error) {
      // Don't let logging errors crash the app
      console.warn('Failed to log activity:', error);
    }
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  getFingerprint(): string {
    return this.fingerprint;
  }

  getCurrentStoredIP(): string | null {
    return this.lastIP;
  }

  disableTracking(): void {
    this.trackingEnabled = false;
  }

  enableTracking(): void {
    this.trackingEnabled = true;
  }

  // Enhanced username persistence that works across cookie clearing
  async persistUsername(username: string): Promise<void> {
    try {
      // Store in multiple locations for persistence
      localStorage.setItem('username_persistent', username);
      sessionStorage.setItem('username_temporary', username);
      
      // Also store in database as backup
      const db = (await import('./shared/kliv-database.js')).default;
      await db.upsert("persistent_user_data", { device_id: this.deviceId }, {
        device_id: this.deviceId,
        fingerprint: this.fingerprint,
        username: username,
        last_updated: Date.now()
      });

    } catch (error) {
      console.warn('Failed to persist username:', error);
    }
  }

  async retrieveUsername(): Promise<string | null> {
    try {
      // Try localStorage first
      let username = localStorage.getItem('username_persistent');
      if (username && username.trim()) {
        return username.trim();
      }

      // Try sessionStorage
      username = sessionStorage.getItem('username_temporary');
      if (username && username.trim()) {
        return username.trim();
      }

      // Try database backup
      const db = (await import('./shared/kliv-database.js')).default;
      const records = await db.query("persistent_user_data", {
        device_id: `eq.${this.deviceId}`
      });

      if (records.length > 0) {
        const storedUsername = records[0].username;
        if (storedUsername && storedUsername.trim()) {
          // Restore to localStorage for future use
          localStorage.setItem('username_persistent', storedUsername);
          return storedUsername.trim();
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to retrieve username:', error);
      return null;
    }
  }

  async clearUsername(): Promise<void> {
    try {
      localStorage.removeItem('username_persistent');
      sessionStorage.removeItem('username_temporary');
      
      const db = (await import('./shared/kliv-database.js')).default;
      await db.delete("persistent_user_data", { device_id: `eq.${this.deviceId}` });
    } catch (error) {
      console.warn('Failed to clear username:', error);
    }
  }
}

export default EnhancedIPLogger;