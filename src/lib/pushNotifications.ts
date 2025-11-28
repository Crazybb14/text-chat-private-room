import { getDeviceId } from "./deviceId";

interface SubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface NotificationSettings {
  device_id: string;
  push_enabled: boolean;
  notification_token: string | null;
  last_subscribed: number;
}

interface NotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  [key: string]: unknown;
}

// Mock VAPID key for browser push notifications
const VAPID_PUBLIC_KEY = 'BMg_tGqL2sKj7Gp-4r8qZJ7kLpXmYnQ5tR9vS2wK8fHqP3nJ6bV4xD7mYc1zWa9xK5LpQ2rB3mN1jX7zC8wV4pY6tR9bF2qG3hK5jL8mN4pQ7xS2wV1zM5cB8kF6pL9qR3nJ7hK';

export class PushNotificationManager {
  private static instance: PushNotificationManager;
  private subscription: PushSubscription | null = null;

  static getInstance(): PushNotificationManager {
    if (!PushNotificationManager.instance) {
      PushNotificationManager.instance = new PushNotificationManager();
    }
    return PushNotificationManager.instance;
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  async subscribeToPush(): Promise<PushSubscription | null> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        return null;
      }

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push messaging is not supported');
        // Fallback to in-app notifications
        await this.saveNotificationSettings(false);
        return null;
      }

      const registration = await navigator.serviceWorker.ready;
      
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      this.subscription = subscription;
      
      // Save to database
      await this.saveNotificationSettings(true, JSON.stringify(subscription));
      
      return subscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }

  private async saveNotificationSettings(enabled: boolean, token?: string) {
    try {
      // This would save to your database
      console.log('Saving notification settings:', { enabled, token });
      
      // Show permission notification
      this.showPermissionNotification(enabled);
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  }

  private showPermissionNotification(enabled: boolean) {
    if (enabled) {
      new Notification('Chat Notifications Enabled 🔔', {
        body: 'You will now receive ban notices and admin messages',
        icon: '/favicon.ico',
        tag: 'permission-granted'
      });
    }
  }

  async sendLocalNotification(title: string, body: string, options?: NotificationOptions) {
    const hasPermission = await this.requestPermission();
    
    if (hasPermission && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'chat-notification',
        requireInteraction: true,
        ...options
      });
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async initialize() {
    // Create a dummy service worker registration if not available
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('ServiceWorker registered:', registration);
      } catch (error) {
        console.log('ServiceWorker registration failed, using fallback');
      }
    }

    // Request permission on first load
    await this.subscribeToPush();
  }
}

export default PushNotificationManager.getInstance();