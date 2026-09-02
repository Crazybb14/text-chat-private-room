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
      "scum", "pathetic", "shutup", "trashy", "brainless", "worthless",
      "dummy", "dummies", "twit", "twits", "nitwit", "nitwits", "dimwit", "dimwits",
      "doofus", "dingbat", "dunce", "bonehead", "boneheads", "knucklehead",
      "knuckleheads", "airhead", "airheads", "imbecile", "imbeciles", "moronic",
      "idiocy", "brat", "brats", "simp", "simps", "liar", "liars", "trash",
      "butthead", "buttheads", "numbskull", "numbskulls",
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
      "weed", "crack", "crackpipe", "oxycodone", "percocet", "xanax", "valium",
      "ketamine", "mdma", "ecstasy", "lsd", "shrooms", "dmt", "molly", "benzos",
      "adderall", "vicodin", "codeine", "morphine", "opium",
      "tosser", "plonker", "pillock",
      "shite", "shites", "methamphetamine", "methamphetamines", "amphetamine",
      "amphetamines", "oxycontin", "fent", "flakka", "krokodil", "bathsalts",
      "poppers", "whippets", "salvia", "peyote", "khat", "crackhead", "crackheads",
      "junkie", "junkies", "tramadol", "norco", "dilaudid", "xans", "xanny", "percs",
      "scumbag", "scumbags", "turd", "turds", "cretin", "cretins", "parasite",
      "parasites", "leech", "leeches", "vermin", "ffs",
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
      "stfu", "wtf", "fuckboy", "fuckboys", "shitstain", "shithole", "shitfaced",
      "asshat", "assclown", "asswipe", "butthole", "bullshitter", "dumbfucks",
      "numbnuts", "horny", "nsfw",
      "fcuk", "fuxk", "fxck", "fukin", "fukn", "fkn", "fkin", "fking", "fuking",
      "fuked", "fukd", "fukked", "fuhk", "fuhq", "fcku", "fuckface", "fuckery",
      "fuckyou", "fuckoff", "dumbfuck", "bitchass", "sonofabitch", "bih", "bicth", "bich",
      "bytch", "btch", "biatch", "beotch", "bitchy", "dik", "dyck", "dickface",
      "dickbag", "shyt", "dipshit", "dumbshit", "batshit", "apeshit", "holyshit",
      "wank", "wanks", "wanking", "bint", "bints", "slag", "slags", "lardass",
      "pornographic", "pornhub", "onlyfans", "xvideos", "xnxx", "redtube", "youporn",
      "rule34", "goddamnit", "bunghole",
      "shitting", "shitted", "shat",
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
      "cum", "cums", "cumming", "creampie", "deepthroat", "rimjob", "fellatio",
      "cunnilingus", "masturbate", "masturbates", "masturbation", "bukkake", "clit",
      "clitoris", "dildo", "dildos", "buttplug", "gangbang", "gangbangs", "orgy",
      "orgies", "sexting", "nudes", "jizzed", "boner", "jerkoff", "titties", "titty",
      "boobies",
      "anal", "analingus", "rimming", "rimmed", "fingering", "fisting", "fisted",
      "threesome", "foursome", "cuck", "cucking", "cuckold", "cuckolds", "milf",
      "gilf", "dilf", "gloryhole", "gloryholes", "hooker", "hookers", "prostitute",
      "prostitutes", "brothel", "whorehouse", "callgirl", "callgirls",
      "streetwalker", "streetwalkers", "camgirl", "camgirls", "sexcam", "sexchat",
      "sexcall", "sloot", "sloots", "bimbo", "bimbos", "thottie", "thotties",
      "cumslut", "cumdump", "cumbucket", "roastie", "roasties", "analbeads",
      "ballsack", "ballgag", "pegging", "moneyshot", "noods", "sendnudes",
      "ejaculate", "jackoff", "jackingoff", "jerkingoff", "assfuck", "assfucking",
      "buttfuck", "buttfucking", "titfuck", "tittyfuck", "facefuck", "throatfuck",
      "minge", "minger", "mingers", "coochie", "punani",
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
      "hitler", "siegheil", "niglet", "niglets", "jigaboo", "jigaboos", "sheboon",
      "sheboons", "porchmonkey", "shitskin", "shitskins", "chinc", "tard", "tards",
      "groomer", "groomers", "zoophile", "zoophilia", "bestiality", "raped", "rapey",
      "sexoffender", "pedobear", "cutyourself", "hangyourself", "offyourself",
      "lynch", "lynching",
      "paki", "pakis", "yid", "yids", "hymie", "hymies", "shylock", "dago", "dagos",
      "wop", "wops", "mick", "micks", "taig", "kraut", "krauts", "jap", "japs",
      "nip", "nips", "zipperhead", "zipperheads", "slanteye", "slanteyes",
      "slopehead", "redskin", "redskins", "injun", "injuns", "squaw", "squaws",
      "pickaninny", "pickaninnies", "sambo", "sambos", "coonass", "mulatto",
      "mulattos", "octoroon", "quadroon", "halfbreed", "darkie", "darkies",
      "honkey", "honky", "honkies", "honkeys", "spastic", "spastics", "spaz",
      "spazz", "windowlicker", "windowlickers", "downie", "downies", "downsy",
      "libtard", "mong", "neonazi", "neonazis", "kkk", "kkkk", "whitepower",
      "gaschamber", "gaschambers", "finalsolution", "holocaustdenier",
      "holocausthoax", "daterape", "roofie", "roofies", "rohypnol", "ghb",
      "childrape", "childrapist", "gangrape", "loli", "lolicon", "shota",
      "shotacon", "childporn", "kiddieporn", "necro", "necrophilia", "necrophile",
      "molestor", "paedophilia", "pedophilic", "paedophilic", "shemale",
      "bombthreat", "schoolshooter", "schoolshooting", "massshooter",
      "killurself", "slitwrists", "cutwrists",
    ],
  },
];

export const ALL_BANNABLE_WORDS: { word: string; tier: number }[] = WORD_TIERS.flatMap((t) =>
  t.words.map((word) => ({ word, tier: t.tier }))
);

/** Words that on their own mean a threat against someone. */
const THREAT_WORDS = new Set([
  "kys", "killyourself", "iwillkillyou", "rape", "rapes", "raping", "cutyourself",
  "hangyourself", "offyourself", "lynch", "lynching", "killurself", "slitwrists",
  "cutwrists", "daterape", "roofie", "roofies", "rohypnol", "ghb", "childrape",
  "childrapist", "gangrape", "bombthreat", "schoolshooter", "schoolshooting",
  "massshooter",
]);
/** Words about child sexual abuse material — the most serious category. */
const CSAM_WORDS = new Set([
  "cp", "csam", "pedophile", "pedophiles", "pedophilia", "paedophile", "paedophilia",
  "pedophilic", "paedophilic", "loli", "lolicon", "shota", "shotacon", "childporn",
  "kiddieporn",
]);

const WORDS_BY_TIER = new Map<number, Set<string>>(
  WORD_TIERS.map((t) => [t.tier, new Set(t.words)])
);
const LONG_BY_TIER = new Map<number, string[]>(
  WORD_TIERS.map((t) => [t.tier, t.words.filter((w) => w.length >= 10)])
);

/**
 * Slurs and phrases so distinctive that no innocent word contains them. They
 * count even when glued inside other text ("xniggerx"), at any tier.
 */
const SUBSTRING_WORDS: { word: string; tier: number }[] = [
  { word: "nigger", tier: 5 }, { word: "nigga", tier: 5 }, { word: "niglet", tier: 5 },
  { word: "faggot", tier: 5 }, { word: "kike", tier: 5 }, { word: "wetback", tier: 5 },
  { word: "towelhead", tier: 5 }, { word: "raghead", tier: 5 },
  { word: "porchmonkey", tier: 5 }, { word: "jiggaboo", tier: 5 },
  { word: "sheboon", tier: 5 }, { word: "shitskin", tier: 5 },
  { word: "mongoloid", tier: 5 }, { word: "pedophile", tier: 5 },
  { word: "paedophile", tier: 5 }, { word: "heilhitler", tier: 5 },
  { word: "siegheil", tier: 5 }, { word: "childporn", tier: 5 },
  { word: "kiddieporn", tier: 5 }, { word: "killyourself", tier: 5 },
  { word: "hangyourself", tier: 5 }, { word: "offyourself", tier: 5 },
  { word: "cutyourself", tier: 5 },
  { word: "motherfuck", tier: 4 }, { word: "cocksuck", tier: 4 },
];
const SUBSTRING_BY_TIER = new Map<number, Set<string>>();
for (const entry of SUBSTRING_WORDS) {
  const set = SUBSTRING_BY_TIER.get(entry.tier) ?? new Set<string>();
  set.add(entry.word);
  SUBSTRING_BY_TIER.set(entry.tier, set);
}

/**
 * Suffix disguises: "fuking" → "fuk", "shitted" → "shit". Only tier 3+ words
 * are strippable — innocent look-alikes live in tiers 1–2 ("weeding the
 * garden", "the mirror cracked", "speeding").
 */
const STRIP_SUFFIXES = ["s", "es", "ed", "d", "ing", "in", "er", "ers", "z"];
const STRIPPABLE_BY_TIER = new Map<number, Set<string>>(
  WORD_TIERS.filter((t) => t.tier >= 3).map((t) => [
    t.tier,
    new Set(t.words.filter((w) => w.length >= 4)),
  ])
);

/** Common letter swaps people use to slip past filters. */
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "9": "g", "6": "g", "@": "a", $: "s", "!": "i", "€": "e", "£": "l", "+": "t",
  "µ": "u", "¡": "i",
};

/** Accented and look-alike letters folded back to plain a–z. */
const ACCENT: Record<string, string> = {
  "à": "a", "á": "a", "â": "a", "ã": "a", "ä": "a", "å": "a", "ā": "a", "ă": "a",
  "è": "e", "é": "e", "ê": "e", "ë": "e", "ē": "e", "ĕ": "e",
  "ì": "i", "í": "i", "î": "i", "ï": "i", "ī": "i",
  "ò": "o", "ó": "o", "ô": "o", "õ": "o", "ö": "o", "ō": "o", "ő": "o",
  "ù": "u", "ú": "u", "û": "u", "ü": "u", "ū": "u", "ů": "u",
  "ç": "c", "ñ": "n", "ý": "y", "ÿ": "y", "ß": "s", "đ": "d", "ł": "l",
};

/** Invisible characters used to split words past filters. */
const INVISIBLE = /[\u00AD\u200B-\u200F\u2060\uFEFF\u2061-\u2064]/g;

function deLeet(text: string): string {
  const lower = text.toLowerCase().replace(INVISIBLE, "");
  let out = "";
  for (const ch of lower) out += LEET[ch] ?? ACCENT[ch] ?? ch;
  return out;
}

/** "fuuuck" → "fuck" (only collapses runs of 3+ so normal words survive). */
function squashRepeats(token: string): string | null {
  if (!/(.)\1{2,}/.test(token)) return null;
  return token.replace(/(.)\1{2,}/g, "$1");
}

/** Possible base words a disguised token could be ("fuking" → "fuk"). */
function stemCandidates(form: string): string[] {
  const out: string[] = [];
  for (const suffix of STRIP_SUFFIXES) {
    if (!form.endsWith(suffix) || form.length - suffix.length < 4) continue;
    const stem = form.slice(0, -suffix.length);
    out.push(stem);
    const squashed = squashRepeats(stem);
    if (squashed) out.push(squashed);
  }
  return out;
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
 * letters (fuuuck), accented spellings (fúck), invisible characters, glued
 * disguises (xniggerx), and suffixed spellings (fuking, shitted) — while
 * leaving normal words like "class", "assassin", or "gas hit" alone.
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
  // The whole message glued together, so words spelled across many tokens
  // ("n i g g a") still match.
  if (tokens.length > 4 && tokens.length <= 10) forms.push(tokens.join(""));

  const stemCache = new Map<string, string[]>();

  let found = false;
  let bestTier = 0;
  let bestWord = "";
  let bestOccurrences = 0;
  for (const tier of [5, 4, 3, 2, 1]) {
    const set = WORDS_BY_TIER.get(tier);
    if (!set) continue;
    const substrings = SUBSTRING_BY_TIER.get(tier);
    const longs = LONG_BY_TIER.get(tier) ?? [];
    const strippable = STRIPPABLE_BY_TIER.get(tier) ?? new Set<string>();
    for (const form of forms) {
      let hit: string | null = null;
      if (set.has(form)) {
        hit = form;
      } else if (substrings) {
        for (const word of substrings) {
          if (form.includes(word)) {
            hit = word;
            break;
          }
        }
      }
      if (hit === null && form.length >= 10) {
        hit = longs.find((long) => form.includes(long)) ?? null;
      }
      if (hit === null) {
        let stems = stemCache.get(form);
        if (!stems) {
          stems = stemCandidates(form);
          stemCache.set(form, stems);
        }
        hit = stems.find((stem) => strippable.has(stem)) ?? null;
      }
      if (hit !== null) {
        const occurrences = forms.filter((f) => f === hit || f.includes(hit)).length;
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
