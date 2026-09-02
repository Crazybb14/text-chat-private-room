import { useEffect, useRef } from "react";
import type { AppSettings } from "@/lib/appSettings";

/**
 * Site theme colors. An admin picks a color of the day (or turns on
 * auto-rotate) and every page tints its Discord-style surfaces toward it
 * instead of plain gray. The palette is applied through CSS variables so
 * every component follows without knowing about themes.
 */

export interface ThemePreset {
  name: string;
  hex: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: "Blue", hex: "#3e6bd6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Purple", hex: "#9333ea" },
  { name: "Magenta", hex: "#c026d3" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Red", hex: "#dc2626" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Amber", hex: "#d97706" },
  { name: "Green", hex: "#16a34a" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Cyan", hex: "#0891b2" },
];

export const DEFAULT_THEME_COLOR = "#3e6bd6";
export const THEME_STORAGE_KEY = "site_theme_hex";

/** Accepts "abc123" or "#abc123" and returns "#abc123", or null if invalid. */
export function sanitizeHex(input: string | null | undefined): string | null {
  const raw = String(input ?? "").trim().toLowerCase();
  const match = /^#?([0-9a-f]{6})$/.exec(raw);
  return match ? `#${match[1]}` : null;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** hex → HSL (h 0–360, s/l 0–100). Returns null for invalid input. */
export function hexToHsl(input: string): Hsl | null {
  const hex = sanitizeHex(input);
  if (!hex) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s: s * 100, l: l * 100 };
}

/** HSL → "#rrggbb". */
export function hslToHex(h: number, s: number, l: number): string {
  const hn = ((h % 360) + 360) % 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  const seg = Math.floor(hn / 60) % 6;
  const table: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = table[seg];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export interface ThemeSurfaces {
  /** outermost strip (user panel at the bottom of the sidebar) */
  rail: string;
  /** room sidebar */
  side: string;
  /** main chat / page background */
  chat: string;
  /** composer + text inputs */
  input: string;
  /** hover highlight */
  hover: string;
  /** selected room row */
  active: string;
  /** subtle borders / dashed outlines */
  line: string;
  /** hovering a chat message row */
  msgHover: string;
  /** buttons and highlights drawn from the theme color */
  accent: string;
  /** darker accent for button hover states */
  accentHover: string;
}

/**
 * Derives a full set of dark, Discord-style surfaces from one theme color.
 * Layers stay dark enough that light text always reads on top of them.
 */
export function themeSurfaces(input: string): ThemeSurfaces {
  const hsl = hexToHsl(input) ?? hexToHsl(DEFAULT_THEME_COLOR)!;
  const { h, s } = hsl;
  const sat = (mult: number) => Math.min(60, s * mult);
  return {
    rail: hslToHex(h, sat(0.55), 11),
    side: hslToHex(h, sat(0.5), 14.5),
    chat: hslToHex(h, sat(0.45), 17.5),
    input: hslToHex(h, sat(0.35), 22),
    hover: hslToHex(h, sat(0.35), 24),
    active: hslToHex(h, sat(0.38), 27),
    line: hslToHex(h, sat(0.4), 30),
    msgHover: hslToHex(h, sat(0.3), 21),
    accent: hslToHex(h, Math.max(65, s), 62),
    accentHover: hslToHex(h, Math.max(65, s), 55),
  };
}

/**
 * The auto-rotate color for a given day: deterministic per calendar date, so
 * everyone sees the same color and it changes once a day without anyone
 * pressing anything.
 */
export function dailyThemeColor(date: Date): string {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const dayOfYear = Math.floor((today - start) / 86_400_000);
  return THEME_PRESETS[((dayOfYear % THEME_PRESETS.length) + THEME_PRESETS.length) % THEME_PRESETS.length].hex;
}

export function presetName(hex: string): string {
  const found = THEME_PRESETS.find((p) => p.hex === hex.toLowerCase());
  return found ? found.name : hex.toUpperCase();
}

/**
 * Picks the color the whole site should use right now:
 * - mode "daily" → the auto-rotating color for today
 * - anything else → the stored color (fallback: default blue)
 */
export function resolveThemeColor(
  settings: Pick<AppSettings, "theme_mode" | "theme_color"> | Record<string, unknown> | undefined | null,
  now: Date = new Date()
): string {
  const bag = (settings ?? {}) as Record<string, unknown>;
  const mode = String(bag.theme_mode ?? "manual");
  if (mode === "daily") return dailyThemeColor(now);
  return sanitizeHex(String(bag.theme_color ?? "")) ?? DEFAULT_THEME_COLOR;
}

/** Writes the theme variables onto a DOM node (defaults to <html>). */
export function applyThemeVars(hex: string, target?: HTMLElement): void {
  if (typeof document === "undefined") return;
  const node = target ?? document.documentElement;
  const surfaces = themeSurfaces(hex);
  node.style.setProperty("--dc-rail", surfaces.rail);
  node.style.setProperty("--dc-side", surfaces.side);
  node.style.setProperty("--dc-chat", surfaces.chat);
  node.style.setProperty("--dc-input", surfaces.input);
  node.style.setProperty("--dc-hover", surfaces.hover);
  node.style.setProperty("--dc-active", surfaces.active);
  node.style.setProperty("--dc-line", surfaces.line);
  node.style.setProperty("--dc-msg-hover", surfaces.msgHover);
  node.style.setProperty("--dc-accent", surfaces.accent);
  node.style.setProperty("--dc-accent-hover", surfaces.accentHover);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, hex);
  } catch {
    // storage unavailable — the in-memory vars still apply
  }
}

/** Applies the last known theme before settings load, so pages never flash gray. */
export function applyCachedTheme(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const cached = sanitizeHex(localStorage.getItem(THEME_STORAGE_KEY));
    if (cached) applyThemeVars(cached);
  } catch {
    // ignore
  }
}

/**
 * Keeps the whole site on the admin's chosen color. Re-resolves every few
 * minutes so a "new color every day" rollover lands without a reload.
 */
export function useSiteTheme(
  settings: Pick<AppSettings, "theme_mode" | "theme_color"> | Record<string, unknown> | undefined | null
): void {
  const startedRef = useRef(false);
  if (!startedRef.current) {
    startedRef.current = true;
    applyCachedTheme();
  }

  useEffect(() => {
    applyThemeVars(resolveThemeColor(settings));
  }, [settings]);

  useEffect(() => {
    const timer = setInterval(() => {
      applyThemeVars(resolveThemeColor(settings));
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [settings]);
}
