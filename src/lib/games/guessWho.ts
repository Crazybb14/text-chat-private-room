import { cloneState, otherRole, type Difficulty, type MatchState, type MoveResult, type Role } from "./types";

export interface GwChar {
  name: string;
  female: boolean;
  blonde: boolean;
  red: boolean;
  dark: boolean;
  glasses: boolean;
  hat: boolean;
  beard: boolean;
  mustache: boolean;
  smile: boolean;
  earrings: boolean;
}

export const GW_CHARS: GwChar[] = [
  { name: "Ava", female: true, blonde: true, red: false, dark: false, glasses: true, hat: false, beard: false, mustache: false, smile: true, earrings: true },
  { name: "Bella", female: true, blonde: true, red: false, dark: false, glasses: false, hat: true, beard: false, mustache: false, smile: false, earrings: true },
  { name: "Chloe", female: true, blonde: true, red: false, dark: false, glasses: true, hat: false, beard: false, mustache: false, smile: true, earrings: false },
  { name: "Dana", female: true, blonde: false, red: true, dark: false, glasses: false, hat: false, beard: false, mustache: false, smile: false, earrings: true },
  { name: "Emma", female: true, blonde: false, red: true, dark: false, glasses: false, hat: false, beard: false, mustache: false, smile: true, earrings: true },
  { name: "Fiona", female: true, blonde: false, red: true, dark: false, glasses: false, hat: false, beard: false, mustache: false, smile: false, earrings: false },
  { name: "Grace", female: true, blonde: false, red: false, dark: true, glasses: true, hat: false, beard: false, mustache: false, smile: false, earrings: true },
  { name: "Heidi", female: true, blonde: false, red: false, dark: true, glasses: false, hat: false, beard: false, mustache: false, smile: true, earrings: false },
  { name: "Iris", female: true, blonde: false, red: false, dark: true, glasses: true, hat: true, beard: false, mustache: false, smile: false, earrings: false },
  { name: "Jade", female: true, blonde: false, red: false, dark: true, glasses: false, hat: false, beard: false, mustache: false, smile: true, earrings: true },
  { name: "Kate", female: true, blonde: false, red: false, dark: true, glasses: false, hat: false, beard: false, mustache: false, smile: true, earrings: false },
  { name: "Lily", female: true, blonde: false, red: false, dark: true, glasses: false, hat: true, beard: false, mustache: false, smile: true, earrings: true },
  { name: "Max", female: false, blonde: true, red: false, dark: false, glasses: true, hat: false, beard: false, mustache: false, smile: true, earrings: false },
  { name: "Noah", female: false, blonde: true, red: false, dark: false, glasses: false, hat: true, beard: false, mustache: false, smile: false, earrings: false },
  { name: "Owen", female: false, blonde: true, red: false, dark: false, glasses: false, hat: false, beard: true, mustache: false, smile: true, earrings: false },
  { name: "Pete", female: false, blonde: false, red: true, dark: false, glasses: false, hat: false, beard: false, mustache: true, smile: true, earrings: false },
  { name: "Quinn", female: false, blonde: false, red: true, dark: false, glasses: false, hat: true, beard: false, mustache: false, smile: false, earrings: false },
  { name: "Ryan", female: false, blonde: false, red: true, dark: false, glasses: false, hat: false, beard: true, mustache: false, smile: false, earrings: false },
  { name: "Sam", female: false, blonde: false, red: false, dark: true, glasses: true, hat: false, beard: true, mustache: false, smile: true, earrings: false },
  { name: "Tom", female: false, blonde: false, red: false, dark: true, glasses: true, hat: false, beard: false, mustache: true, smile: false, earrings: false },
  { name: "Umar", female: false, blonde: false, red: false, dark: true, glasses: false, hat: false, beard: false, mustache: false, smile: false, earrings: false },
  { name: "Victor", female: false, blonde: false, red: false, dark: true, glasses: true, hat: true, beard: false, mustache: true, smile: false, earrings: false },
  { name: "Walt", female: false, blonde: false, red: false, dark: true, glasses: false, hat: true, beard: true, mustache: false, smile: true, earrings: false },
  { name: "Xavi", female: false, blonde: false, red: false, dark: true, glasses: false, hat: false, beard: true, mustache: false, smile: false, earrings: false },
];

export type GwTrait = Exclude<keyof GwChar, "name">;

export const GW_QUESTIONS: { key: GwTrait; text: string }[] = [
  { key: "female", text: "Is your person a woman?" },
  { key: "glasses", text: "Does your person wear glasses?" },
  { key: "hat", text: "Does your person wear a hat?" },
  { key: "beard", text: "Does your person have a beard?" },
  { key: "mustache", text: "Does your person have a mustache?" },
  { key: "blonde", text: "Is your person blonde?" },
  { key: "red", text: "Does your person have red hair?" },
  { key: "dark", text: "Does your person have dark hair?" },
  { key: "smile", text: "Is your person smiling?" },
  { key: "earrings", text: "Does your person wear earrings?" },
];

export function gwQuestionText(key: string): string {
  return GW_QUESTIONS.find((q) => q.key === key)?.text ?? key;
}

export interface GwState {
  secretP1: number | null;
  secretP2: number | null;
  candP1: number[];
  candP2: number[];
  askedP1: string[];
  askedP2: string[];
  events: string[];
}

export function createGw(): MatchState<GwState> {
  return {
    phase: "setup",
    turn: null,
    winner: null,
    game: {
      secretP1: null,
      secretP2: null,
      candP1: GW_CHARS.map((_, i) => i),
      candP2: GW_CHARS.map((_, i) => i),
      askedP1: [],
      askedP2: [],
      events: [],
    },
    log: [{ by: "system", text: "Pick your mystery person, then narrow the other side down with yes/no questions." }],
  };
}

function isGwMove(move: unknown): move is { kind: "pick"; char: number } | { kind: "ask"; q: string } | { kind: "guess"; char: number } {
  if (typeof move !== "object" || move === null) return false;
  const m = move as Record<string, unknown>;
  if (m.kind === "pick") return typeof m.char === "number";
  if (m.kind === "ask") return typeof m.q === "string";
  return m.kind === "guess" && typeof m.char === "number";
}

function secretKey(role: Role): "secretP1" | "secretP2" {
  return role === "p1" ? "secretP1" : "secretP2";
}
function candKey(role: Role): "candP1" | "candP2" {
  return role === "p1" ? "candP1" : "candP2";
}
function askedKey(role: Role): "askedP1" | "askedP2" {
  return role === "p1" ? "askedP1" : "askedP2";
}
function label(role: Role): string {
  return role === "p1" ? "Player 1" : "Player 2";
}

export function applyGw(ms: MatchState<GwState>, role: Role, move: unknown): MoveResult {
  if (!isGwMove(move)) return { ok: false, error: "That isn't a valid move." };
  const g = ms.game;

  if (move.kind === "pick") {
    if (ms.phase !== "setup") return { ok: false, error: "Characters are already chosen." };
    if (!Number.isInteger(move.char) || move.char < 0 || move.char >= GW_CHARS.length) {
      return { ok: false, error: "Pick someone from the board." };
    }
    if (g[secretKey(role)] !== null) return { ok: false, error: "You already picked your person." };
    const next = cloneState(ms);
    next.game[secretKey(role)] = move.char;
    next.game.events.push(`${label(role)} chose a mystery person.`);
    next.log.push({ by: role, text: "Chose a mystery person." });
    if (next.game.secretP1 !== null && next.game.secretP2 !== null) {
      next.phase = "playing";
      next.turn = "p1";
      next.game.events.push("Both sides are set — Player 1 asks first.");
    }
    return { ok: true, state: next };
  }

  if (ms.phase !== "playing") return { ok: false, error: "The round hasn't started yet." };
  if (ms.turn !== role) return { ok: false, error: "It's not your turn." };
  const target = g[secretKey(otherRole(role))];
  if (target === null) return { ok: false, error: "Wait for the other side to pick." };
  const targetChar = GW_CHARS[target];

  if (move.kind === "ask") {
    const q = GW_QUESTIONS.find((entry) => entry.key === move.q);
    if (!q) return { ok: false, error: "That question isn't on the list." };
    if (g[askedKey(role)].includes(q.key)) return { ok: false, error: "You already asked that." };
    const answer = Boolean(targetChar[q.key]);
    const next = cloneState(ms);
    next.game[askedKey(role)].push(q.key);
    next.game[candKey(role)] = next.game[candKey(role)].filter((idx) => Boolean(GW_CHARS[idx][q.key]) === answer);
    next.game.events.push(`Q: ${q.text} → ${answer ? "Yes" : "No"}`);
    next.log.push({ by: role, text: `${q.text} — ${answer ? "Yes" : "No"}.` });
    next.turn = otherRole(role);
    return { ok: true, state: next };
  }

  // guess
  if (!Number.isInteger(move.char) || move.char < 0 || move.char >= GW_CHARS.length) {
    return { ok: false, error: "Pick someone from the board." };
  }
  const next = cloneState(ms);
  if (move.char === target) {
    next.winner = role;
    next.phase = "done";
    next.turn = null;
    next.game.events.push(`${label(role)} guessed ${GW_CHARS[move.char].name} — correct!`);
    next.log.push({ by: "system", text: `${label(role)} guessed right: ${GW_CHARS[move.char].name}.` });
  } else {
    next.winner = otherRole(role);
    next.phase = "done";
    next.turn = null;
    next.game.events.push(`${label(role)} guessed ${GW_CHARS[move.char].name} — wrong!`);
    next.log.push({ by: "system", text: `${label(role)} guessed wrong — ${label(otherRole(role))} wins.` });
  }
  return { ok: true, state: next };
}

/** Best question for the AI: hardest difficulty splits the candidates closest to half. */
function bestQuestion(candidates: number[], alreadyAsked: string[]): string | null {
  let best: string | null = null;
  let bestScore = Infinity;
  for (const q of GW_QUESTIONS) {
    if (alreadyAsked.includes(q.key)) continue;
    const yes = candidates.filter((idx) => GW_CHARS[idx][q.key]).length;
    const score = Math.abs(yes - candidates.length / 2);
    if (score < bestScore) {
      bestScore = score;
      best = q.key;
    }
  }
  return best;
}

export function gwAiMove(ms: MatchState<GwState>, role: Role, difficulty: Difficulty): unknown | null {
  const g = ms.game;
  if (ms.phase === "setup") {
    if (g[secretKey(role)] !== null) return null;
    return { kind: "pick", char: Math.floor(Math.random() * GW_CHARS.length) };
  }
  if (ms.phase !== "playing" || ms.turn !== role) return null;

  const cands = g[candKey(role)];
  const asked = g[askedKey(role)];

  if (cands.length === 1) return { kind: "guess", char: cands[0] };
  if (difficulty === "easy" && cands.length <= 3 && Math.random() < 0.3) {
    return { kind: "guess", char: cands[Math.floor(Math.random() * cands.length)] };
  }

  if (difficulty === "easy") {
    const q = GW_QUESTIONS[Math.floor(Math.random() * GW_QUESTIONS.length)];
    return { kind: "ask", q: q.key };
  }
  if (difficulty === "medium") {
    const unasked = GW_QUESTIONS.filter((entry) => !asked.includes(entry.key));
    if (unasked.length === 0) return { kind: "guess", char: cands[Math.floor(Math.random() * cands.length)] };
    const q = unasked[Math.floor(Math.random() * unasked.length)];
    return { kind: "ask", q: q.key };
  }
  const q = bestQuestion(cands, asked);
  if (q === null) return { kind: "guess", char: cands[Math.floor(Math.random() * cands.length)] };
  return { kind: "ask", q };
}
