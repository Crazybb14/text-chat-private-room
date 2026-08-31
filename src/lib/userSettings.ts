import { useCallback, useEffect, useState } from "react";
import db from "@/lib/shared/kliv-database.js";

export interface UserPrefs {
  /** Message text size in pixels (12–20). */
  font_size: number;
  /** Tighter message spacing. */
  compact: boolean;
  /** Soft chime when a new message arrives. */
  sound: boolean;
  /** Show this user as online to others. */
  show_online: boolean;
  /** Enter sends the message (off = Enter adds a new line). */
  enter_to_send: boolean;
  /** Timestamps next to messages. */
  timestamps: boolean;
}

export const DEFAULT_USER_PREFS: UserPrefs = {
  font_size: 15,
  compact: false,
  sound: true,
  show_online: true,
  enter_to_send: true,
  timestamps: true,
};

interface SettingsRow {
  _row_id: number;
  username: string;
  settings: string;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Safely merges whatever is stored into a complete, clamped set of prefs. */
export function coerceUserPrefs(raw: string | null | undefined): UserPrefs {
  const out: UserPrefs = { ...DEFAULT_USER_PREFS };
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  if (!isRecord(parsed)) return out;
  if (typeof parsed.font_size === "number" && Number.isFinite(parsed.font_size)) {
    out.font_size = Math.min(20, Math.max(12, Math.round(parsed.font_size)));
  }
  out.compact = parsed.compact === true;
  out.sound = parsed.sound !== false; // default on
  out.show_online = parsed.show_online !== false;
  out.enter_to_send = parsed.enter_to_send !== false;
  out.timestamps = parsed.timestamps !== false;
  return out;
}

export async function loadUserPrefs(username: string): Promise<UserPrefs> {
  try {
    const rows = await db.query<SettingsRow>("user_settings", { username: `eq.${username}` });
    return coerceUserPrefs(rows[0]?.settings);
  } catch {
    return { ...DEFAULT_USER_PREFS };
  }
}

export async function saveUserPrefs(username: string, prefs: UserPrefs): Promise<void> {
  const payload = { settings: JSON.stringify(prefs) };
  const rows = await db.query<{ _row_id: number }>("user_settings", { username: `eq.${username}` });
  if (rows.length > 0) {
    await db.updateOne("user_settings", { _row_id: `eq.${rows[0]._row_id}` }, payload);
  } else {
    await db.insertOne("user_settings", { username, ...payload });
  }
}

/**
 * Loads a user's saved preferences and saves any change back automatically.
 */
export function useUserPrefs(username: string | null): {
  prefs: UserPrefs;
  loaded: boolean;
  update: (partial: Partial<UserPrefs>) => void;
} {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_USER_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    if (!username) {
      setPrefs(DEFAULT_USER_PREFS);
      setLoaded(true);
      return;
    }
    loadUserPrefs(username).then((next) => {
      if (cancelled) return;
      setPrefs(next);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  const update = useCallback(
    (partial: Partial<UserPrefs>) => {
      setPrefs((prev) => {
        const next = coerceUserPrefs(JSON.stringify({ ...prev, ...partial }));
        if (username) void saveUserPrefs(username, next).catch(() => undefined);
        return next;
      });
    },
    [username]
  );

  return { prefs, loaded, update };
}
