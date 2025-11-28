import PushNotificationManager from "./pushNotifications";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "./deviceId";

interface BanNotification {
  username: string;
  reason: string;
  duration: number;
  message?: string;
}

interface NotificationMessage {
  type: 'ban' | 'warning' | 'auto_ban' | 'admin_message';
  title: string;
  body: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
}

export class RealTimePushNotifications {
  private static instance: RealTimePushNotifications;

  static getInstance(): RealTimePushNotifications {
    if (!RealTimePushNotifications.instance) {
      RealTimePushNotifications.instance = new RealTimePushNotifications();
    }
    return RealTimePushNotifications.instance;
  }

  async sendBanNotification(deviceId: string, banInfo: BanNotification): Promise<void> {
    const durationText = this.formatDuration(banInfo.duration);
    
    const message: NotificationMessage = {
      type: 'ban',
      title: '⛔ You Have Been Banned',
      body: `You have been banned for: ${banInfo.reason}`,
      requireInteraction: true,
      data: {
        banId: deviceId,
        reason: banInfo.reason,
        duration: banInfo.duration,
        username: banInfo.username,
        message: banInfo.message
      }
    };

    await this.sendNotification(deviceId, message);
  }

  async sendAutoBanNotification(deviceId: string, reason: string, duration: number, message?: string): Promise<void> {
    const messageContent: NotificationMessage = {
      type: 'auto_ban',
      title: '🤖 Auto-Ban Triggered',
      body: `Automatic ban: ${reason} for ${this.formatDuration(duration)}`,
      requireInteraction: true,
      data: {
        reason,
        duration,
        message,
        autoBan: true
      }
    };

    await this.sendNotification(deviceId, messageContent);
  }

  async sendWarningNotification(deviceId: string, warning: string): Promise<void> {
    const messageContent: NotificationMessage = {
      type: 'warning',
      title: '⚠️ Warning',
      body: warning,
      requireInteraction: false,
      data: {
        warning: true,
        message: warning
      }
    };

    await this.sendNotification(deviceId, messageContent);
  }

  async sendAdminMessageNotification(deviceId: string, title: string, message: string): Promise<void> {
    const messageContent: NotificationMessage = {
      type: 'admin_message',
      title: `📢 ${title}`,
      body: message,
      requireInteraction: false,
      data: {
        adminMessage: true,
        title,
        message
      }
    };

    await this.sendNotification(deviceId, messageContent);
  }

  private async sendNotification(deviceId: string, message: NotificationMessage): Promise<void> {
    try {
      // Check if user has push notifications enabled
      const settings = await db.query("notification_settings", { 
        device_id: `eq.${deviceId}`,
        push_enabled: `eq.1`
      });

      if (settings.length === 0) {
        console.log("User has push notifications disabled");
        return;
      }

      // Send local notification (will show as desktop notification if permission granted)
      await PushNotificationManager.sendLocalNotification(
        message.title,
        message.body,
        {
          tag: message.type,
          requireInteraction: message.requireInteraction,
          data: message.data
        }
      );

      // Add notification to database for in-app display
      await db.insert("notifications", {
        type: message.type,
        message: message.body,
        recipient_device_id: deviceId,
        is_read: 0,
        created_by_admin: 1
      });

      console.log(`Notification sent to device ${deviceId}:`, message.title);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }

  async sendGlobalNotification(title: string, message: string): Promise<void> {
    try {
      // Get all active users
      const activeUsers = await db.query("users", { 
        last_active: `gte.${Date.now() - 86400000}` // Active in last 24 hours
      });

      for (const user of activeUsers) {
        await this.sendAdminMessageNotification(user.device_id, title, message);
      }

      console.log(`Global notification sent to ${activeUsers.length} users`);
    } catch (error) {
      console.error("Error sending global notification:", error);
    }
  }

  private formatDuration(seconds: number): string {
    if (seconds === 0) {
      return "Permanent";
    }

    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return days === 1 ? "1 day" : `${days} days`;
    }
    
    if (hours > 0) {
      return hours === 1 ? "1 hour" : `${hours} hours`;
    }
    
    return "less than 1 hour";
  }

  async initializeRealTimeNotifications(): Promise<void> {
    // Initialize push notification system
    await PushNotificationManager.initialize();

    // Save device settings
    const deviceId = getDeviceId();
    try {
      const existing = await db.query("notification_settings", { device_id: `eq.${deviceId}` });
      
      if (existing.length === 0) {
        await db.insert("notification_settings", {
          device_id: deviceId,
          push_enabled: 1,
          last_subscribed: Date.now()
        });
      }
    } catch (error) {
      console.error("Error initializing notification settings:", error);
    }
  }
}

export default RealTimePushNotifications.getInstance();