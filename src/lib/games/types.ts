/** Shared vocabulary for every game engine in this folder. */
export type Difficulty = "easy" | "medium" | "hard" | "impossible";
export type Role = "p1" | "p2";
export type WinState = Role | "draw" | null;
export type GameType =
  | "tictactoe"
  | "connect4"
  | "guessnumber"
  | "battleship"
  | "guesswho"
  | "hangman"
  | "tictactoe3d";

export interface LogLine {
  by: Role | "system";
  text: string;
}

/**
 * Every game wraps its own board data in this envelope so the match helper,
 * the boards and the AI driver can treat all games the same way.
 */
export interface MatchState<S = unknown> {
  phase: "setup" | "playing" | "done";
  turn: Role | null;
  winner: WinState;
  game: S;
  log: LogLine[];
}

export type MoveResult =
  | { ok: true; state: MatchState<unknown> }
  | { ok: false; error: string };

export function otherRole(r: Role): Role {
  return r === "p1" ? "p2" : "p1";
}

export function cloneState<S>(ms: MatchState<S>): MatchState<S> {
  return JSON.parse(JSON.stringify(ms)) as MatchState<S>;
}

export function roleMark(r: Role): string {
  return r === "p1" ? "X" : "O";
}

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "impossible"];
