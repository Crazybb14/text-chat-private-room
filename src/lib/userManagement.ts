import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "./deviceId";
import PushNotificationManager from "./pushNotifications";

interface User {
  _row_id: number;
  username: string;
  device_id: string;
  ip_address: string | null;
  first_seen: number;
  last_active: number;
}

export class UserManager {
  private static currentUsername: string | null = null;
  private static deviceId: string = getDeviceId();

  static async setUsername(username: string, forceUpdate: boolean = false): Promise<boolean> {
    try {
      const trimmedUsername = username.trim().toLowerCase();
      
      if (trimmedUsername.length < 2) {
        return false;
      }

      // Check if username is already taken by another device
      if (!forceUpdate) {
        const existingUser = await db.query("users", { username: `eq.${trimmedUsername}` });
        if (existingUser.length > 0 && existingUser[0].device_id !== this.deviceId) {
          return false; // Username taken by another user
        }
      }

      // Get user's IP address (in real implementation, this would come from server)
      const ipAddress = await this.getClientIP();

      // Check if user already exists on this device
      const deviceUsers = await db.query("users", { device_id: `eq.${this.deviceId}` });
      const now = Date.now();

      if (deviceUsers.length > 0) {
        // Update existing user
        await db.update("users", { device_id: `eq.${this.deviceId}` }, {
          username: trimmedUsername,
          ip_address: ipAddress,
          last_active: now,
        });
        this.currentUsername = trimmedUsername;
      } else {
        // Create new user
        await db.insert("users", {
          username: trimmedUsername,
          device_id: this.deviceId,
          ip_address: ipAddress,
          first_seen: now,
          last_active: now,
        });
        this.currentUsername = trimmedUsername;
      }

      // Initialize push notifications for this user
      await PushNotificationManager.initialize();

      return true;
    } catch (error) {
      console.error("Error setting username:", error);
      return false;
    }
  }

  static async getUsername(): Promise<string | null> {
    if (this.currentUsername) {
      return this.currentUsername;
    }

    try {
      const deviceUsers = await db.query("users", { device_id: `eq.${this.deviceId}` });
      if (deviceUsers.length > 0) {
        this.currentUsername = deviceUsers[0].username;
        
        // Update last active time
        await db.update("users", { device_id: `eq.${this.deviceId}` }, {
          last_active: Date.now(),
        });
        
        return this.currentUsername;
      }
    } catch (error) {
      console.error("Error getting username:", error);
    }

    return null;
  }

  static async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const trimmedUsername = username.trim().toLowerCase();
      const existingUser = await db.query("users", { username: `eq.${trimmedUsername}` });
      return existingUser.length === 0;
    } catch (error) {
      console.error("Error checking username availability:", error);
      return false;
    }
  }

  static async getClientIP(): Promise<string> {
    // In production, this would come from the backend
    // For now, we'll use a mock IP or try to get it from headers
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || '127.0.0.1';
    } catch (error) {
      // Fallback for development
      return '127.0.0.1';
    }
  }

  static async getAllUsers(): Promise<User[]> {
    try {
      return await db.query("users", { order: "last_active.desc" });
    } catch (error) {
      console.error("Error getting all users:", error);
      return [];
    }
  }

  static async clearUsername(): Promise<void> {
    try {
      await db.delete("users", { device_id: `eq.${this.deviceId}` });
      this.currentUsername = null;
    } catch (error) {
      console.error("Error clearing username:", error);
    }
  }

  static async forceUsername(username: string): Promise<boolean> {
    return await this.setUsername(username, true);
  }
}

export default UserManager;