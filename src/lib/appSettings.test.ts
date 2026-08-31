import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  RateLimiter,
  SETTING_DEFS,
  coerceSetting,
  filterMessage,
  slowModeRemaining,
  suggestPassword,
  type AppSettings,
} from "./appSettings";

const def = (key: string) => {
  const found = SETTING_DEFS.find((d) => d.key === key);
  if (!found) throw new Error(`missing def ${key}`);
  return found;
};

describe("settings definitions", () => {
  it("covers every group with at least one setting", () => {
    const groups = new Set(SETTING_DEFS.map((d) => d.group));
    expect(groups.size).toBeGreaterThanOrEqual(4);
  });

  it("has unique keys with defaults", () => {
    const keys = SETTING_DEFS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of SETTING_DEFS) {
      expect(d.default).not.toBe(undefined);
    }
  });
});

describe("coerceSetting", () => {
  it("parses booleans", () => {
    expect(coerceSetting(def("word_filter_enabled"), "true")).toBe(true);
    expect(coerceSetting(def("word_filter_enabled"), "false")).toBe(false);
  });

  it("clamps numbers into range", () => {
    expect(coerceSetting(def("auto_delete_hours"), "24")).toBe(24);
    expect(coerceSetting(def("auto_delete_hours"), "0")).toBe(1);
    expect(coerceSetting(def("auto_delete_hours"), "99999")).toBe(720);
    expect(coerceSetting(def("auto_delete_hours"), "garbage")).toBe(24);
  });
});

// @kliv-spec-derived — from user intent: "word filter replaces banned words"
describe("filterMessage", () => {
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    word_filter_enabled: true,
    banned_words: "heck, darn",
  };

  it("masks banned whole words", () => {
    expect(filterMessage("what the heck", settings)).toBe("what the ••••");
  });

  it("keeps innocent words that contain a banned fragment", () => {
    expect(filterMessage("check the heckbox", settings)).toBe("check the heckbox");
  });

  it("does nothing when the filter is off", () => {
    expect(filterMessage("what the heck", DEFAULT_SETTINGS)).toBe("what the heck");
  });
});

describe("RateLimiter", () => {
  it("blocks sends past the per-minute cap", () => {
    const limiter = new RateLimiter(2);
    const t0 = 1_000_000;
    expect(limiter.allow(t0)).toBe(true);
    limiter.record(t0);
    expect(limiter.allow(t0 + 1000)).toBe(true);
    limiter.record(t0 + 1000);
    expect(limiter.allow(t0 + 2000)).toBe(false);
  });

  it("frees up again after a minute", () => {
    const limiter = new RateLimiter(1);
    limiter.record(0);
    expect(limiter.allow(61_000)).toBe(true);
  });
});

describe("slowModeRemaining", () => {
  it("returns 0 when slow mode is off", () => {
    expect(slowModeRemaining(1000, 0, 9999)).toBe(0);
  });

  it("counts down the wait", () => {
    expect(slowModeRemaining(0, 10, 4000)).toBe(6000);
    expect(slowModeRemaining(0, 10, 10000)).toBe(0);
  });
});

describe("suggestPassword", () => {
  it("makes long, unique, valid passwords", () => {
    const a = suggestPassword();
    const b = suggestPassword();
    expect(a.length).toBeGreaterThanOrEqual(15);
    expect(a).not.toBe(b);
  });
});
