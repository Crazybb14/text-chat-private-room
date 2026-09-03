import { cloneState, otherRole, type Difficulty, type MatchState, type MoveResult, type Role } from "./types";

export interface GnGuess {
  value: number;
  result: "high" | "low" | "exact";
}

export interface GnState {
  min: number;
  max: number;
  secretP1: number | null;
  secretP2: number | null;
  guessesP1: GnGuess[];
  guessesP2: GnGuess[];
}

export const GN_RANGES: Record<Difficulty, { min: number; max: number }> = {
  easy: { min: 1, max: 50 },
  medium: { min: 1, max: 100 },
  hard: { min: 1, max: 200 },
  impossible: { min: 1, max: 500 },
};

function secretKey(role: Role): "secretP1" | "secretP2" {
  return role === "p1" ? "secretP1" : "secretP2";
}

function guessListKey(role: Role): "guessesP1" | "guessesP2" {
  return role === "p1" ? "guessesP1" : "guessesP2";
}

/** Feasible range for `role`'s guessing, narrowed by their previous feedback. */
export function gnFeasible(state: GnState, role: Role): { min: number; max: number } {
  let { min, max } = state;
  for (const g of role === "p1" ? state.guessesP1 : state.guessesP2) {
    if (g.result === "high") max = Math.min(max, g.value - 1);
    if (g.result === "low") min = Math.max(min, g.value + 1);
  }
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

export function createGn(difficulty: Difficulty): MatchState<GnState> {
  const range = GN_RANGES[difficulty] ?? GN_RANGES.medium;
  return {
    phase: "setup",
    turn: null,
    winner: null,
    game: {
      min: range.min,
      max: range.max,
      secretP1: null,
      secretP2: null,
      guessesP1: [],
      guessesP2: [],
    },
    log: [
      {
        by: "system",
        text: `Each player picks a secret number between ${range.min} and ${range.max}. Take turns guessing — first exact guess wins.`,
      },
    ],
  };
}

function isGnMove(move: unknown): move is { kind: "setSecret"; value: number } | { guess: number } {
  if (typeof move !== "object" || move === null) return false;
  const m = move as Record<string, unknown>;
  if (m.kind === "setSecret") return typeof m.value === "number";
  return typeof m.guess === "number";
}

export function applyGn(ms: MatchState<GnState>, role: Role, move: unknown): MoveResult {
  if (!isGnMove(move)) return { ok: false, error: "That isn't a valid move." };
  const g = ms.game;

  if (move.kind === "setSecret") {
    if (ms.phase !== "setup") return { ok: false, error: "Secrets are already locked in." };
    const v = Math.round(move.value);
    if (!Number.isInteger(v) || v < g.min || v > g.max) {
      return { ok: false, error: `Pick a whole number between ${g.min} and ${g.max}.` };
    }
    if (g[secretKey(role)] !== null) return { ok: false, error: "You already picked your secret." };
    const next = cloneState(ms);
    next.game[secretKey(role)] = v;
    next.log.push({ by: role, text: `${role === "p1" ? "Player 1" : "Player 2"} locked in a secret number.` });
    if (next.game.secretP1 !== null && next.game.secretP2 !== null) {
      next.phase = "playing";
      next.turn = "p1";
      next.log.push({ by: "system", text: "Both secrets are in — Player 1 guesses first." });
    }
    return { ok: true, state: next };
  }

  if (ms.phase !== "playing") {
    return { ok: false, error: "Pick your secret number first." };
  }
  if (ms.turn !== role) return { ok: false, error: "It's not your turn." };
  const v = Math.round(move.guess);
  if (!Number.isInteger(v) || v < g.min || v > g.max) {
    return { ok: false, error: `Guess a whole number between ${g.min} and ${g.max}.` };
  }
  const target = g[secretKey(otherRole(role))];
  if (target === null) return { ok: false, error: "Wait for the other player to pick their secret." };

  const next = cloneState(ms);
  if (v === target) {
    next.game[guessListKey(role)].push({ value: v, result: "exact" });
    next.winner = role;
    next.phase = "done";
    next.turn = null;
    next.log.push({ by: role, text: `Guessed ${v} — exact!` });
    next.log.push({ by: "system", text: `${role === "p1" ? "Player 1" : "Player 2"} cracked it.` });
  } else {
    const result: "high" | "low" = v > target ? "high" : "low";
    next.game[guessListKey(role)].push({ value: v, result });
    next.log.push({ by: role, text: `Guessed ${v} — too ${result}.` });
    next.turn = otherRole(role);
  }
  return { ok: true, state: next };
}

export function gnAiMove(ms: MatchState<GnState>, role: Role, difficulty: Difficulty): unknown | null {
  const g = ms.game;
  if (ms.phase === "setup") {
    if (g[secretKey(role)] !== null) return null;
    const range = { min: g.min, max: g.max };
    return { kind: "setSecret", value: range.min + Math.floor(Math.random() * (range.max - range.min + 1)) };
  }
  if (ms.phase !== "playing" || ms.turn !== role) return null;

  const { min, max } = gnFeasible(g, role);
  const midpoint = Math.floor((min + max) / 2);
  const inRange = (v: number): number => Math.max(g.min, Math.min(g.max, v));
  const rand = (): number => min + Math.floor(Math.random() * Math.max(1, max - min + 1));

  if (difficulty === "easy") {
    return { guess: inRange(g.min + Math.floor(Math.random() * (g.max - g.min + 1))) };
  }
  if (difficulty === "medium") {
    if (Math.random() < 0.25) return { guess: inRange(rand()) };
    return { guess: inRange(midpoint + (Math.random() < 0.2 ? 1 : 0)) };
  }
  if (difficulty === "hard") {
    if (Math.random() < 0.08) return { guess: inRange(midpoint + Math.floor(Math.random() * 5) - 2) };
    return { guess: midpoint };
  }
  return { guess: midpoint };
}
