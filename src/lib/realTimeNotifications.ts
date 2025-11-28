import { content } from './shared/kliv-content.js';
import db from './shared/kliv-database.js';
import { getDeviceId } from './deviceId';

interface Announcement {
  _row_id: number;
  title: string;
  message: string;
  type: 'general' | 'warning' | 'maintenance' | 'update' | 'feature' | 'security';
  desktop_notification: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: number;
  expires_at: number | null;
  created_by: string;
  is_active: boolean;
  target_audience: 'all' | 'banned_users' | 'active_users';
}

interface NotificationLog {
  _row_id: number;
  notification_id: string;
  device_id: string | null;
  type: string;
  content: string;
  sent_at: number;
  delivered: boolean;
  seen: boolean;
  click_count: number;
}

class RealTimeNotifications {
  private static instance: RealTimeNotifications;
  private notificationListeners: ((announcement: Announcement) => void)[] = [];
  private pollInterval: number | null = null;
  private lastCheckTime = Date.now();

  static getInstance(): RealTimeNotifications {
    if (!RealTimeNotifications.instance) {
      RealTimeNotifications.instance = new RealTimeNotifications();
    }
    return RealTimeNotifications.instance;
  }

  // Initialize real-time notifications
  async initialize(): Promise<void> {
    try {
      // Start polling for new announcements every 5 seconds
      this.startPolling();
      
      // Log notification system startup
      await this.logNotificationEvent('system_startup', {
        device_id: getDeviceId(),
        timestamp: Date.now()
      });

      console.log('Real-time notification system initialized');
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  }

  // Start polling for announcements
  private startPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    this.pollInterval = setInterval(async () => {
      await this.checkNewAnnouncements();
    }, 5000); // Check every 5 seconds
  }

  // Check for new announcements
  private async checkNewAnnouncements(): Promise<void> {
    try {
      const deviceId = getDeviceId();
      
      // Get active announcements created after last check
      const newAnnouncements = await db.query('announcements', {
        is_active: 'eq.true',
        _created_at: `gt.${this.lastCheckTime}`,
        order: '_created_at.desc'
      });

      for (const announcement of newAnnouncements as Announcement[]) {
        // Check if announcement has expired
        if (announcement.expires_at && announcement.expires_at < Date.now()) {
          continue;
        }

        // Check target audience
        const matchesTarget = await this.checkTargetAudience(announcement, deviceId);
        if (!matchesTarget) {
          continue;
        }

        // Send in-app notification
        this.notifyListeners(announcement);

        // Log the notification
        await this.logNotificationEvent('announcement_received', {
          announcement_id: announcement._row_id.toString(),
          device_id: deviceId,
          type: announcement.type,
          content: `${announcement.title}: ${announcement.message}`
        });

        // Send desktop notification if enabled
        if (announcement.desktop_notification && 'Notification' in window && Notification.permission === 'granted') {
          this.sendDesktopNotification(announcement);
        }

        this.lastCheckTime = announcement._created_at;
      }
    } catch (error) {
      console.error('Error checking announcements:', error);
    }
  }

  // Check if user matches target audience for announcement
  private async checkTargetAudience(announcement: Announcement, deviceId: string): Promise<boolean> {
    if (announcement.target_audience === 'all') {
      return true;
    }

    if (announcement.target_audience === 'banned_users') {
      const bans = await db.query('bans', { device_id: `eq.${deviceId}` });
      const now = Date.now();
      return bans.some((ban: any) => !ban.expires_at || ban.expires_at > now);
    }

    if (announcement.target_audience === 'active_users') {
      const bans = await db.query('bans', { device_id: `eq.${deviceId}` });
      const now = Date.now();
      return !bans.some((ban: any) => !ban.expires_at || ban.expires_at > now);
    }

    return true;
  }

  // Send desktop notification
  private sendDesktopNotification(announcement: Announcement): void {
    const priorityStyles = {
      urgent: { icon: '⚠️', duration: 'requireInteraction: true' },
      high: { icon: '🔥', duration: 'requireInteraction: true' },
      normal: { icon: 'ℹ️', duration: '' },
      low: { icon: '📢', duration: '' }
    };

    const style = priorityStyles[announcement.priority] || priorityStyles.normal;

    const notification = new Notification(style.icon + ' ' + announcement.title, {
      body: announcement.message,
      icon: '/favicon.ico',
      tag: `announcement-${announcement._row_id}`,
      data: { announcementId: announcement._row_id }
    });

    // Auto-close for non-urgent notifications
    if (announcement.priority !== 'urgent' && announcement.priority !== 'high') {
      setTimeout(() => notification.close(), 5000);
    }

    // Handle notification clicks
    notification.onclick = () => {
      window.focus();
      notification.close();
      
      // Log click
      this.logNotificationEvent('announcement_clicked', {
        announcement_id: announcement._row_id.toString(),
        device_id: getDeviceId()
      });
    };
  }

  // Add notification listener
  addNotificationListener(listener: (announcement: Announcement) => void): void {
    this.notificationListeners.push(listener);
  }

  // Remove notification listener  
  removeNotificationListener(listener: (announcement: Announcement) => void): void {
    const index = this.notificationListeners.indexOf(listener);
    if (index > -1) {
      this.notificationListeners.splice(index, 1);
    }
  }

  // Notify all listeners
  private notifyListeners(announcement: Announcement): void {
    this.notificationListeners.forEach(listener => {
      try {
        listener(announcement);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  // Send announcement immediately (for admin use)
  async sendAnnouncement(announcement: Partial<Announcement>): Promise<boolean> {
    try {
      const fullAnnouncement: Announcement = {
        title: announcement.title || 'Announcement',
        message: announcement.message || 'New announcement',
        type: announcement.type || 'general',
        desktop_notification: announcement.desktop_notification !== false,
        priority: announcement.priority || 'normal',
        created_at: Date.now(),
        expires_at: announcement.expires_at || null,
        created_by: 'admin',
        is_active: true,
        target_audience: announcement.target_audience || 'all'
      };

      await db.insert('announcements', fullAnnouncement);
      
      // Log announcement creation
      await this.logNotificationEvent('announcement_created', {
        announcement_id: fullAnnouncement._row_id?.toString(),
        type: fullAnnouncement.type,
        target_audience: fullAnnouncement.target_audience,
        desktop_notification: fullAnnouncement.desktop_notification
      });

      return true;
    } catch (error) {
      console.error('Failed to send announcement:', error);
      return false;
    }
  }

  // Log notification events
  private async logNotificationEvent(type: string, data: unknown): Promise<void> {
    try {
      await db.insert('notification_logs', {
        notification_id: data.announcement_id || type,
        device_id: data.device_id || null,
        type: type,
        content: JSON.stringify(data),
        sent_at: Date.now(),
        delivered: false,
        seen: false,
        click_count: 0
      });
    } catch (error) {
      console.error('Failed to log notification event:', error);
    }
  }

  // Stop polling
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.notificationListeners = [];
  }

  // Get active announcements
  async getActiveAnnouncements(): Promise<Announcement[]> {
    try {
      const now = Date.now();
      const announcements = await db.query('announcements', {
        is_active: 'eq.true',
        order: '_created_at.desc'
      });

      return announcements.filter((a: Announcement) => 
        !a.expires_at || a.expires_at > now
      );
    } catch (error) {
      console.error('Error getting announcements:', error);
      return [];
    }
  }
}

export default RealTimeNotifications.getInstance();