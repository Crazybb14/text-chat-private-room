import { describe, expect, it } from "vitest";
import { coerceUserPrefs, DEFAULT_USER_PREFS } from "./userSettings";

// @kliv-spec-derived — from user intent: "add more user settings" that each person controls
describe("coerceUserPrefs", () => {
  it("falls back to sensible defaults for missing or broken data", () => {
    expect(coerceUserPrefs(null)).toEqual(DEFAULT_USER_PREFS);
    expect(coerceUserPrefs(undefined)).toEqual(DEFAULT_USER_PREFS);
    expect(coerceUserPrefs("not json at all")).toEqual(DEFAULT_USER_PREFS);
    expect(coerceUserPrefs('{"font_size":"big"}')).toEqual(DEFAULT_USER_PREFS);
  });

  it("keeps saved choices, including turned-off ones", () => {
    const saved = coerceUserPrefs(
      JSON.stringify({ sound: false, enter_to_send: false, timestamps: false, show_online: false, compact: true })
    );
    expect(saved.sound).toBe(false);
    expect(saved.enter_to_send).toBe(false);
    expect(saved.timestamps).toBe(false);
    expect(saved.show_online).toBe(false);
    expect(saved.compact).toBe(true);
  });

  it("clamps text size to a readable range", () => {
    expect(coerceUserPrefs('{"font_size":4}').font_size).toBe(12);
    expect(coerceUserPrefs('{"font_size":99}').font_size).toBe(20);
    expect(coerceUserPrefs('{"font_size":17}').font_size).toBe(17);
  });

  it("rounds non-integer sizes", () => {
    expect(coerceUserPrefs('{"font_size":15.7}').font_size).toBe(16);
  });
});
