import type { DirectMessageRow } from "./friends";

export interface DmConversation {
  /** Stable key for the pair, e.g. "alice::bob". */
  key: string;
  a: string;
  b: string;
  /** All messages between the two, oldest first. */
  messages: DirectMessageRow[];
  /** Timestamp of the newest message. */
  lastAt: number;
  /** How many messages the conversation holds. */
  count: number;
}

/** One stable key per pair, no matter who sent what. */
export function pairKeyFor(a: string, b: string): string {
  return [a, b].sort().join("::");
}

/**
 * Turns a flat list of direct messages into one "folder" per conversation,
 * newest conversation first. Pure function so it can be unit tested.
 */
export function groupDirectMessages(rows: DirectMessageRow[]): DmConversation[] {
  const byKey = new Map<string, DirectMessageRow[]>();
  for (const row of rows) {
    const sender = row.sender_username ?? "";
    const recipient = row.recipient_username ?? "";
    if (!sender || !recipient) continue;
    const key = pairKeyFor(sender, recipient);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(row);
    else byKey.set(key, [row]);
  }

  const conversations: DmConversation[] = [];
  for (const [key, messages] of byKey) {
    const sorted = [...messages].sort((x, y) => (x._created_at || 0) - (y._created_at || 0));
    const [a, b] = key.split("::");
    conversations.push({
      key,
      a,
      b,
      messages: sorted,
      lastAt: sorted.length > 0 ? sorted[sorted.length - 1]._created_at || 0 : 0,
      count: sorted.length,
    });
  }

  return conversations.sort((x, y) => y.lastAt - x.lastAt);
}

/** Conversations that mention a username in the text, for the admin search box. */
export function filterConversations(conversations: DmConversation[], query: string): DmConversation[] {
  const q = query.trim().toLowerCase();
  if (!q) return conversations;
  return conversations.filter(
    (c) => c.a.includes(q) || c.b.includes(q) || c.messages.some((m) => (m.content || "").toLowerCase().includes(q))
  );
}
