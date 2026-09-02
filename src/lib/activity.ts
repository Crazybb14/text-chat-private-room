import db from "@/lib/shared/kliv-database.js";

/**
 * "When is everyone here?" — buckets real chat activity (room messages +
 * direct messages) into hours of the day so the lobby can chart the busiest
 * times. Everything comes from live data; nothing is simulated.
 */

export interface ActivityPoint {
  hour: number; // 0–23, local time
  label: string; // "8 PM"
  people: number; // distinct chatters in that hour
  messages: number; // total messages in that hour
}

export interface ActivitySummary {
  points: ActivityPoint[];
  peak: ActivityPoint | null;
  totalMessages: number;
  windowDays: number;
}

export interface ActivityRow {
  sender: string;
  at: number;
}

/** Table timestamps are seconds; ms also tolerated. */
export function toMs(ts: number): number {
  const n = Number(ts) || 0;
  return n > 1e12 ? n : n * 1000;
}

export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const ampm = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * Pure bucketing: given chat rows and a look-back window, returns one point
 * per hour of the day with the number of distinct people who chatted.
 */
export function bucketActivityByHour(rows: ActivityRow[], days: number, now: number): ActivitySummary {
  const cutoff = now - Math.max(1, days) * 86_400_000;
  const slots = new Map<number, { people: Set<string>; messages: number }>();
  for (let h = 0; h < 24; h++) slots.set(h, { people: new Set(), messages: 0 });

  let total = 0;
  for (const row of rows) {
    const at = toMs(row.at);
    if (at < cutoff) continue;
    const hour = new Date(at).getHours();
    const slot = slots.get(hour);
    if (!slot) continue;
    slot.messages += 1;
    total += 1;
    const sender = row.sender?.trim().toLowerCase();
    if (sender) slot.people.add(sender);
  }

  const points = Array.from(slots.entries())
    .map(([hour, v]) => ({ hour, label: hourLabel(hour), people: v.people.size, messages: v.messages }))
    .sort((a, b) => a.hour - b.hour);

  let peak: ActivityPoint | null = null;
  for (const p of points) {
    if (p.people === 0 && p.messages === 0) continue;
    if (
      !peak ||
      p.people > peak.people ||
      (p.people === peak.people && p.messages > peak.messages)
    ) {
      peak = p;
    }
  }

  return { points, peak, totalMessages: total, windowDays: days };
}

interface RoomMsgRow {
  sender_name: string | null;
  _created_at: number | string;
}

interface DmRow {
  sender_username: string | null;
  _created_at: number | string;
}

/** Loads real chat history and buckets it by hour for the lobby chart. */
export async function loadActivitySummary(days = 7): Promise<ActivitySummary> {
  const [roomMessages, dms] = await Promise.all([
    db.query<RoomMsgRow>("messages", { order: "_created_at.desc", limit: "800" }),
    db.query<DmRow>("direct_messages", { order: "_created_at.desc", limit: "800" }),
  ]);

  const rows: ActivityRow[] = [
    ...roomMessages.map((m) => ({ sender: m.sender_name ?? "", at: Number(m._created_at) })),
    ...dms.map((m) => ({ sender: m.sender_username ?? "", at: Number(m._created_at) })),
  ];
  return bucketActivityByHour(rows, days, Date.now());
}
