import db from "@/lib/shared/kliv-database.js";

/** How a person wants to join their friends' new chats. */
export type AutoJoinMode = "off" | "friends" | "specific";

export interface FriendshipEdge {
  user_id: string;
  friend_id: string;
  status: string;
  [key: string]: unknown;
}

/** Whatever shape is stored in user_settings.settings for one user. */
export type AutoJoinPrefs = {
  auto_join_group?: unknown;
  auto_join_group_list?: unknown;
  auto_join_voice?: unknown;
  auto_join_voice_list?: unknown;
};

export function coerceAutoJoinMode(value: unknown): AutoJoinMode {
  return value === "friends" || value === "specific" ? value : "off";
}

export function coerceAutoJoinList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toLowerCase())
    .filter((v) => v.length > 0)
    .slice(0, 100);
}

/** Accepted friends of `me`, derived from the raw friendship rows. */
export function friendsOf(edges: FriendshipEdge[], me: string): string[] {
  const names: string[] = [];
  for (const edge of edges) {
    if (edge.status !== "accepted") continue;
    if (edge.user_id === me && !names.includes(edge.friend_id)) names.push(edge.friend_id);
    else if (edge.friend_id === me && !names.includes(edge.user_id)) names.push(edge.user_id);
  }
  return names;
}

/**
 * Does this person's saved preference say they want to be added to chats
 * created by `creator`? Kind picks group chats vs voice-call alerts.
 */
export function picksAutoJoin(prefs: AutoJoinPrefs, creator: string, kind: "group" | "voice"): boolean {
  const mode = coerceAutoJoinMode(kind === "group" ? prefs.auto_join_group : prefs.auto_join_voice);
  if (mode === "friends") return true;
  if (mode === "specific") {
    const list = coerceAutoJoinList(kind === "group" ? prefs.auto_join_group_list : prefs.auto_join_voice_list);
    return list.includes(creator.toLowerCase());
  }
  return false;
}

/** Friends of `creator` whose settings say yes for this kind of chat. */
export function pickAutoJoinFriends(
  edges: FriendshipEdge[],
  prefsByUsername: Record<string, AutoJoinPrefs>,
  creator: string,
  kind: "group" | "voice"
): string[] {
  return friendsOf(edges, creator).filter((friend) =>
    picksAutoJoin(prefsByUsername[friend] ?? {}, creator, kind)
  );
}

/**
 * When someone starts a voice/video call in a room, alert the friends who
 * asked for voice-call auto-join. Returns how many were notified.
 */
export async function notifyFriendsOfCall(
  caller: string,
  roomName: string,
  roomId: number
): Promise<number> {
  try {
    const edges = await db.query<FriendshipEdge>("friendships", { status: "eq.accepted" });
    const friends = friendsOf(edges, caller);
    if (friends.length === 0) return 0;

    const settingsRows = await db.query<{ username: string; settings: string }>("user_settings");
    const prefsByUsername: Record<string, AutoJoinPrefs> = {};
    for (const row of settingsRows) {
      try {
        prefsByUsername[row.username] = JSON.parse(row.settings) as AutoJoinPrefs;
      } catch {
        // ignore malformed rows
      }
    }

    const targets = pickAutoJoinFriends(edges, prefsByUsername, caller, "voice");
    if (targets.length === 0) return 0;

    await db.insert(
      "notifications",
      targets.map((friend) => ({
        type: "auto_call",
        recipient_username: friend,
        title: "Voice chat starting",
        message: `@${caller} started a voice chat in ${roomName}`,
        link: `/chat/${roomId}`,
        is_read: 0,
        created_by_admin: 0,
      }))
    );
    return targets.length;
  } catch {
    return 0; // best-effort — never block the call itself
  }
}
