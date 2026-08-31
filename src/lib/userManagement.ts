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
      status: "online",
      last_seen: Date.now(),
    });

    try {
      // The admin-visible record of who signed up is written server-side.
      await functions.post("record-signup", { username });
    } catch (error) {
      console.error("Failed to record account credentials:", error);
    }
  }

  /**
   * Best-effort log of the current visitor's IP address. Recorded once per
   * browser session, right after signing in or creating an account.
   */
  static async logLoginIp(username: string | null): Promise<void> {
    try {
      if (sessionStorage.getItem("ip_logged_session") === "1") return;
      const session = await this.getSession();
      if (!session) return;
      // The server function records the IP itself; browsers can't write that table.
      await functions.get("get-ip", { username: username ?? session.username ?? "" });
      sessionStorage.setItem("ip_logged_session", "1");
    } catch (error) {
      console.error("IP logging skipped:", error);
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
