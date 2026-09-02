import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_COLOR,
  THEME_PRESETS,
  dailyThemeColor,
  hexToHsl,
  hslToHex,
  presetName,
  resolveThemeColor,
  sanitizeHex,
  themeSurfaces,
} from "./siteTheme";

describe("sanitizeHex", () => {
  it("accepts 6-digit hex with or without the #", () => {
    expect(sanitizeHex("#3e6bd6")).toBe("#3e6bd6");
    expect(sanitizeHex("3E6BD6")).toBe("#3e6bd6");
  });

  it("rejects anything that isn't a full 6-digit color", () => {
    expect(sanitizeHex("#fff")).toBeNull();
    expect(sanitizeHex("not-a-color")).toBeNull();
    expect(sanitizeHex("")).toBeNull();
    expect(sanitizeHex("#12345g")).toBeNull();
  });
});

describe("hsl helpers", () => {
  it("round-trips colors through hex → hsl → hex", () => {
    const hsl = hexToHsl("#3e6bd6")!;
    expect(hslToHex(hsl.h, hsl.s, hsl.l)).toBe("#3e6bd6");
  });

  it("gives gray for a gray input", () => {
    const hsl = hexToHsl("#808080")!;
    expect(Math.round(hsl.s)).toBe(0);
    expect(Math.round(hsl.l)).toBe(50);
  });
});

// @kliv-spec-derived — from user intent: "instead of a gray background make
// it blue or a different color" — every layer must be a real color derived
// from the admin's pick, not gray, and stay dark enough to read white text.
describe("themeSurfaces", () => {
  it("produces different backgrounds for different theme colors", () => {
    const blue = themeSurfaces("#3e6bd6");
    const green = themeSurfaces("#16a34a");
    expect(blue.chat).not.toBe(green.chat);
    expect(blue.side).not.toBe(green.side);
  });

  it("keeps every background dark enough for white text", () => {
    for (const preset of THEME_PRESETS) {
      const s = themeSurfaces(preset.hex);
      for (const surface of [s.rail, s.side, s.chat, s.input, s.hover, s.active, s.msgHover]) {
        const l = hexToHsl(surface)!.l;
        expect(l).toBeLessThan(35);
      }
    }
  });

  it("keeps the Discord layer order: rail darkest, then sidebar, then chat", () => {
    const s = themeSurfaces("#8b5cf6");
    expect(hexToHsl(s.rail)!.l).toBeLessThan(hexToHsl(s.side)!.l);
    expect(hexToHsl(s.side)!.l).toBeLessThan(hexToHsl(s.chat)!.l);
    expect(hexToHsl(s.chat)!.l).toBeLessThan(hexToHsl(s.input)!.l);
  });

  it("returns hex colors for every surface", () => {
    const s = themeSurfaces("#dc2626");
    for (const value of Object.values(s)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

// @kliv-spec-derived — from user intent: "a different color every day"
describe("dailyThemeColor", () => {
  it("is stable within a single day", () => {
    const morning = new Date(2026, 8, 2, 8, 0);
    const night = new Date(2026, 8, 2, 23, 30);
    expect(dailyThemeColor(morning)).toBe(dailyThemeColor(night));
  });

  it("always comes from the preset palette", () => {
    const hexes = THEME_PRESETS.map((p) => p.hex);
    for (let day = 0; day < 30; day += 1) {
      expect(hexes).toContain(dailyThemeColor(new Date(2026, 8, 1 + day)));
    }
  });

  it("actually changes as days pass", () => {
    const seen = new Set<string>();
    for (let day = 0; day < THEME_PRESETS.length; day += 1) {
      seen.add(dailyThemeColor(new Date(2026, 0, 1 + day)));
    }
    expect(seen.size).toBe(THEME_PRESETS.length);
  });
});

describe("resolveThemeColor", () => {
  it("uses the stored color when the mode is manual", () => {
    expect(resolveThemeColor({ theme_mode: "manual", theme_color: "#16a34a" })).toBe("#16a34a");
  });

  it("falls back to the default blue for missing or invalid colors", () => {
    expect(resolveThemeColor({})).toBe(DEFAULT_THEME_COLOR);
    expect(resolveThemeColor({ theme_color: "rainbow" })).toBe(DEFAULT_THEME_COLOR);
  });

  it("ignores the stored color and uses today's when the mode is daily", () => {
    const now = new Date(2026, 8, 2, 12, 0);
    expect(resolveThemeColor({ theme_mode: "daily", theme_color: "#dc2626" }, now)).toBe(
      dailyThemeColor(now)
    );
  });
});

describe("presetName", () => {
  it("names palette colors and falls back to uppercased hex", () => {
    expect(presetName("#3e6bd6")).toBe("Blue");
    expect(presetName("#123456")).toBe("#123456");
  });
});
