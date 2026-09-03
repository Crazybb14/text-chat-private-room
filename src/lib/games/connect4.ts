import { cloneState, otherRole, type Difficulty, type MatchState, type MoveResult, type Role } from "./types";

export const C4_COLS = 7;
export const C4_ROWS = 6;

export interface C4State {
  board: (Role | null)[]; // row-major, index 0 is the TOP row
}

function dropRow(board: (Role | null)[], col: number): number | null {
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    if (board[r * C4_COLS + col] === null) return r;
  }
  return null;
}

export function c4ValidCols(board: (Role | null)[]): number[] {
  const out: number[] = [];
  for (let c = 0; c < C4_COLS; c++) if (dropRow(board, c) !== null) out.push(c);
  return out;
}

export function c4WinnerCells(board: (Role | null)[]): { winner: Role | null; cells: number[] } {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const start = r * C4_COLS + c;
      const v = board[start];
      if (!v) continue;
      for (const [dr, dc] of dirs) {
        const cells = [start];
        let ok = true;
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= C4_ROWS || cc < 0 || cc >= C4_COLS || board[rr * C4_COLS + cc] !== v) {
            ok = false;
            break;
          }
          cells.push(rr * C4_COLS + cc);
        }
        if (ok) return { winner: v, cells };
      }
    }
  }
  return { winner: null, cells: [] };
}

function evalWindow(window: (Role | null)[], me: Role): number {
  const opp = otherRole(me);
  const mine = window.filter((v) => v === me).length;
  const theirs = window.filter((v) => v === opp).length;
  if (mine && theirs) return 0;
  if (mine === 3) return 60;
  if (mine === 2) return 8;
  if (mine === 1) return 2;
  if (theirs === 3) return -70;
  if (theirs === 2) return -10;
  if (theirs === 1) return -2;
  return 0;
}

function evaluate(board: (Role | null)[], me: Role): number {
  let score = 0;
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      if (board[r * C4_COLS + c] === me && c === 3) score += 6;
    }
  }
  // horizontal
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c + 3 < C4_COLS; c++) {
      score += evalWindow([board[r * C4_COLS + c], board[r * C4_COLS + c + 1], board[r * C4_COLS + c + 2], board[r * C4_COLS + c + 3]], me);
    }
  }
  // vertical
  for (let c = 0; c < C4_COLS; c++) {
    for (let r = 0; r + 3 < C4_ROWS; r++) {
      score += evalWindow([board[r * C4_COLS + c], board[(r + 1) * C4_COLS + c], board[(r + 2) * C4_COLS + c], board[(r + 3) * C4_COLS + c]], me);
    }
  }
  // diagonals
  for (let r = 0; r + 3 < C4_ROWS; r++) {
    for (let c = 0; c + 3 < C4_COLS; c++) {
      score += evalWindow([board[r * C4_COLS + c], board[(r + 1) * C4_COLS + c + 1], board[(r + 2) * C4_COLS + c + 2], board[(r + 3) * C4_COLS + c + 3]], me);
      score += evalWindow([board[(r + 3) * C4_COLS + c], board[(r + 2) * C4_COLS + c + 1], board[(r + 1) * C4_COLS + c + 2], board[r * C4_COLS + c + 3]], me);
    }
  }
  return score;
}

const COL_ORDER = [3, 2, 4, 1, 5, 0, 6];

function search(board: (Role | null)[], depth: number, turn: Role, me: Role, alpha: number, beta: number): number {
  const { winner } = c4WinnerCells(board);
  if (winner) {
    if (winner === "draw") return 0;
    return winner === me ? 100000 - (10 - depth) : -100000 + (10 - depth);
  }
  if (depth === 0) return evaluate(board, me);
  const cols = COL_ORDER.filter((c) => dropRow(board, c) !== null);
  if (cols.length === 0) return 0;
  if (turn === me) {
    let best = -Infinity;
    for (const c of cols) {
      const r = dropRow(board, c) as number;
      board[r * C4_COLS + c] = turn;
      const s = search(board, depth - 1, otherRole(turn), me, alpha, beta);
      board[r * C4_COLS + c] = null;
      best = Math.max(best, s);
      alpha = Math.max(alpha, s);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const c of cols) {
    const r = dropRow(board, c) as number;
    board[r * C4_COLS + c] = turn;
    const s = search(board, depth - 1, otherRole(turn), me, alpha, beta);
    board[r * C4_COLS + c] = null;
    best = Math.min(best, s);
    beta = Math.min(beta, s);
    if (beta <= alpha) break;
  }
  return best;
}

function bestColumn(board: (Role | null)[], me: Role, depth: number): number | null {
  const cols = COL_ORDER.filter((c) => dropRow(board, c) !== null);
  if (cols.length === 0) return null;
  let best = cols[0];
  let bestScore = -Infinity;
  for (const c of cols) {
    const r = dropRow(board, c) as number;
    board[r * C4_COLS + c] = me;
    const s = search(board, depth - 1, otherRole(me), me, -Infinity, Infinity);
    board[r * C4_COLS + c] = null;
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best;
}

function immediateThreat(board: (Role | null)[], role: Role): number | null {
  for (const c of c4ValidCols(board)) {
    const r = dropRow(board, c) as number;
    board[r * C4_COLS + c] = role;
    const w = c4WinnerCells(board).winner;
    board[r * C4_COLS + c] = null;
    if (w === role) return c;
  }
  return null;
}

export function createC4(): MatchState<C4State> {
  return {
    phase: "playing",
    turn: "p1",
    winner: null,
    game: { board: Array<Role | null>(C4_ROWS * C4_COLS).fill(null) },
    log: [{ by: "system", text: "Drop discs in a column — first to connect four wins." }],
  };
}

export function applyC4(ms: MatchState<C4State>, role: Role, move: unknown): MoveResult {
  if (ms.phase !== "playing") return { ok: false, error: "This game is over." };
  if (ms.turn !== role) return { ok: false, error: "It's not your turn." };
  if (typeof move !== "number" || !Number.isInteger(move) || move < 0 || move >= C4_COLS) {
    return { ok: false, error: "Pick a column to drop into." };
  }
  const row = dropRow(ms.game.board, move);
  if (row === null) return { ok: false, error: "That column is full." };

  const next = cloneState(ms);
  next.game.board[row * C4_COLS + move] = role;
  next.log.push({ by: role, text: `${role === "p1" ? "Red" : "Yellow"} dropped in column ${move + 1}.` });

  const { winner } = c4WinnerCells(next.game.board);
  if (winner) {
    next.winner = winner;
    next.phase = "done";
    next.turn = null;
    next.log.push({ by: "system", text: `${winner === "p1" ? "Red" : "Yellow"} connected four!` });
  } else if (c4ValidCols(next.game.board).length === 0) {
    next.winner = "draw";
    next.phase = "done";
    next.turn = null;
    next.log.push({ by: "system", text: "The board filled up — it's a draw." });
  } else {
    next.turn = otherRole(role);
  }
  return { ok: true, state: next };
}

export function c4AiMove(ms: MatchState<C4State>, role: Role, difficulty: Difficulty): number | null {
  if (ms.phase !== "playing" || ms.turn !== role) return null;
  const board = ms.game.board;
  const opp = otherRole(role);
  const valid = c4ValidCols(board);
  if (valid.length === 0) return null;
  const rand = (): number => valid[Math.floor(Math.random() * valid.length)];

  if (difficulty === "easy") return rand();
  if (difficulty === "medium") {
    const win = immediateThreat(board, role);
    if (win !== null) return win;
    const block = immediateThreat(board, opp);
    if (block !== null && Math.random() < 0.75) return block;
    return rand();
  }
  const depth = difficulty === "hard" ? 3 : 6;
  // Never miss a win or an obvious block regardless of search depth.
  const win = immediateThreat(board, role);
  if (win !== null) return win;
  const block = immediateThreat(board, opp);
  if (block !== null) return block;
  const scratch = [...board];
  const choice = bestColumn(scratch, role, depth);
  return choice ?? rand();
}
