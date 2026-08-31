import { useCallback, useEffect, useState } from "react";
import db from "@/lib/shared/kliv-database.js";

export type SettingType = "toggle" | "number" | "text";
export type SettingValue = boolean | number | string;

export interface SettingDef {
  key: string;
  label: string;
  group: string;
  type: SettingType;
  default: SettingValue;
  min?: number;
  max?: number;
  description: string;
}

export const SETTING_GROUPS = ["Chat & messages", "Rooms", "People", "Site"] as const;

export const SETTING_DEFS: SettingDef[] = [
  {
    key: "max_message_length",
    label: "Max message length",
    group: "Chat & messages",
    type: "number",
    default: 2000,
    min: 50,
    max: 5000,
    description: "Longest message a user can type in rooms and DMs.",
  },
  {
    key: "slow_mode_seconds",
    label: "Slow mode (seconds between messages)",
    group: "Chat & messages",
    type: "number",
    default: 0,
    min: 0,
    max: 300,
    description: "How long a user must wait between room messages. 0 = off.",
  },
  {
    key: "message_rate_per_minute",
    label: "Max messages per minute",
    group: "Chat & messages",
    type: "number",
    default: 30,
    min: 5,
    max: 120,
    description: "Users sending faster than this get a slow-down warning.",
  },
  {
    key: "typing_indicators",
    label: "Typing indicators",
    group: "Chat & messages",
    type: "toggle",
    default: true,
    description: "Shows who is typing in a room.",
  },
  {
    key: "show_online_status",
    label: "Show online status",
    group: "Chat & messages",
    type: "toggle",
    default: true,
    description: "Shows who's online in rooms and profiles.",
  },
  {
    key: "word_filter_enabled",
    label: "Word filter",
    group: "Chat & messages",
    type: "toggle",
    default: false,
    description: "Replaces banned words in room and direct messages.",
  },
  {
    key: "banned_words",
    label: "Banned words",
    group: "Chat & messages",
    type: "text",
    default: "",
    description: "Comma-separated list used when the word filter is on.",
  },
  {
    key: "auto_delete_hours",
    label: "Auto-delete room messages after (hours)",
    group: "Chat & messages",
    type: "number",
    default: 24,
    min: 1,
    max: 720,
    description:
      "A cleanup job clears public room messages older than this. Private messages are never deleted.",
  },
  {
    key: "allow_room_creation",
    label: "Let users create rooms",
    group: "Rooms",
    type: "toggle",
    default: true,
    description: "When off, only admins can create rooms.",
  },
  {
    key: "allow_private_rooms",
    label: "Allow private rooms",
    group: "Rooms",
    type: "toggle",
    default: true,
    description: "Code-protected rooms and join-by-code.",
  },
  {
    key: "max_rooms_per_user",
    label: "Max rooms per user",
    group: "Rooms",
    type: "number",
    default: 20,
    min: 1,
    max: 200,
    description: "Limits how many rooms one account can create.",
  },
  {
    key: "room_name_max_length",
    label: "Max room name length",
    group: "Rooms",
    type: "number",
    default: 60,
    min: 10,
    max: 80,
    description: "Longest name allowed for a new room.",
  },
  {
    key: "allow_direct_messages",
    label: "Allow direct messages",
    group: "People",
    type: "toggle",
    default: true,
    description: "Private one-to-one messaging between friends.",
  },
  {
    key: "allow_friend_requests",
    label: "Allow friend requests",
    group: "People",
    type: "toggle",
    default: true,
    description: "When off, users can't send new friend requests.",
  },
  {
    key: "registration_open",
    label: "Registration open",
    group: "People",
    type: "toggle",
    default: true,
    description: "When off, new signups are closed — only existing accounts can log in.",
  },
  {
    key: "site_name",
    label: "Site name",
    group: "Site",
    type: "text",
    default: "ChatRooms",
    description: "Shown in the header and on the sign-in page.",
  },
  {
    key: "welcome_message",
    label: "Welcome message",
    group: "Site",
    type: "text",
    default: "",
    description: "Shown under the greeting on the home page.",
  },
  {
    key: "announcement",
    label: "Announcement banner",
    group: "Site",
    type: "text",
    default: "",
    description: "A banner on the home page and in every room. Leave empty to hide.",
  },
  {
    key: "maintenance_message",
    label: "Extra downtime message",
    group: "Site",
    type: "text",
    default: "",
    description: "Shown on the downtime screen while the site is down.",
  },
];

export type AppSettings = Record<string, SettingValue>;

export const DEFAULT_SETTINGS: AppSettings = Object.fromEntries(
  SETTING_DEFS.map((d) => [d.key, d.default])
);

const DEFS_BY_KEY = new Map(SETTING_DEFS.map((d) => [d.key, d]));

interface SettingRow {
  _row_id: number;
  setting_key: string;
  setting_value: string;
  setting_type: string;
  [key: string]: unknown;
}

/** Clamps and coerces a stored value into the type a setting expects. */
export function coerceSetting(def: SettingDef, raw: string): SettingValue {
  if (def.type === "toggle") return raw === "true" || raw === "1";
  if (def.type === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) return def.default as number;
    const min = def.min ?? -Infinity;
    const max = def.max ?? Infinity;
    return Math.min(max, Math.max(min, Math.round(n)));
  }
  return String(raw);
}

export async function loadAppSettings(): Promise<AppSettings> {
  const merged: AppSettings = { ...DEFAULT_SETTINGS };
  try {
    const rows = await db.query<SettingRow>("admin_settings");
    for (const row of rows) {
      const def = DEFS_BY_KEY.get(row.setting_key);
      if (!def) continue;
      merged[def.key] = coerceSetting(def, String(row.setting_value ?? ""));
    }
  } catch (error) {
    console.error("Couldn't load settings, using defaults:", error);
  }
  return merged;
}

export async function persistSetting(key: string, value: SettingValue): Promise<void> {
  const def = DEFS_BY_KEY.get(key);
  if (!def) throw new Error(`Unknown setting: ${key}`);
  const rows = await db.query<{ _row_id: number }>("admin_settings", {
    setting_key: `eq.${key}`,
  });
  const payload = { setting_value: String(value), setting_type: def.type };
  if (rows.length > 0) {
    await db.updateOne("admin_settings", { _row_id: `eq.${rows[0]._row_id}` }, payload);
  } else {
    await db.insertOne("admin_settings", { setting_key: key, ...payload });
  }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      setSettings(await loadAppSettings());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const update = useCallback(async (key: string, value: SettingValue) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    await persistSetting(key, value);
  }, []);

  return { settings, loaded, update, reload };
}

/** Reads a setting as a boolean (defaults false when missing). */
export function settingBool(settings: AppSettings, key: string): boolean {
  return settings[key] === true;
}

/** Reads a setting as a number (defaults 0 when missing). */
export function settingNumber(settings: AppSettings, key: string): number {
  const n = Number(settings[key]);
  return Number.isFinite(n) ? n : 0;
}

/** Reads a setting as trimmed text. */
export function settingText(settings: AppSettings, key: string): string {
  return String(settings[key] ?? "").trim();
}

/**
 * Applies the word filter (when enabled) to an outgoing message. Uses whole
 * word matches so ordinary words containing banned fragments survive.
 */
export function filterMessage(content: string, settings: AppSettings): string {
  if (!settingBool(settings, "word_filter_enabled")) return content;
  const words = settingText(settings, "banned_words")
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2);
  let out = content;
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    out = out.replace(re, "•".repeat(Math.min(word.length, 6)));
  }
  return out;
}

/** Tracks send timestamps and enforces the per-minute message limit. */
export class RateLimiter {
  private times: number[] = [];
  constructor(private perMinute: number) {}
  allow(now = Date.now()): boolean {
    this.times = this.times.filter((t) => now - t < 60_000);
    return this.times.length < Math.max(1, this.perMinute);
  }
  record(now = Date.now()): void {
    this.times.push(now);
  }
}

/** Milliseconds remaining before the user may send again (0 = can send). */
export function slowModeRemaining(lastSentAt: number, seconds: number, now = Date.now()): number {
  if (!seconds || seconds <= 0) return 0;
  const wait = seconds * 1000 - (now - lastSentAt);
  return wait > 0 ? wait : 0;
}

/** Generates a strong, readable password for the admin reset dialog. */
export function suggestPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const cryptoObj = typeof crypto !== "undefined" ? crypto : undefined;
  const random = (max: number) => {
    if (cryptoObj?.getRandomValues) {
      const buf = new Uint32Array(1);
      cryptoObj.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  };
  for (let i = 0; i < 14; i++) out += chars.charAt(random(chars.length));
  return `${out}!7Q`;
}
