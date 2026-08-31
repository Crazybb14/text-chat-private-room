import db from "@/lib/shared/kliv-database.js";

export interface FriendshipRow {
  _row_id: number;
  user_id: string;
  friend_id: string;
  status: string;
  requested_by: string;
  [key: string]: unknown;
}

export interface DirectMessageRow {
  _row_id: number;
  sender_username: string;
  recipient_username: string;
  content: string;
  is_read: number;
  _created_at: number;
  [key: string]: unknown;
}

export interface ProfileRow {
  _row_id: number;
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  status: string;
  last_seen: number;
  [key: string]: unknown;
}

export type Relationship = "none" | "friends" | "outgoing" | "incoming";

/** Given a friendship row, returns the username of the other person. */
export function friendUsernameFromRow(row: FriendshipRow, me: string): string {
  return row.user_id === me ? row.friend_id : row.user_id;
}

export function pairMatches(row: FriendshipRow, a: string, b: string): boolean {
  return (row.user_id === a && row.friend_id === b) || (row.user_id === b && row.friend_id === a);
}

export async function getFriends(me: string): Promise<string[]> {
  const rows = await db.query<FriendshipRow>("friendships", { status: "eq.accepted" });
  return rows.filter((r) => r.user_id === me || r.friend_id === me).map((r) => friendUsernameFromRow(r, me));
}

export async function getIncomingRequests(me: string): Promise<FriendshipRow[]> {
  const rows = await db.query<FriendshipRow>("friendships", {
    friend_id: `eq.${me}`,
    status: "eq.pending",
  });
  return rows.filter((r) => r.requested_by !== me);
}

export async function getOutgoingRequests(me: string): Promise<FriendshipRow[]> {
  return db.query<FriendshipRow>("friendships", {
    user_id: `eq.${me}`,
    status: "eq.pending",
  });
}

export async function sendFriendRequest(
  me: string,
  them: string
): Promise<{ ok: boolean; message: string }> {
  if (me === them) {
    return { ok: false, message: "You can't add yourself as a friend." };
  }

  const target = await db.query<{ username: string }>("users", { username: `eq.${them}` });
  if (target.length === 0) {
    return { ok: false, message: `No user named "${them}" was found.` };
  }

  const friends = await getFriends(me);
  if (friends.includes(them)) {
    return { ok: false, message: `You and ${them} are already friends.` };
  }

  const pending = await db.query<FriendshipRow>("friendships", { status: "eq.pending" });
  const relevant = pending.filter((r) => pairMatches(r, me, them));
  if (relevant.length > 0) {
    if (relevant[0].requested_by === me) {
      return { ok: false, message: `You already sent a request to ${them}.` };
    }
    return { ok: false, message: `${them} already sent you a request — check your notifications.` };
  }

  await db.insert("friendships", {
    user_id: me,
    friend_id: them,
    status: "pending",
    requested_by: me,
  });
  return { ok: true, message: `Friend request sent to ${them}.` };
}

export async function acceptFriendRequest(rowId: number): Promise<void> {
  await db.update("friendships", { _row_id: `eq.${rowId}` }, { status: "accepted" });
}

export async function deleteFriendship(rowId: number): Promise<void> {
  await db.deleteOne("friendships", { _row_id: `eq.${rowId}` });
}

export async function removeFriend(me: string, them: string): Promise<void> {
  const rows = await db.query<FriendshipRow>("friendships", { status: "eq.accepted" });
  const rel = rows.find((r) => pairMatches(r, me, them));
  if (rel) {
    await db.deleteOne("friendships", { _row_id: `eq.${rel._row_id}` });
  }
}

export async function getRelationship(me: string, them: string): Promise<Relationship> {
  if (me === them) return "none";

  const pending = await db.query<FriendshipRow>("friendships", { status: "eq.pending" });
  const p = pending.find((r) => pairMatches(r, me, them));
  if (p) {
    return p.requested_by === me ? "outgoing" : "incoming";
  }

  const friends = await getFriends(me);
  return friends.includes(them) ? "friends" : "none";
}

export async function sendDirectMessage(from: string, to: string, content: string): Promise<void> {
  await db.insert("direct_messages", {
    sender_username: from,
    recipient_username: to,
    content,
    is_read: 0,
  });
}

export async function getDirectMessages(me: string, them: string): Promise<DirectMessageRow[]> {
  const sent = await db.query<DirectMessageRow>("direct_messages", {
    sender_username: `eq.${me}`,
    recipient_username: `eq.${them}`,
    order: "_created_at.asc",
  });
  const received = await db.query<DirectMessageRow>("direct_messages", {
    sender_username: `eq.${them}`,
    recipient_username: `eq.${me}`,
    order: "_created_at.asc",
  });
  return [...sent, ...received].sort((a, b) => (a._created_at || 0) - (b._created_at || 0));
}

export async function markDirectMessagesRead(me: string, them: string): Promise<void> {
  await db.update(
    "direct_messages",
    { recipient_username: `eq.${me}`, sender_username: `eq.${them}`, is_read: "eq.0" },
    { is_read: 1 }
  );
}

export async function getUnreadDirectMessages(me: string): Promise<DirectMessageRow[]> {
  return db.query<DirectMessageRow>("direct_messages", {
    recipient_username: `eq.${me}`,
    is_read: "eq.0",
    order: "_created_at.desc",
  });
}

export async function getProfile(username: string): Promise<ProfileRow | null> {
  const rows = await db.query<ProfileRow>("user_profiles", { username: `eq.${username}` });
  return rows[0] ?? null;
}

export interface ProfileFields {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  status?: string;
}

export async function saveProfile(username: string, fields: ProfileFields): Promise<void> {
  const existing = await getProfile(username);
  if (existing) {
    const data: Record<string, string> = {};
    if (fields.display_name !== undefined) data.display_name = fields.display_name;
    if (fields.bio !== undefined) data.bio = fields.bio;
    if (fields.avatar_url !== undefined) data.avatar_url = fields.avatar_url;
    if (fields.status !== undefined) data.status = fields.status;
    await db.update("user_profiles", { _row_id: `eq.${existing._row_id}` }, data);
  } else {
    await db.insert("user_profiles", {
      user_id: username,
      username,
      display_name: fields.display_name ?? "",
      bio: fields.bio ?? "",
      avatar_url: fields.avatar_url ?? "",
      status: fields.status ?? "offline",
      last_seen: Date.now(),
    });
  }
}

export async function touchLastSeen(username: string): Promise<void> {
  const existing = await getProfile(username);
  if (existing) {
    await db.update("user_profiles", { _row_id: `eq.${existing._row_id}` }, { last_seen: Date.now() });
  }
}
