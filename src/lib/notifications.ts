import db from "@/lib/shared/kliv-database.js";

export interface SiteNotification {
  _row_id: number;
  type: string;
  title: string;
  message: string;
  recipient_username: string | null;
  link: string | null;
  is_read: number;
  created_by_admin: number;
  _created_at: number;
  [key: string]: unknown;
}

/** A user's newest notifications, newest first. */
export async function getNotificationsFor(username: string): Promise<SiteNotification[]> {
  return db.query<SiteNotification>("notifications", {
    recipient_username: `eq.${username}`,
    order: "_created_at.desc",
    limit: "50",
  });
}

export async function getUnreadNotifications(username: string): Promise<SiteNotification[]> {
  return db.query<SiteNotification>("notifications", {
    recipient_username: `eq.${username}`,
    is_read: "eq.0",
    order: "_created_at.desc",
  });
}

export async function markNotificationRead(rowId: number): Promise<void> {
  await db.updateOne("notifications", { _row_id: `eq.${rowId}` }, { is_read: 1 });
}

export async function markAllNotificationsRead(username: string): Promise<void> {
  await db.update(
    "notifications",
    { recipient_username: `eq.${username}`, is_read: "eq.0" },
    { is_read: 1 }
  );
}

/**
 * Sends a notification to every account on the site. Returns how many people
 * received it.
 */
export async function sendAnnouncement(title: string, message: string): Promise<number> {
  const cleanTitle = title.trim().slice(0, 120);
  const cleanMessage = message.trim().slice(0, 1000);
  if (!cleanTitle || !cleanMessage) throw new Error("A title and a message are required.");

  const profiles = await db.query<{ username: string }>("user_profiles", { order: "_row_id.asc" });
  const usernames = [...new Set(profiles.map((p) => p.username).filter((u) => u && u.trim().length > 0))];
  if (usernames.length === 0) return 0;

  // The database writes one row per recipient; keep batches reasonable.
  const BATCH = 100;
  for (let i = 0; i < usernames.length; i += BATCH) {
    await db.insert(
      "notifications",
      usernames.slice(i, i + BATCH).map((username) => ({
        type: "announcement",
        title: cleanTitle,
        message: cleanMessage,
        recipient_username: username,
        link: null,
        is_read: 0,
        created_by_admin: 1,
      }))
    );
  }
  return usernames.length;
}

/** The most recent broadcasts, for the admin panel's history list. */
export async function recentAnnouncements(): Promise<SiteNotification[]> {
  return db.query<SiteNotification>("notifications", {
    type: "eq.announcement",
    order: "_created_at.desc",
    limit: "15",
  });
}

/** Fires a real browser notification when the visitor allowed them. */
export function showBrowserNotification(title: string, body: string): void {
  try {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    new Notification(title || "New notification", { body: body.slice(0, 180) });
  } catch {
    // best-effort — some environments block constructor use
  }
}

/** Asks the browser for notification permission. Returns the result. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
