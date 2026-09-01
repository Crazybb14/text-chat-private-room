import { describe, expect, it } from "vitest";
import { isKickActive } from "./kickWatch";

// @kliv-spec-derived — from user intent: "a kick makes them log in again"
describe("isKickActive", () => {
  it("applies when the kick happened after this sign-in", () => {
    expect(isKickActive(2000, 1000)).toBe(true);
  });

  it("does not re-kick a user who already logged back in", () => {
    // The whole point of a kick is one forced sign-out, not a lock-out loop.
    expect(isKickActive(2000, 3000)).toBe(false);
  });

  it("ignores a missing kick timestamp", () => {
    expect(isKickActive(0, 1000)).toBe(false);
  });

  it("applies to a session that predates kick tracking (signed in at 0)", () => {
    expect(isKickActive(1000, 0)).toBe(true);
  });
});
