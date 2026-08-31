import { describe, it, expect } from "vitest";
import { DEFAULT_USER_PREFS, coerceUserPrefs } from "./userSettings";

// @kliv-spec-derived — the profile options must persist auto-join choices, with sane defaults
describe("coerceUserPrefs auto-join fields", () => {
  it("defaults to off with empty specific lists", () => {
    expect(DEFAULT_USER_PREFS.auto_join_group).toBe("off");
    expect(DEFAULT_USER_PREFS.auto_join_group_list).toEqual([]);
    expect(DEFAULT_USER_PREFS.auto_join_voice).toBe("off");
    expect(DEFAULT_USER_PREFS.auto_join_voice_list).toEqual([]);
  });

  it("keeps saved choices and cleans the specific lists", () => {
    const prefs = coerceUserPrefs(
      JSON.stringify({
        auto_join_group: "specific",
        auto_join_group_list: [" Alice ", "BOB", 7],
        auto_join_voice: "friends",
        auto_join_voice_list: "not-a-list",
      })
    );
    expect(prefs.auto_join_group).toBe("specific");
    expect(prefs.auto_join_group_list).toEqual(["alice", "bob"]);
    expect(prefs.auto_join_voice).toBe("friends");
    expect(prefs.auto_join_voice_list).toEqual([]);
  });

  it("drops unknown mode values", () => {
    const prefs = coerceUserPrefs(JSON.stringify({ auto_join_group: "always", auto_join_voice: "sometimes" }));
    expect(prefs.auto_join_group).toBe("off");
    expect(prefs.auto_join_voice).toBe("off");
  });
});
