import { cloneState, otherRole, roleMark, type Difficulty, type MatchState, type MoveResult, type Role } from "./types";

/** 27 cells: index = layer * 9 + row * 3 + col (layer 0 bottom). */
export interface T3State {
  board: (Role | null)[];
}

function buildLines(): number[][] {
  const dirs: [number, number, number][] = [];
  for (let dl = -1; dl <= 1; dl++) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dl === 0 && dr === 0 && dc === 0) continue;
        // keep one of each opposite pair: lexicographically positive
        if (dl < 0) continue;
        if (dl === 0 && dr < 0) continue;
        if (dl === 0 && dr === 0 && dc < 0) continue;
        dirs.push([dl, dr, dc]);
      }
    }
  }
  const lines: number[][] = [];
  for (let l = 0; l < 3; l++) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        for (const [dl, dr, dc] of dirs) {
          const l2 = l + dl * 2;
          const r2 = r + dr * 2;
          const c2 = c + dc * 2;
          if (l2 < 0 || l2 > 2 || r2 < 0 || r2 > 2 || c2 < 0 || c2 > 2) continue;
          lines.push([l * 9 + r * 3 + c, (l + dl) * 9 + (r + dr) * 3 + (c + dc), l2 * 9 + r2 * 3 + c2]);
        }
      }
    }
  }
  return lines;
}

export const T3_LINES: number[][] = buildLines();

export function t3WinnerLine(board: (Role | null)[]): number[] | null {
  for (const line of T3_LINES) {
    const [a, b, c] = line;
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return line;
  }
  return null;
}

function emptyCells(board: (Role | null)[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 27; i++) if (!board[i]) out.push(i);
  return out;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function evaluate(board: (Role | null)[], me: Role): number {
  const opp = otherRole(me);
  let score = 0;
  for (const line of T3_LINES) {
    let mine = 0;
    let theirs = 0;
    for (const i of line) {
      const v = board[i];
      if (v === me) mine++;
      else if (v === opp) theirs++;
    }
    if (mine && !theirs) score += mine * mine;
    if (theirs && !mine) score -= theirs * theirs * 1.1;
  }
  if (board[13] === me) score += 4;
  else if (board[13] === opp) score -= 4;
  return score;
}

interface Budget {
  nodes: number;
}

function search(board: (Role | null)[], depth: number, turn: Role, me: Role, alpha: number, beta: number, budget: Budget): number {
  const line = t3WinnerLine(board);
  if (line) {
    const w = board[line[0]] as Role;
    return w === me ? 10000 + depth : -10000 - depth;
  }
  if (budget.nodes <= 0 || depth === 0) return evaluate(board, me);
  const empty = emptyCells(board);
  if (empty.length === 0) return 0;

  // move ordering: center first
  empty.sort((a, b) => Math.abs(a - 13) - Math.abs(b - 13));

  if (turn === me) {
    let best = -Infinity;
    for (const cell of empty) {
      budget.nodes--;
      board[cell] = turn;
      const s = search(board, depth - 1, otherRole(turn), me, alpha, beta, budget);
      board[cell] = null;
      best = Math.max(best, s);
      alpha = Math.max(alpha, s);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const cell of empty) {
    budget.nodes--;
    board[cell] = turn;
    const s = search(board, depth - 1, otherRole(turn), me, alpha, beta, budget);
    board[cell] = null;
    best = Math.min(best, s);
    beta = Math.min(beta, s);
    if (beta <= alpha) break;
  }
  return best;
}

function winningCell(board: (Role | null)[], role: Role): number | null {
  for (const line of T3_LINES) {
    const vals = line.map((i) => board[i]);
    const own = vals.filter((v) => v === role).length;
    const free = vals.filter((v) => v === null).length;
    if (own === 2 && free === 1) return line[vals.indexOf(null)];
  }
  return null;
}

export function createT3(): MatchState<T3State> {
  return {
    phase: "playing",
    turn: "p1",
    winner: null,
    game: { board: Array<Role | null>(27).fill(null) },
    log: [{ by: "system", text: "Three stacked boards — any straight line of three wins, even through the layers." }],
  };
}

export function applyT3(ms: MatchState<T3State>, role: Role, move: unknown): MoveResult {
  if (ms.phase !== "playing") return { ok: false, error: "This game is over." };
  if (ms.turn !== role) return { ok: false, error: "It's not your turn." };
  if (typeof move !== "number" || !Number.isInteger(move) || move < 0 || move > 26) {
    return { ok: false, error: "Pick a spot on the cube." };
  }
  if (ms.game.board[move]) return { ok: false, error: "That spot is taken." };

  const next = cloneState(ms);
  next.game.board[move] = role;
  const layer = Math.floor(move / 9) + 1;
  const spot = (move % 9) + 1;
  next.log.push({ by: role, text: `${roleMark(role)} took board ${layer}, spot ${spot}.` });

  const line = t3WinnerLine(next.game.board);
  if (line) {
    next.winner = role;
    next.phase = "done";
    next.turn = null;
    next.log.push({ by: "system", text: `${roleMark(role)} made a line of three!` });
  } else if (emptyCells(next.game.board).length === 0) {
    next.winner = "draw";
    next.phase = "done";
    next.turn = null;
    next.log.push({ by: "system", text: "The cube filled up — it's a draw." });
  } else {
    next.turn = otherRole(role);
  }
  return { ok: true, state: next };
}

export function t3AiMove(ms: MatchState<T3State>, role: Role, difficulty: Difficulty): number | null {
  if (ms.phase !== "playing" || ms.turn !== role) return null;
  const board = ms.game.board;
  const empty = emptyCells(board);
  if (empty.length === 0) return null;
  const opp = otherRole(role);

  if (difficulty === "easy") return pick(empty);

  const win = winningCell(board, role);
  if (win !== null) return win;

  if (difficulty === "medium") {
    const block = winningCell(board, opp);
    if (block !== null) return block;
    if (!board[13]) return 13;
    return pick(empty);
  }

  const block = winningCell(board, opp);
  if (block !== null) return block;

  const depth = difficulty === "hard" ? 3 : 4;
  const budget: Budget = { nodes: difficulty === "hard" ? 120000 : 350000 };
  const scratch = [...board];
  let best = empty[0];
  let bestScore = -Infinity;
  const ordered = [...empty].sort((a, b) => Math.abs(a - 13) - Math.abs(b - 13));
  for (const cell of ordered) {
    scratch[cell] = role;
    const s = search(scratch, depth - 1, otherRole(role), role, -Infinity, Infinity, budget);
    scratch[cell] = null;
    if (s > bestScore) {
      bestScore = s;
      best = cell;
    }
    if (budget.nodes <= 0) break;
  }
  return best;
}
