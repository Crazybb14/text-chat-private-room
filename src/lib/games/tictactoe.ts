import { cloneState, otherRole, roleMark, type Difficulty, type MatchState, type MoveResult, type Role } from "./types";

export interface TttState {
  board: (Role | null)[];
}

export const TTT_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function tttWinnerLine(board: (Role | null)[]): number[] | null {
  for (const line of TTT_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return line;
  }
  return null;
}

function emptyCells(board: (Role | null)[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 9; i++) if (!board[i]) out.push(i);
  return out;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Perfect play via minimax — never loses. */
function minimax(board: (Role | null)[], me: Role, turn: Role, alpha: number, beta: number): { score: number; move: number } {
  const line = tttWinnerLine(board);
  if (line) {
    const w = board[line[0]] as Role;
    return { score: w === me ? 1 : -1, move: -1 };
  }
  const empty = emptyCells(board);
  if (empty.length === 0) return { score: 0, move: -1 };

  let bestScore = turn === me ? -2 : 2;
  let bestMove = empty[0];
  for (const cell of empty) {
    board[cell] = turn;
    const s = minimax(board, me, otherRole(turn), alpha, beta).score;
    board[cell] = null;
    if (turn === me) {
      if (s > bestScore) {
        bestScore = s;
        bestMove = cell;
      }
      alpha = Math.max(alpha, s);
    } else {
      if (s < bestScore) {
        bestScore = s;
        bestMove = cell;
      }
      beta = Math.min(beta, s);
    }
    if (beta <= alpha) break;
  }
  return { score: bestScore, move: bestMove };
}

function immediateWin(board: (Role | null)[], role: Role): number | null {
  for (const line of TTT_LINES) {
    const vals = line.map((i) => board[i]);
    const own = vals.filter((v) => v === role).length;
    const free = vals.filter((v) => v === null).length;
    if (own === 2 && free === 1) return line[vals.indexOf(null)];
  }
  return null;
}

export function createTtt(): MatchState<TttState> {
  return {
    phase: "playing",
    turn: "p1",
    winner: null,
    game: { board: Array<Role | null>(9).fill(null) },
    log: [{ by: "system", text: "X moves first — three in a row wins." }],
  };
}

export function applyTtt(ms: MatchState<TttState>, role: Role, move: unknown): MoveResult {
  if (ms.phase !== "playing") return { ok: false, error: "This game is over." };
  if (ms.turn !== role) return { ok: false, error: "It's not your turn." };
  if (typeof move !== "number" || !Number.isInteger(move) || move < 0 || move > 8) {
    return { ok: false, error: "Pick a square on the board." };
  }
  if (ms.game.board[move]) return { ok: false, error: "That square is already taken." };

  const next = cloneState(ms);
  next.game.board[move] = role;
  next.log.push({ by: role, text: `${roleMark(role)} took square ${move + 1}.` });

  const line = tttWinnerLine(next.game.board);
  if (line) {
    next.winner = role;
    next.phase = "done";
    next.turn = null;
    next.log.push({ by: "system", text: `${roleMark(role)} wins!` });
  } else if (emptyCells(next.game.board).length === 0) {
    next.winner = "draw";
    next.phase = "done";
    next.turn = null;
    next.log.push({ by: "system", text: "It's a draw." });
  } else {
    next.turn = otherRole(role);
  }
  return { ok: true, state: next };
}

export function tttAiMove(ms: MatchState<TttState>, role: Role, difficulty: Difficulty): number | null {
  if (ms.phase !== "playing" || ms.turn !== role) return null;
  const board = ms.game.board;
  const empty = emptyCells(board);
  if (empty.length === 0) return null;
  const opp = otherRole(role);

  if (difficulty === "easy") {
    return pick(empty);
  }
  if (difficulty === "medium") {
    if (Math.random() < 0.45) {
      const win = immediateWin(board, role) ?? immediateWin(board, opp);
      if (win !== null) return win;
    }
    return pick(empty);
  }
  if (difficulty === "hard") {
    const win = immediateWin(board, role) ?? immediateWin(board, opp);
    if (win !== null) return win;
    if (!board[4]) return 4;
    const corner = [0, 2, 6, 8].filter((i) => !board[i]);
    if (corner.length > 0 && Math.random() < 0.8) return pick(corner);
    return pick(empty);
  }
  // impossible: full minimax
  const scratch = [...board];
  const { move } = minimax(scratch, role, role, -2, 2);
  return move >= 0 ? move : pick(empty);
}
