import type { DirectMessageRow } from "./friends";

export interface StatMessage {
  room_id: number;
  sender_name: string | null;
  _created_at: number;
  [key: string]: unknown;
}

/** Message count per sender, busiest first. */
export function topChatters(
  messages: Pick<StatMessage, "sender_name">[],
  limit = 10,
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const message of messages) {
    const name = (message.sender_name ?? "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** Message count per room, busiest first. */
export function roomMessageCounts(
  rooms: { _row_id: number; name: string }[],
  messages: Pick<StatMessage, "room_id">[],
): { id: number; name: string; count: number }[] {
  const counts = new Map<number, number>();
  for (const message of messages) {
    const id = Number(message.room_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return rooms
    .map((room) => ({ id: room._row_id, name: room.name, count: counts.get(room._row_id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export interface SignupBucket {
  label: string;
  count: number;
}

/** New accounts per day over the last `days` days, oldest first. */
export function signupTrend(
  profiles: { _created_at: number }[],
  days = 14,
  nowMs = Date.now(),
): SignupBucket[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const buckets: SignupBucket[] = [];
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  const start = today.getTime() - (days - 1) * dayMs;
  for (let i = 0; i < days; i += 1) {
    buckets.push({
      label: new Date(start + i * dayMs).toLocaleDateString([], { month: "short", day: "numeric" }),
      count: 0,
    });
  }
  for (const profile of profiles) {
    const created = Number(profile._created_at) * (Number(profile._created_at) > 1e11 ? 1 : 1000);
    if (!created || created < start) continue;
    const index = Math.floor((created - start) / dayMs);
    if (index >= 0 && index < buckets.length) buckets[index].count += 1;
  }
  return buckets;
}

export interface IpGroup {
  ip: string;
  usernames: string[];
  count: number;
}

/** Groups sign-in records by IP. IPs shared by several accounts sort first. */
export function ipGroups(rows: { username: string; ip: string }[]): IpGroup[] {
  const byIp = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const ip = (row.ip ?? "").trim();
    const username = (row.username ?? "").trim();
    if (!ip || !username) continue;
    let users = byIp.get(ip);
    if (!users) {
      users = new Map();
      byIp.set(ip, users);
    }
    users.set(username, (users.get(username) ?? 0) + 1);
  }
  return [...byIp.entries()]
    .map(([ip, users]) => ({
      ip,
      usernames: [...users.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name),
      count: [...users.values()].reduce((sum, n) => sum + n, 0),
    }))
    .sort((a, b) => b.usernames.length - a.usernames.length || b.count - a.count);
}

/** Per-broadcast delivery vs read counts, most sent first. */
export function announcementStats(
  rows: { title: string; is_read: number }[],
): { title: string; sent: number; read: number }[] {
  const byTitle = new Map<string, { sent: number; read: number }>();
  for (const row of rows) {
    const title = (row.title ?? "").trim() || "(untitled)";
    const entry = byTitle.get(title) ?? { sent: 0, read: 0 };
    entry.sent += 1;
    if (Number(row.is_read) === 1) entry.read += 1;
    byTitle.set(title, entry);
  }
  return [...byTitle.entries()]
    .map(([title, entry]) => ({ title, ...entry }))
    .sort((a, b) => b.sent - a.sent);
}

/** DM conversation sizes, biggest pairs first. */
export function dmPairStats(
  rows: Pick<DirectMessageRow, "sender_username" | "recipient_username">[],
  limit = 15,
): { pair: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const a = (row.sender_username ?? "").trim();
    const b = (row.recipient_username ?? "").trim();
    if (!a || !b) continue;
    const pair = [a, b].sort().join(" ⇄ ");
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

/** Turns rows into CSV text. Excluded keys are dropped (e.g. passwords). */
export function toCsv(
  rows: Record<string, unknown>[],
  columns: string[],
  headers?: Record<string, string>,
): string {
  const head = columns.map((column) => csvCell(headers?.[column] ?? column)).join(",");
  const body = rows
    .map((row) => columns.map((column) => csvCell(row[column])).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

/** Triggers a CSV file download in the browser. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
