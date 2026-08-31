import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "./deviceId";

export interface UserRow {
  _row_id: number;
  username: string;
  device_id: string;
  ip_address: string | null;
  first_seen: number;
  last_active: number;
  [key: string]: unknown;
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

      if (!forceUpdate) {
        const existingUser = await db.query<UserRow>("users", { username: `eq.${trimmedUsername}` });
        if (existingUser.length > 0 && existingUser[0].device_id !== this.deviceId) {
          return false;
        }
      }

      const deviceUsers = await db.query<UserRow>("users", { device_id: `eq.${this.deviceId}` });
      const now = Date.now();

      if (deviceUsers.length > 0) {
        await db.update(
          "users",
          { device_id: `eq.${this.deviceId}` },
          { username: trimmedUsername, last_active: now }
        );
        this.currentUsername = trimmedUsername;
      } else {
        await db.insert("users", {
          username: trimmedUsername,
          device_id: this.deviceId,
          ip_address: null,
          first_seen: now,
          last_active: now,
        });
        this.currentUsername = trimmedUsername;
      }

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
      const deviceUsers = await db.query<UserRow>("users", { device_id: `eq.${this.deviceId}` });
      if (deviceUsers.length > 0) {
        this.currentUsername = deviceUsers[0].username;
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
      const existingUser = await db.query<UserRow>("users", { username: `eq.${trimmedUsername}` });
      return existingUser.length === 0;
    } catch (error) {
      console.error("Error checking username availability:", error);
      return false;
    }
  }

  static async getAllUsers(): Promise<UserRow[]> {
    try {
      return await db.query<UserRow>("users", { order: "last_active.desc" });
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
}

export default UserManager;
