import { describe, expect, it } from "vitest";
import { isPresenceOnline, parseSeen } from "./presence";

describe("parseSeen", () => {
  it("parses ISO strings", () => {
    const iso = "2026-08-31T10:00:00.000Z";
    expect(parseSeen(iso)).toBe(Date.parse(iso));
  });

  it("parses space-separated timestamps", () => {
    const spaced = "2026-08-31 10:00:00";
    expect(parseSeen(spaced)).toBe(Date.parse("2026-08-31T10:00:00"));
  });

  it("returns 0 for junk", () => {
    expect(parseSeen("not a date")).toBe(0);
    expect(parseSeen("")).toBe(0);
  });
});

describe("isPresenceOnline", () => {
  const now = Date.parse("2026-08-31T12:00:00.000Z");

  it("treats a fresh heartbeat as online", () => {
    expect(isPresenceOnline({ last_seen: new Date(now - 60_000).toISOString() }, now)).toBe(true);
  });

  it("treats a heartbeat older than 2 minutes as offline", () => {
    expect(isPresenceOnline({ last_seen: new Date(now - 3 * 60_000).toISOString() }, now)).toBe(false);
  });

  it("treats a missing heartbeat as offline", () => {
    expect(isPresenceOnline({ last_seen: "" }, now)).toBe(false);
  });
});
