import { describe, expect, it } from "vitest";
import {
  dmPairKey,
  participantPresent,
  splitPairKey,
  PARTICIPANT_STALE_MS,
  type CallParticipantRow,
} from "./calls";

// code-consistent — a DM call must map to one shared scope no matter who looks
describe("dmPairKey", () => {
  it("is the same key from either side", () => {
    expect(dmPairKey("alice", "bob")).toBe(dmPairKey("bob", "alice"));
  });

  it("round-trips through splitPairKey", () => {
    const key = dmPairKey("zoe", "adam");
    const [a, b] = splitPairKey(key);
    expect([a, b]).toEqual(["adam", "zoe"]);
  });

  it("separates different pairs", () => {
    expect(dmPairKey("a", "b")).not.toBe(dmPairKey("a", "c"));
  });
});

// @kliv-spec-derived — from user intent: calls show who's really still in them
describe("participantPresent", () => {
  const row = (lastSeen: number) =>
    ({ username: "u", call_id: 1, hidden: 0, muted: 0, video_on: 1, last_seen: lastSeen, _row_id: 1 }) as unknown as CallParticipantRow;

  it("counts a fresh heartbeat as present", () => {
    const now = Date.now();
    expect(participantPresent(row(now - 10_000), now)).toBe(true);
  });

  it("drops participants whose heartbeat went stale", () => {
    const now = Date.now();
    expect(participantPresent(row(now - PARTICIPANT_STALE_MS - 5_000), now)).toBe(false);
  });
});
