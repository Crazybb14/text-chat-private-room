import { describe, expect, it } from "vitest";
import {
  announcementStats,
  dmPairStats,
  ipGroups,
  roomMessageCounts,
  signupTrend,
  toCsv,
  topChatters,
} from "./adminStats";

describe("topChatters", () => {
  it("counts messages per sender, busiest first", () => {
    const counts = topChatters([
      { sender_name: "ada" },
      { sender_name: "bob" },
      { sender_name: "ada" },
      { sender_name: null },
    ]);
    expect(counts).toEqual([
      { name: "ada", count: 2 },
      { name: "bob", count: 1 },
    ]);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ sender_name: `user${i}` }));
    expect(topChatters(many, 3)).toHaveLength(3);
  });
});

describe("roomMessageCounts", () => {
  it("counts messages per room and includes empty rooms", () => {
    const counts = roomMessageCounts(
      [
        { _row_id: 1, name: "general" },
        { _row_id: 2, name: "quiet" },
      ],
      [{ room_id: 1 }, { room_id: 1 }, { room_id: 1 }],
    );
    expect(counts).toEqual([
      { id: 1, name: "general", count: 3 },
      { id: 2, name: "quiet", count: 0 },
    ]);
  });
});

describe("signupTrend", () => {
  it("buckets new accounts per day, oldest first", () => {
    const nowMs = Date.parse("2026-09-02T12:00:00Z");
    const trend = signupTrend(
      [
        { _created_at: Math.floor(Date.parse("2026-09-01T10:00:00Z") / 1000) },
        { _created_at: Math.floor(Date.parse("2026-09-01T11:00:00Z") / 1000) },
        { _created_at: Math.floor(Date.parse("2026-08-30T10:00:00Z") / 1000) },
      ],
      7,
      nowMs,
    );
    expect(trend).toHaveLength(7);
    expect(trend.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3);
    expect(trend[6].count).toBe(0); // today has none
  });
});

// @kliv-spec-derived — from user intent: catching multiple accounts on one IP
describe("ipGroups", () => {
  it("flags IPs used by more than one account", () => {
    const groups = ipGroups([
      { username: "ada", ip: "1.1.1.1" },
      { username: "bob", ip: "1.1.1.1" },
      { username: "ada", ip: "1.1.1.1" },
      { username: "cyd", ip: "2.2.2.2" },
    ]);
    expect(groups[0]).toMatchObject({ ip: "1.1.1.1", count: 3 });
    expect(groups[0].usernames).toEqual(["ada", "bob"]);
  });

  it("skips rows missing an IP or username", () => {
    expect(ipGroups([{ username: "", ip: "1.1.1.1" }, { username: "ada", ip: "" }])).toEqual([]);
  });
});

describe("announcementStats", () => {
  it("groups delivery vs read per announcement", () => {
    const stats = announcementStats([
      { title: "Update", is_read: 1 },
      { title: "Update", is_read: 0 },
      { title: "Update", is_read: 1 },
    ]);
    expect(stats).toEqual([{ title: "Update", sent: 3, read: 2 }]);
  });
});

describe("dmPairStats", () => {
  it("merges both directions of a pair into one count", () => {
    const stats = dmPairStats([
      { sender_username: "ada", recipient_username: "bob" },
      { sender_username: "bob", recipient_username: "ada" },
    ]);
    expect(stats).toEqual([{ pair: "ada ⇄ bob", count: 2 }]);
  });
});

describe("toCsv", () => {
  it("escapes commas and quotes", () => {
    const csv = toCsv([{ name: 'Ada "A" L', city: "Portland, OR" }], ["name", "city"]);
    expect(csv.split("\n")[1]).toBe('"Ada ""A"" L","Portland, OR"');
  });

  it("keeps only the chosen columns", () => {
    const csv = toCsv([{ username: "ada", password: "secret" }], ["username"]);
    expect(csv).not.toContain("secret");
  });
});
