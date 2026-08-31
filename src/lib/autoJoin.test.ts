import { describe, it, expect } from "vitest";
import {
  coerceAutoJoinList,
  coerceAutoJoinMode,
  friendsOf,
  pickAutoJoinFriends,
  picksAutoJoin,
  type AutoJoinPrefs,
  type FriendshipEdge,
} from "./autoJoin";

const edge = (a: string, b: string, status = "accepted"): FriendshipEdge =>
  ({ user_id: a, friend_id: b, status, requested_by: a }) as FriendshipEdge;

// @kliv-spec-derived — "friends can turn on auto-join for group chats or voice chats, for all friends or specific people"
describe("picksAutoJoin", () => {
  it("joins any friend's chat when mode is friends", () => {
    const prefs: AutoJoinPrefs = { auto_join_group: "friends" };
    expect(picksAutoJoin(prefs, "creator", "group")).toBe(true);
  });

  it("specific mode only joins creators on the list", () => {
    const prefs: AutoJoinPrefs = {
      auto_join_group: "specific",
      auto_join_group_list: ["creator", "someone-else"],
    };
    expect(picksAutoJoin(prefs, "creator", "group")).toBe(true);
    expect(picksAutoJoin(prefs, "stranger", "group")).toBe(false);
  });

  it("off (or garbage) never auto-joins", () => {
    expect(picksAutoJoin({ auto_join_group: "off" }, "creator", "group")).toBe(false);
    expect(picksAutoJoin({ auto_join_group: 42 }, "creator", "group")).toBe(false);
    expect(picksAutoJoin({}, "creator", "group")).toBe(false);
  });

  it("voice picks are independent of group picks", () => {
    const prefs: AutoJoinPrefs = { auto_join_group: "friends", auto_join_voice: "off" };
    expect(picksAutoJoin(prefs, "creator", "group")).toBe(true);
    expect(picksAutoJoin(prefs, "creator", "voice")).toBe(false);
  });
});

describe("pickAutoJoinFriends", () => {
  it("only accepts friends of the creator with the preference on", () => {
    const edges = [edge("creator", "friendA"), edge("creator", "friendB"), edge("x", "y")];
    const prefs: Record<string, AutoJoinPrefs> = {
      friendA: { auto_join_group: "friends" },
      friendB: { auto_join_group: "off" },
      stranger: { auto_join_group: "friends" },
    };
    expect(pickAutoJoinFriends(edges, prefs, "creator", "group")).toEqual(["friendA"]);
  });

  it("ignores pending friendships", () => {
    const edges = [edge("creator", "pendingFriend", "pending")];
    const prefs: Record<string, AutoJoinPrefs> = {
      pendingFriend: { auto_join_group: "friends" },
    };
    expect(pickAutoJoinFriends(edges, prefs, "creator", "group")).toEqual([]);
  });
});

describe("friendsOf", () => {
  it("finds friends on either side of the edge without duplicates", () => {
    const edges = [edge("me", "a"), edge("b", "me"), edge("me", "a")];
    expect(friendsOf(edges, "me")).toEqual(["a", "b"]);
  });
});

describe("coercion helpers", () => {
  it("keeps only valid modes", () => {
    expect(coerceAutoJoinMode("specific")).toBe("specific");
    expect(coerceAutoJoinMode("yes")).toBe("off");
  });

  it("lowercases and trims the specific list", () => {
    expect(coerceAutoJoinList([" Alice ", "BOB", 3, null])).toEqual(["alice", "bob"]);
    expect(coerceAutoJoinList("not-a-list")).toEqual([]);
  });
});
