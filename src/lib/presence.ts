import { useEffect } from "react";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";

export interface PresenceRow {
  _row_id: number;
  username: string;
  device_id: string;
  room_id: number | null;
  last_seen: string;
  is_online: number;
  [key: string]: unknown;
}

/** A user counts as online if their heartbeat is fresher than this. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;
export const PRESENCE_INTERVAL_MS = 45 * 1000;

export function parseSeen(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const text = String(value).includes("T") ? String(value) : String(value).replace(" ", "T");
  const t = Date.parse(text);
  return Number.isNaN(t) ? 0 : t;
}

export function isPresenceOnline(
  row: Pick<PresenceRow, "last_seen">,
  now = Date.now()
): boolean {
  const seen = parseSeen(row.last_seen);
  return seen > 0 && now - seen < ONLINE_WINDOW_MS;
}

/** Best-effort: refresh this user's heartbeat (called every ~45s). */
export async function heartbeat(username: string, roomId: number | null = null): Promise<void> {
  try {
    const last_seen = new Date().toISOString();
    const rows = await db.query<{ _row_id: number; room_id: number | null }>("online_users", {
      username: `eq.${username}`,
    });
    if (rows.length > 0) {
      await db.updateOne(
        "online_users",
        { _row_id: `eq.${rows[0]._row_id}` },
        { last_seen, is_online: 1, room_id: roomId ?? rows[0].room_id ?? null }
      );
    } else {
      await db.insertOne("online_users", {
        username,
        device_id: getDeviceId(),
        room_id: roomId ?? null,
        last_seen,
        is_online: 1,
      });
    }
  } catch {
    // presence is best-effort
  }
}

/** Marks a user offline immediately (used on sign-out). */
export async function markOffline(username: string): Promise<void> {
  try {
    await db.update(
      "online_users",
      { username: `eq.${username}` },
      { is_online: 0, last_seen: new Date(Date.now() - ONLINE_WINDOW_MS).toISOString() }
    );
  } catch {
    // best-effort
  }
}

/** Usernames with a fresh heartbeat, site-wide. */
export async function getOnlineUsernames(now = Date.now()): Promise<string[]> {
  try {
    const rows = await db.query<PresenceRow>("online_users", { order: "last_seen.desc" });
    const names: string[] = [];
    for (const row of rows) {
      if (isPresenceOnline(row, now) && !names.includes(row.username)) names.push(row.username);
    }
    return names;
  } catch {
    return [];
  }
}

/** All presence rows for a room (callers filter by freshness). */
export async function getRoomPresence(roomId: number): Promise<PresenceRow[]> {
  try {
    return await db.query<PresenceRow>("online_users", { room_id: `eq.${roomId}` });
  } catch {
    return [];
  }
}

/**
 * Keeps this user's presence fresh while the component is mounted — works on
 * the lobby, in rooms, and on every other page.
 */
export function usePresenceHeartbeat(username: string | null, roomId: number | null = null): void {
  useEffect(() => {
    if (!username) return;
    let stopped = false;
    const beat = () => {
      if (!stopped) void heartbeat(username, roomId);
    };
    beat();
    const timer = setInterval(beat, PRESENCE_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [username, roomId]);
}
