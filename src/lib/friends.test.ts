import { describe, it, expect } from "vitest";
import { friendUsernameFromRow, pairMatches, type FriendshipRow } from "./friends";

const row = (over: Partial<FriendshipRow>): FriendshipRow => ({
  _row_id: 1,
  user_id: "alice",
  friend_id: "bob",
  status: "accepted",
  requested_by: "alice",
  ...over,
});

describe("friendUsernameFromRow", () => {
  it("returns the other person when I am the requester", () => {
    expect(friendUsernameFromRow(row({ user_id: "me", friend_id: "pal" }), "me")).toBe("pal");
  });

  it("returns the other person when I am the recipient", () => {
    expect(friendUsernameFromRow(row({ user_id: "pal", friend_id: "me" }), "me")).toBe("pal");
  });
});

describe("pairMatches", () => {
  it("matches in either direction", () => {
    expect(pairMatches(row({ user_id: "a", friend_id: "b" }), "a", "b")).toBe(true);
    expect(pairMatches(row({ user_id: "a", friend_id: "b" }), "b", "a")).toBe(true);
  });

  it("does not match unrelated pairs", () => {
    expect(pairMatches(row({ user_id: "a", friend_id: "b" }), "a", "c")).toBe(false);
    expect(pairMatches(row({ user_id: "a", friend_id: "b" }), "c", "d")).toBe(false);
  });
});
