import type { Difficulty, GameType, MatchState, MoveResult, Role } from "./types";
import { DIFFICULTIES } from "./types";
import { applyTtt, createTtt, tttAiMove, type TttState } from "./tictactoe";
import { applyC4, c4AiMove, createC4, type C4State } from "./connect4";
import { applyGn, createGn, gnAiMove, type GnState } from "./guessNumber";
import { applyBs, bsAiMove, createBs, type BsStateFull } from "./battleship";
import { applyGw, createGw, gwAiMove, type GwState } from "./guessWho";
import { applyHm, createHm, hmAiMove, type HmState } from "./hangman";
import { applyT3, createT3, t3AiMove, type T3State } from "./tictactoe3d";

export { DIFFICULTIES };
export type { Difficulty, GameType, MatchState, MoveResult, Role };
export type { TttState, C4State, GnState, BsStateFull, GwState, HmState, T3State };

export interface GameInfo {
  type: GameType;
  name: string;
  blurb: string;
  dimension: "2D" | "3D";
  /** How many people a match needs. */
  players: 2;
}

export const GAME_CATALOG: GameInfo[] = [
  { type: "tictactoe", name: "Tic Tac Toe", blurb: "Three in a row — simple, fast, sneaky.", dimension: "2D", players: 2 },
  { type: "connect4", name: "4 in a Row", blurb: "Drop discs and connect four before they do.", dimension: "2D", players: 2 },
  { type: "guessnumber", name: "Guess the Number", blurb: "Hide a number, crack theirs first.", dimension: "2D", players: 2 },
  { type: "battleship", name: "Battleship", blurb: "Hide your fleet, hunt theirs.", dimension: "2D", players: 2 },
  { type: "guesswho", name: "Guess Who", blurb: "Yes/no questions to find the mystery person.", dimension: "2D", players: 2 },
  { type: "hangman", name: "Hangman", blurb: "Take turns revealing the hidden word.", dimension: "2D", players: 2 },
  { type: "tictactoe3d", name: "3D Tic Tac Toe", blurb: "A three-layer cube — lines count through layers.", dimension: "3D", players: 2 },
];

export function gameInfo(type: GameType): GameInfo {
  return GAME_CATALOG.find((g) => g.type === type) ?? GAME_CATALOG[0];
}

export function gameName(type: GameType): string {
  return gameInfo(type).name;
}

interface EngineBox {
  create: (difficulty: Difficulty) => MatchState<unknown>;
  apply: (ms: MatchState<unknown>, role: Role, move: unknown, difficulty: Difficulty) => MoveResult;
  aiMove: (ms: MatchState<unknown>, role: Role, difficulty: Difficulty) => unknown | null;
}

function asUnknown<S>(ms: MatchState<S>): MatchState<unknown> {
  return ms as unknown as MatchState<unknown>;
}

const ENGINES: Record<GameType, EngineBox> = {
  tictactoe: {
    create: () => asUnknown(createTtt()),
    apply: (ms, role, move) => applyTtt(ms as unknown as MatchState<TttState>, role, move),
    aiMove: (ms, role, d) => tttAiMove(ms as unknown as MatchState<TttState>, role, d),
  },
  connect4: {
    create: () => asUnknown(createC4()),
    apply: (ms, role, move) => applyC4(ms as unknown as MatchState<C4State>, role, move),
    aiMove: (ms, role, d) => c4AiMove(ms as unknown as MatchState<C4State>, role, d),
  },
  guessnumber: {
    create: (d) => asUnknown(createGn(d)),
    apply: (ms, role, move) => applyGn(ms as unknown as MatchState<GnState>, role, move),
    aiMove: (ms, role, d) => gnAiMove(ms as unknown as MatchState<GnState>, role, d),
  },
  battleship: {
    create: () => asUnknown(createBs()),
    apply: (ms, role, move) => applyBs(ms as unknown as MatchState<BsStateFull>, role, move),
    aiMove: (ms, role, d) => bsAiMove(ms as unknown as MatchState<BsStateFull>, role, d),
  },
  guesswho: {
    create: () => asUnknown(createGw()),
    apply: (ms, role, move) => applyGw(ms as unknown as MatchState<GwState>, role, move),
    aiMove: (ms, role, d) => gwAiMove(ms as unknown as MatchState<GwState>, role, d),
  },
  hangman: {
    create: (d) => asUnknown(createHm(d)),
    apply: (ms, role, move, d) => applyHm(ms as unknown as MatchState<HmState>, role, move, d),
    aiMove: (ms, role, d) => hmAiMove(ms as unknown as MatchState<HmState>, role, d),
  },
  tictactoe3d: {
    create: () => asUnknown(createT3()),
    apply: (ms, role, move) => applyT3(ms as unknown as MatchState<T3State>, role, move),
    aiMove: (ms, role, d) => t3AiMove(ms as unknown as MatchState<T3State>, role, d),
  },
};

export function createMatchState(type: GameType, difficulty: Difficulty): MatchState<unknown> {
  return ENGINES[type].create(difficulty);
}

export function applyGameMove(type: GameType, ms: MatchState<unknown>, role: Role, move: unknown, difficulty: Difficulty): MoveResult {
  return ENGINES[type].apply(ms, role, move, difficulty);
}

export function computeAiMove(type: GameType, ms: MatchState<unknown>, role: Role, difficulty: Difficulty): unknown | null {
  return ENGINES[type].aiMove(ms, role, difficulty);
}

/** Defensive parse of whatever JSON is stored in a match row. */
export function parseStoredState(raw: unknown): MatchState<unknown> {
  if (typeof raw === "object" && raw !== null) {
    const ms = raw as MatchState<unknown>;
    if (
      (ms.phase === "setup" || ms.phase === "playing" || ms.phase === "done") &&
      typeof ms.game === "object" &&
      ms.game !== null &&
      Array.isArray(ms.log)
    ) {
      return ms;
    }
  }
  return { phase: "done", turn: null, winner: "draw", game: null, log: [] };
}
