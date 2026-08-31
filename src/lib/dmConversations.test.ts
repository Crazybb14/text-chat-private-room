import { describe, it, expect } from "vitest";
import { filterConversations, groupDirectMessages, pairKeyFor } from "./dmConversations";
import type { DirectMessageRow } from "./friends";

const msg = (
  id: number,
  from: string,
  to: string,
  content: string,
  at: number
): DirectMessageRow =>
  ({
    _row_id: id,
    sender_username: from,
    recipient_username: to,
    content,
    is_read: 0,
    _created_at: at,
  }) as DirectMessageRow;

// @kliv-spec-derived — the owner asked to "see every DM, organized into folders by conversation"
describe("groupDirectMessages", () => {
  it("groups both directions of a pair into one conversation", () => {
    const rows = [
      msg(1, "alice", "bob", "hi", 100),
      msg(2, "bob", "alice", "hey", 200),
      msg(3, "carol", "dave", "separate", 300),
    ];
    const conversations = groupDirectMessages(rows);
    expect(conversations).toHaveLength(2);
    const aliceBob = conversations.find((c) => c.a === "alice" && c.b === "bob");
    expect(aliceBob?.count).toBe(2);
  });

  it("sorts conversations newest-first and their messages oldest-first", () => {
    const rows = [
      msg(1, "alice", "bob", "first", 100),
      msg(2, "carol", "dave", "later pair", 500),
      msg(3, "bob", "alice", "second", 200),
    ];
    const conversations = groupDirectMessages(rows);
    expect(conversations[0].a).toBe("carol");
    expect(conversations[1].messages.map((m) => m.content)).toEqual(["first", "second"]);
  });

  it("uses one stable key no matter who sent what", () => {
    expect(pairKeyFor("alice", "bob")).toBe(pairKeyFor("bob", "alice"));
  });
});

describe("filterConversations", () => {
  it("matches usernames and message text, case-insensitively", () => {
    const conversations = groupDirectMessages([
      msg(1, "alice", "bob", "homework plans", 100),
      msg(2, "carol", "dave", "movie night", 200),
    ]);
    expect(filterConversations(conversations, "ALICE")).toHaveLength(1);
    expect(filterConversations(conversations, "movie")).toHaveLength(1);
    expect(filterConversations(conversations, "")).toHaveLength(2);
  });
});
