/**
 * Chat moderation engine — single client-side source of truth for the word
 * list, severity tiers, matching, and the escalating penalty ladder.
 *
 * NOTE: the `moderation` edge function carries a synced copy of the word list
 * and matcher (the server is the enforcement point). Keep both in sync.
 */

import { functions } from "@/lib/shared/kliv-functions.js";

export interface WordTier {
  tier: 1 | 2 | 3 | 4 | 5;
  label: string;
  description: string;
  color: string; // tailwind classes for badges
  words: string[];
}

/** Tier 1 — mild. Tier 5 — worst (slurs, threats, illegal). */
export const WORD_TIERS: WordTier[] = [
  {
    tier: 1,
    label: "Tier 1 · Mild",
    description: "Mild swearing and light insults. Starts with a warning, then short bans.",
    color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    words: [
      "damn", "dammit", "damnit", "damned", "hell", "crap", "crappy", "piss", "pissed",
      "sucks", "stupid", "dumb", "idiot", "idiots", "moron", "morons", "loser", "losers",
      "freaking", "friggin", "lame",
    ],
  },
  {
    tier: 2,
    label: "Tier 2 · Moderate",
    description: "Moderate profanity and drug terms. Short bans that grow with repeats.",
    color: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    words: [
      "ass", "arse", "asses", "bastard", "bastards", "bollocks", "bugger", "goddamn",
      "goddammit", "douche", "bloody", "prick", "pricks", "meth", "heroin", "cocaine",
      "fentanyl", "crystalmeth",
    ],
  },
  {
    tier: 3,
    label: "Tier 3 · Strong",
    description: "Strong profanity and insults. Hours-long bans that escalate fast.",
    color: "bg-red-500/15 text-red-400 border-red-500/30",
    words: [
      "fuck", "fuk", "fck", "phuck", "fvck", "fucking", "fuckin", "fucked", "fucker",
      "fuckers", "fucktard", "fuckwit", "fuckhead", "shit", "shits", "shitty",
      "bullshit", "shithead", "bitch", "bitches", "bitching", "dick", "dicks", "dickhead",
      "dickwad", "cock", "cocks", "twat", "twats", "wanker", "wankers", "asshole",
      "assholes", "arsehole", "jackass", "dumbass", "nazi", "nazis", "porn", "porno",
      "pornos", "pornography", "hentai",
    ],
  },
  {
    tier: 4,
    label: "Tier 4 · Severe",
    description: "Sexual, degrading, and explicit content. Day-long bans right away.",
    color: "bg-pink-600/15 text-pink-400 border-pink-600/30",
    words: [
      "cunt", "cunts", "cunty", "slut", "sluts", "slutty", "whore", "whores", "whoring",
      "thot", "thots", "motherfucker", "motherfuckers", "motherfcking", "cocksucker",
      "pussy", "pussies", "jizz", "blowjob", "handjob", "cumshot", "skank", "skanks",
    ],
  },
  {
    tier: 5,
    label: "Tier 5 · Extreme",
    description:
      "Hate speech, slurs, threats, and illegal content. Week-plus bans; repeats become permanent.",
    color: "bg-rose-600/20 text-rose-300 border-rose-600/40",
    words: [
      "nigger", "niggers", "nigga", "niggas", "niggaz", "fag", "fags", "faggot",
      "faggots", "faggotry", "dyke", "dykes", "tranny", "trannies", "chink", "chinks",
      "spic", "spics", "wetback", "wetbacks", "kike", "kikes", "gook", "gooks",
      "beaner", "beaners", "coon", "coons", "towelhead", "raghead", "retard", "retards",
      "retarded", "retarted", "mongoloid", "mongoloids", "rape", "rapes", "raping",
      "rapist", "rapists", "molest", "molester", "molesters", "molesting", "pedophile",
      "pedophiles", "pedophilia", "paedophile", "cp", "csam", "kys", "killyourself",
      "iwillkillyou", "heilhitler", "isis", "daesh", "alqaeda",
    ],
  },
];

export const ALL_BANNABLE_WORDS: { word: string; tier: number }[] = WORD_TIERS.flatMap((t) =>
  t.words.map((word) => ({ word, tier: t.tier }))
);

/** Words that on their own mean a threat against someone. */
const THREAT_WORDS = new Set(["kys", "killyourself", "iwillkillyou", "rape", "rapes", "raping"]);
/** Words about child sexual abuse material — the most serious category. */
const CSAM_WORDS = new Set(["cp", "csam", "pedophile", "pedophiles", "pedophilia", "paedophile"]);

const WORDS_BY_TIER = new Map<number, Set<string>>(
  WORD_TIERS.map((t) => [t.tier, new Set(t.words)])
);
const LONG_WORDS = ALL_BANNABLE_WORDS.filter((w) => w.word.length >= 10).map((w) => w.word);

/** Common letter swaps people use to slip past filters. */
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "9": "g", "@": "a", $: "s", "!": "i", "€": "e", "£": "l", "+": "t",
};

function deLeet(text: string): string {
  const lower = text.toLowerCase();
  let out = "";
  for (const ch of lower) out += LEET[ch] ?? ch;
  return out;
}

/** "fuuuck" → "fuck" (only collapses runs of 3+ so normal words survive). */
function squashRepeats(token: string): string | null {
  if (!/(.)\1{2,}/.test(token)) return null;
  return token.replace(/(.)\1{2,}/g, "$1");
}

export interface ViolationMatch {
  tier: number;
  word: string;
  flags: string[]; // 'directed' | 'threat' | 'csam' | 'spam'
  occurrences: number;
}

/**
 * Scans a message for banned language. Catches plain words plus the usual
 * bypass tricks: leetspeak (sh1t), separators (f u c k, f*ck), repeated
 * letters (fuuuck), and mixed forms (n1 gg er) — while leaving normal words
 * like "class", "assassin", or "gas hit" alone.
 */
export function findViolation(text: string): ViolationMatch | null {
  if (!text || !text.trim()) return null;
  const deLeeted = deLeet(text);
  const tokens = deLeeted.split(/[^a-z]+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // Every candidate form of "what the user might have typed"
  const forms: string[] = [...tokens];
  for (const token of tokens) {
    const squashed = squashRepeats(token);
    if (squashed && squashed.length >= 3) forms.push(squashed);
  }
  // Words spelled across 2–4 consecutive tokens ("f u c k", "n1 gg er")
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 2; len <= 4 && i + len <= tokens.length; len++) {
      forms.push(tokens.slice(i, i + len).join(""));
    }
  }

  let found = false;
  let bestTier = 0;
  let bestWord = "";
  let bestOccurrences = 0;
  for (const tier of [5, 4, 3, 2, 1]) {
    const set = WORDS_BY_TIER.get(tier);
    if (!set) continue;
    for (const form of forms) {
      let hit: string | null = null;
      if (set.has(form)) {
        hit = form;
      } else if (form.length >= 10) {
        hit = LONG_WORDS.find((long) => form.includes(long)) ?? null;
      }
      if (hit !== null) {
        const occurrences = forms.filter((f) => f === hit).length;
        if (!found || occurrences > bestOccurrences) {
          found = true;
          bestTier = tier;
          bestWord = hit;
          bestOccurrences = occurrences;
        }
        break;
      }
    }
    if (found) break; // highest (worst) tier wins
  }
  if (!found) return null;

  const flags: string[] = [];
  const directed = /\b(you|ya|ur|your|youre|you're|u)\b/i.test(text);
  if (directed) flags.push("directed");
  const violenceVerb = /\b(kill|hurt|beat|find|hunt|dead|die|burn|destroy)\b/i.test(text);
  if (THREAT_WORDS.has(bestWord) || (directed && violenceVerb && bestTier >= 4)) {
    flags.push("threat");
  }
  if (CSAM_WORDS.has(bestWord)) flags.push("csam");
  if (bestOccurrences >= 3) flags.push("spam");

  return { tier: bestTier, word: bestWord, flags, occurrences: bestOccurrences };
}

/** Escalation ladder in minutes. Index 0 = warning, last = permanent. */
export const PENALTY_LADDER_MINUTES = [0, 5, 30, 120, 720, 1440, 4320, 10080, 20160, 43200, 86400, Infinity];
export const PERMANENT_INDEX = PENALTY_LADDER_MINUTES.length - 1;
/** Two months is the longest finite ban — anything past it is permanent. */
export const TWO_MONTHS_MINUTES = 86400;

/** Where each tier starts on the ladder (no priors). */
export const TIER_START_INDEX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 4, 5: 7 };

export interface PenaltyOptions {
  threat?: boolean;
  csam?: boolean;
  /** Tier-1 first offense is only a warning when true. */
  warnFirstOffense?: boolean;
  /** Multiplier on how fast repeats climb the ladder (1–3). */
  multiplier?: number;
}

export interface Penalty {
  kind: "warn" | "ban";
  ladderIndex: number;
  minutes: number; // 0 for warn, Infinity for permanent
  permanent: boolean;
}

/**
 * The escalating penalty: each repeat offense climbs the ladder. Anything
 * that would go past a two-month ban is permanent instead.
 */
export function nextPenalty(
  tier: number,
  priorViolations: number,
  options: PenaltyOptions = {}
): Penalty {
  const multiplier = Math.min(3, Math.max(1, Math.round(options.multiplier ?? 1)));
  let start = TIER_START_INDEX[Math.min(5, Math.max(1, tier))] ?? 2;
  if (options.csam) start = Math.max(start, 10);
  else if (options.threat) start = Math.max(start, 9);
  if (tier === 1 && priorViolations === 0 && options.warnFirstOffense !== false) {
    return { kind: "warn", ladderIndex: 0, minutes: 0, permanent: false };
  }
  const index = Math.min(PERMANENT_INDEX, start + priorViolations * multiplier);
  const minutes = PENALTY_LADDER_MINUTES[index];
  if (minutes === 0) return { kind: "warn", ladderIndex: index, minutes: 0, permanent: false };
  if (!Number.isFinite(minutes)) {
    return { kind: "ban", ladderIndex: index, minutes: Infinity, permanent: true };
  }
  return { kind: "ban", ladderIndex: index, minutes, permanent: false };
}

/** "90 min" / "3 days" / "2 months" — for ban screens and admin lists. */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes)) return "permanent";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h} hour${h === 1 ? "" : "s"}`;
  }
  if (minutes < 43200) {
    const d = Math.floor(minutes / 1440);
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  const mo = Math.round(minutes / 43200);
  return `${mo} month${mo === 1 ? "" : "s"}`;
}

export function formatRemaining(untilMs: number | null, permanent: boolean): string {
  if (permanent) return "permanent";
  if (!untilMs) return "";
  const ms = untilMs - Date.now();
  if (ms <= 0) return "expired";
  return formatDuration(Math.ceil(ms / 60000));
}

/* ------------------------------------------------------------------ */
/* Client helpers that talk to the moderation server function          */
/* ------------------------------------------------------------------ */

export interface BanStatus {
  banned: boolean;
  permanent: boolean;
  untilMs: number | null;
  reason: string | null;
  evasion: boolean;
}

export interface ModerationVerdict {
  action: "allow" | "warned" | "banned";
  tier?: number;
  word?: string;
  message?: string;
  reason?: string | null;
  permanent?: boolean;
  untilMs?: number | null;
  minutes?: number;
}

/** Asks the server: is this user or their device banned right now? */
export async function checkBanStatus(username: string, email?: string | null): Promise<BanStatus> {
  const { getDeviceId } = await import("@/lib/deviceId");
  try {
    const result = await functions.post<Partial<BanStatus> & { banned?: boolean }>("moderation", {
      action: "status",
      username,
      email: email ?? "",
      deviceId: getDeviceId(),
    });
    return {
      banned: result?.banned === true,
      permanent: result?.permanent === true,
      untilMs: typeof result?.untilMs === "number" ? result.untilMs : null,
      reason: result?.reason ?? null,
      evasion: result?.evasion === true,
    };
  } catch {
    // Server unreachable — fall back to a direct lookup so bans still hold.
    try {
      const db = (await import("@/lib/shared/kliv-database.js")).default;
      const rows = await db.query<{
        ban_duration: number | null;
        reason: string | null;
        _created_at: number;
      }>("bans", { username: `eq.${username}` });
      const now = Math.floor(Date.now() / 1000);
      const active = rows.find(
        (r) =>
          !r.ban_duration ||
          Number(r.ban_duration) <= 0 ||
          Number(r._created_at) + Number(r.ban_duration) > now
      );
      return active
        ? {
            banned: true,
            permanent: !active.ban_duration || Number(active.ban_duration) <= 0,
            untilMs:
              active.ban_duration && Number(active.ban_duration) > 0
                ? (Number(active._created_at) + Number(active.ban_duration)) * 1000
                : null,
            reason: active.reason ?? null,
            evasion: false,
          }
        : { banned: false, permanent: false, untilMs: null, reason: null, evasion: false };
    } catch {
      return { banned: false, permanent: false, untilMs: null, reason: null, evasion: false };
    }
  }
}

/**
 * Runs a message past the moderation server before it is posted.
 * If the server can't be reached, the message is allowed through so chat
 * never breaks (the ban check on the next page load still catches violators).
 */
export async function moderateMessage(input: {
  username: string;
  email?: string | null;
  roomId: number;
  text: string;
}): Promise<ModerationVerdict> {
  const { getDeviceId } = await import("@/lib/deviceId");
  try {
    const result = await functions.post<Partial<ModerationVerdict>>("moderation", {
      action: "check",
      username: input.username,
      email: input.email ?? "",
      deviceId: getDeviceId(),
      roomId: input.roomId,
      text: input.text,
    });
    return {
      action: result?.action === "warned" || result?.action === "banned" ? result.action : "allow",
      tier: result?.tier,
      word: result?.word,
      message: result?.message,
      reason: result?.reason ?? null,
      permanent: result?.permanent,
      untilMs: typeof result?.untilMs === "number" ? result.untilMs : null,
      minutes: result?.minutes,
    };
  } catch {
    return { action: "allow" };
  }
}

/** True when a signup looks like a test account (used to skip moderation). */
export function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /@(example\.com|invalid\.kliv\.test)$/i.test(email.trim());
}
