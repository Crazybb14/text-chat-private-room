import db from './shared/kliv-database.js';
import { getDeviceId } from './deviceId';

interface NotificationSettings {
  desktopEnabled: boolean;
  inAppEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  priorityFilter: ('low' | 'normal' | 'high' | 'urgent')[];
  typesEnabled: {
    announcements: boolean;
    bans: boolean;
    messages: boolean;
    system: boolean;
    admin_messages: boolean;
  };
}

interface EnhancedNotification {
  id: string;
  title: string;
  message: string;
  type: 'announcement' | 'ban' | 'message' | 'system' | 'admin_message';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  desktopNotify: boolean;
  soundAlert: boolean;
  vibrationAlert: boolean;
  duration: number; // milliseconds
  actionButtons?: {
    label: string;
    action: string;
    style: 'primary' | 'secondary' | 'danger';
  }[];
  imageUrl?: string;
  timestamp: number;
  expiresAt?: number;
}

class EnhancedNotifications {
  private static instance: EnhancedNotifications;
  private notificationQueue: EnhancedNotification[] = [];
  private settings: NotificationSettings = {
    desktopEnabled: true,
    inAppEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
    priorityFilter: ['normal', 'high', 'urgent'],
    typesEnabled: {
      announcements: true,
      bans: true,
      messages: true,
      system: true,
      admin_messages: true
    }
  };
  private notificationListeners: ((notification: EnhancedNotification) => void)[] = [];
  private activeNotifications = new Map<string, HTMLElement>();
  private isProcessing = false;

  static getInstance(): EnhancedNotifications {
    if (!EnhancedNotifications.instance) {
      EnhancedNotifications.instance = new EnhancedNotifications();
    }
    return EnhancedNotifications.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Load user notification preferences
      await this.loadNotificationSettings();
      
      // Initialize desktop notification permissions
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          await this.requestDesktopPermission();
        }
      }

      // Initialize audio context for sound notifications
      this.initializeAudioSystem();
      
      // Initialize vibration API if available
      this.initializeVibration();

      // Start notification processing
      this.startNotificationProcessor();

      console.log('Enhanced notifications system initialized');
    } catch (error) {
      console.error('Failed to initialize enhanced notifications:', error);
    }
  }

  private async loadNotificationSettings(): Promise<void> {
    try {
      const deviceId = getDeviceId();
      const settings = await db.query('accessibility_settings', { device_id: `eq.${deviceId}` });
      
      if (settings.length > 0) {
        // Apply user notification preferences
        const userSettings = settings[0];
        this.settings.soundEnabled = !userSettings.text_to_speech;
        this.settings.desktopEnabled = true; // Always enabled in Chromebook environment
        this.settings.largeButtons = userSettings.large_buttons;
      }
    } catch (error) {
      console.log('Using default notification settings');
    }
  }

  private async requestDesktopPermission(): Promise<boolean> {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  private initializeAudioSystem(): void {
    if (typeof Audio !== 'undefined' && this.settings.soundEnabled) {
      try {
        // Create audio context for Chromebook optimized sounds
        interface WindowWithWebkit extends Window {
          webkitAudioContext?: typeof AudioContext;
        }
        const windowWithWebkit = window as WindowWithWebkit;
        const audioContext = new (window.AudioContext || windowWithWebkit.webkitAudioContext!)();
        this.setupNotificationSounds(audioContext);
      } catch (error) {
        console.log('Audio system not available');
      }
    }
  }

  private setupNotificationSounds(audioContext: AudioContext): void {
    // Chromebook-friendly notification sounds
    (window as unknown as Record<string, unknown>).createNotificationSound = (type: string) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different frequencies for different notification types
      const frequencies = {
        message: 800,
        announcement: 600,
        warning: 400,
        urgent: 1000
      };

      oscillator.frequency.value = frequencies[type as keyof typeof frequencies] || 600;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    };
  }

  private initializeVibration(): void {
    if ('vibrate' in navigator && this.settings.vibrationEnabled) {
      // Chromebook vibration patterns
      (window as unknown as Record<string, unknown>).vibrateNotification = (type: string) => {
        const patterns = {
          message: [50],
          announcement: [100, 50, 100],
          warning: [200, 100, 200],
          urgent: [500, 100, 500, 100, 500]
        };
        navigator.vibrate(patterns[type as keyof typeof patterns] || [100]);
      };
    }
  }

  private startNotificationProcessor(): void {
    setInterval(() => {
      this.processNotificationQueue();
    }, 1000); // Process every second for real-time experience
  }

  private async processNotificationQueue(): Promise<void> {
    if (this.isProcessing || this.notificationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const notifications = [...this.notificationQueue];
      this.notificationQueue = [];

      for (const notification of notifications) {
        await this.processNotification(notification);
        await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between notifications
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processNotification(notification: EnhancedNotification): Promise<void> {
    // Check if notification should be shown based on settings
    if (!this.shouldShowNotification(notification)) {
      return;
    }

    // Show in-app notification
    if (this.settings.inAppEnabled) {
      this.showInAppNotification(notification);
    }

    // Show desktop notification
    if (this.settings.desktopEnabled && notification.desktopNotify) {
      this.showDesktopNotification(notification);
    }

    // Play sound
    if (this.settings.soundEnabled && notification.soundAlert) {
      this.playNotificationSound(notification.type);
    }

    // Vibrate if enabled
    if (this.settings.vibrationEnabled && notification.vibrationAlert) {
      this.vibrateNotification(notification.type);
    }

    // Notify listeners
    this.notifyListeners(notification);

    // Log notification
    await this.logNotificationEvent(notification);
  }

  private shouldShowNotification(notification: EnhancedNotification): boolean {
    // Check priority filter
    if (!this.settings.priorityFilter.includes(notification.priority)) {
      return false;
    }

    // Check type filter
    const typeKey = notification.type as keyof typeof this.settings.typesEnabled;
    if (!this.settings.typesEnabled[typeKey]) {
      return false;
    }

    // Check expiration
    if (notification.expiresAt && notification.expiresAt < Date.now()) {
      return false;
    }

    return true;
  }

  private showInAppNotification(notification: EnhancedNotification): void {
    // Remove existing notification with same ID
    if (this.activeNotifications.has(notification.id)) {
      this.activeNotifications.get(notification.id)?.remove();
    }

    const notificationEl = document.createElement('div');
    notificationEl.id = `notification-${notification.id}`;
    notificationEl.className = `
      fixed top-4 right-4 max-w-md rounded-xl shadow-2xl z-50 
      transform transition-all duration-500 ease-out 
      ${this.getNotificationStyle(notification.type, notification.priority)}
      backdrop-blur-xl border-white/10
    `;

    const priorityBadge = this.getPriorityBadge(notification.priority);
    const actionButtons = notification.actionButtons ? this.createActionButtons(notification.actionButtons, notification.id) : '';

    notificationEl.innerHTML = `
      <div class="p-6 flex items-start gap-4">
        ${notification.imageUrl ? `<img src="${notification.imageUrl}" class="w-16 h-16 rounded-lg object-cover" alt="">` : ''}
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            ${priorityBadge}
            <h3 class="font-bold text-white text-lg">${notification.title}</h3>
          </div>
          <p class="text-white/90 text-sm mb-3">${notification.message}</p>
          ${actionButtons}
          <div class="flex items-center justify-between mt-4">
            <span class="text-xs text-white/60">${new Date(notification.timestamp).toLocaleTimeString()}</span>
            <button onclick="enhancedNotifications.closeNotification('${notification.id}')" class="text-white/40 hover:text-white/80 transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(notificationEl);
    this.activeNotifications.set(notification.id, notificationEl);

    // Animate in
    setTimeout(() => {
      notificationEl.classList.add('translate-x-0', 'opacity-100');
      notificationEl.classList.remove('translate-x-full', 'opacity-0');
    }, 10);

    // Auto-dismiss
    if (notification.duration > 0) {
      setTimeout(() => {
        this.closeNotification(notification.id);
      }, notification.duration);
    }
  }

  private showDesktopNotification(notification: EnhancedNotification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const desktopNotification = new Notification(notification.title, {
        body: notification.message,
        icon: notification.imageUrl || '/favicon.ico',
        tag: notification.id,
        requireInteraction: notification.priority === 'urgent',
        silent: !notification.soundAlert,
        data: { notificationId: notification.id }
      });

      // Handle clicks
      desktopNotification.onclick = () => {
        window.focus();
        desktopNotification.close();
        this.handleNotificationAction(notification.id, 'click');
      };

      // Auto-dismiss for non-urgent notifications
      if (notification.priority !== 'urgent') {
        setTimeout(() => desktopNotification.close(), notification.duration || 5000);
      }
    }
  }

  private getNotificationStyle(type: string, priority: string): string {
    const typeStyles = {
      announcement: 'from-blue-600/80 to-purple-600/80',
      ban: 'from-red-600/80 to-orange-600/80',
      message: 'from-green-600/80 to-teal-600/80',
      system: 'from-gray-600/80 to-slate-600/80',
      admin_message: 'from-yellow-600/80 to-amber-600/80'
    };

    const intensity = {
      low: 'opacity-70',
      normal: 'opacity-80',
      high: 'opacity-90',
      urgent: 'opacity-100 shadow-2xl shadow-red-500/20'
    };

    return `bg-gradient-to-br ${typeStyles[type as keyof typeof typeStyles]} ${intensity[priority as keyof typeof intensity]} scale-95 opacity-0 translate-x-full`;
  }

  private getPriorityBadge(priority: string): string {
    const badges = {
      low: '<span class="px-2 py-1 bg-blue-500/30 text-blue-200 text-xs rounded-full">Low</span>',
      normal: '<span class="px-2 py-1 bg-green-500/30 text-green-200 text-xs rounded-full">Normal</span>',
      high: '<span class="px-2 py-1 bg-orange-500/30 text-orange-200 text-xs rounded-full">High</span>',
      urgent: '<span class="px-2 py-1 bg-red-500/30 text-red-200 text-xs rounded-full animate-pulse">Urgent</span>'
    };

    return badges[priority as keyof typeof badges] || badges.normal;
  }

  private createActionButtons(buttons: {label: string, action: string, style: string}[], notificationId: string): string {
    return buttons.map(btn => {
      const styleClasses = {
        primary: 'bg-white/20 hover:bg-white/30 text-white',
        secondary: 'bg-black/20 hover:bg-black/30 text-white/80',
        danger: 'bg-red-500/30 hover:bg-red-500/40 text-white'
      };

      return `
        <button 
          onclick="enhancedNotifications.handleNotificationAction('${notificationId}', '${btn.action}')"
          class="px-3 py-1 rounded-lg text-sm font-medium transition-colors ${styleClasses[btn.style]}"
        >
          ${btn.label}
        </button>
      `;
    }).join('');
  }

  private playNotificationSound(type: string): void {
    const win = window as unknown as Record<string, unknown>;
    if (typeof window !== 'undefined' && win.createNotificationSound) {
      (win.createNotificationSound as (type: string) => void)(type);
    }
  }

  private vibrateNotification(type: string): void {
    const win = window as unknown as Record<string, unknown>;
    if (typeof window !== 'undefined' && win.vibrateNotification) {
      (win.vibrateNotification as (type: string) => void)(type);
    }
  }

  private notifyListeners(notification: EnhancedNotification): void {
    this.notificationListeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  private async logNotificationEvent(notification: EnhancedNotification): Promise<void> {
    try {
      await db.insert('notification_logs', {
        notification_id: notification.id,
        device_id: getDeviceId(),
        type: notification.type,
        content: JSON.stringify({
          title: notification.title,
          message: notification.message,
          priority: notification.priority
        }),
        sent_at: Date.now(),
        delivered: true,
        seen: false,
        click_count: 0
      });
    } catch (error) {
      console.error('Failed to log notification event:', error);
    }
  }

  // Public API methods
  async sendNotification(notification: Partial<EnhancedNotification>): Promise<string> {
    const enhancedNotification: EnhancedNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: notification.title || 'Notification',
      message: notification.message || '',
      type: notification.type || 'system',
      priority: notification.priority || 'normal',
      desktopNotify: notification.desktopNotify !== false,
      soundAlert: notification.soundAlert !== false,
      vibrationAlert: notification.vibrationAlert !== false,
      duration: notification.duration || (notification.priority === 'urgent' ? 0 : 8000),
      actionButtons: notification.actionButtons,
      imageUrl: notification.imageUrl,
      timestamp: Date.now(),
      expiresAt: notification.expiresAt
    };

    this.notificationQueue.push(enhancedNotification);
    return enhancedNotification.id;
  }

  closeNotification(notificationId: string): void {
    const notificationEl = this.activeNotifications.get(notificationId);
    if (notificationEl) {
      notificationEl.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => {
        notificationEl.remove();
        this.activeNotifications.delete(notificationId);
      }, 500);
    }
  }

  handleNotificationAction(notificationId: string, action: string): void {
    console.log(`Notification action: ${action} for ${notificationId}`);
    // Handle different actions (view, dismiss, report, etc.)
    
    // Close notification on action
    if (action !== 'keep') {
      this.closeNotification(notificationId);
    }
  }

  addNotificationListener(listener: (notification: EnhancedNotification) => void): void {
    this.notificationListeners.push(listener);
  }

  removeNotificationListener(listener: (notification: EnhancedNotification) => void): void {
    const index = this.notificationListeners.indexOf(listener);
    if (index > -1) {
      this.notificationListeners.splice(index, 1);
    }
  }

  updateSettings(settings: Partial<NotificationSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.saveNotificationSettings();
  }

  private async saveNotificationSettings(): Promise<void> {
    try {
      const deviceId = getDeviceId();
      // Save to accessibility_settings table
      const currentSettings = await db.query('accessibility_settings', { device_id: `eq.${deviceId}` });
      
      if (currentSettings.length > 0) {
        await db.update('accessibility_settings', { device_id: `eq.${deviceId}` }, {
          text_to_speech: !this.settings.soundEnabled,
          large_buttons: this.settings.largeButtons,
          updated_at: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  // Specialized notification methods
  async sendAdminAnnouncement(title: string, message: string, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): Promise<string> {
    return this.sendNotification({
      title: `📢 ${title}`,
      message,
      type: 'announcement',
      priority,
      desktopNotify: true,
      soundAlert: true,
      vibrationAlert: priority === 'urgent',
      duration: priority === 'urgent' ? 0 : 10000,
      actionButtons: priority === 'urgent' ? [
        { label: 'Dismiss', action: 'dismiss', style: 'primary' },
        { label: 'Report', action: 'report', style: 'secondary' }
      ] : []
    });
  }

  async sendBanNotification(deviceId: string, reason: string, duration?: number): Promise<string> {
    const durationText = duration ? `${duration} hours` : 'permanently';
    return this.sendNotification({
      title: '⛔ Access Restricted',
      message: `You have been banned ${durationText}: ${reason}`,
      type: 'ban',
      priority: 'high',
      desktopNotify: true,
      soundAlert: true,
      vibrationAlert: true,
      duration: 0, // Don't auto-dismiss ban notifications
      actionButtons: [
        { label: 'Appeal', action: 'appeal', style: 'secondary' },
        { label: 'Dismiss', action: 'dismiss', style: 'danger' }
      ]
    });
  }

  async sendAdminMessage(message: string, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): Promise<string> {
    return this.sendNotification({
      title: '👑 Admin Message',
      message,
      type: 'admin_message',
      priority,
      desktopNotify: true,
      soundAlert: true,
      vibrationAlert: priority !== 'low',
      duration: priority === 'urgent' ? 15000 : 8000,
      actionButtons: [
        { label: 'Reply', action: 'reply', style: 'primary' },
        { label: 'Dismiss', action: 'dismiss', style: 'secondary' }
      ]
    });
  }

  async sendSystemAlert(title: string, message: string, critical: boolean = false): Promise<string> {
    return this.sendNotification({
      title: `⚙️ ${title}`,
      message,
      type: 'system',
      priority: critical ? 'urgent' : 'normal',
      desktopNotify: critical,
      soundAlert: critical,
      vibrationAlert: critical,
      duration: critical ? 0 : 6000
    });
  }
}

// Global instance
export const enhancedNotifications = EnhancedNotifications.getInstance();
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).enhancedNotifications = enhancedNotifications;
}
export default enhancedNotifications;