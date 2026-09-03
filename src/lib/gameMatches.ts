import db from "@/lib/shared/kliv-database.js";
import {
  applyGameMove,
  computeAiMove,
  createMatchState,
  gameName,
  parseStoredState,
  type Difficulty,
  type GameType,
  type MatchState,
  type Role,
} from "./games";

export interface GameMatchRow {
  _row_id: number;
  game_type: GameType;
  mode: "ai" | "multiplayer";
  difficulty: Difficulty | null;
  player1: string;
  player2: string | null;
  status: "open" | "active" | "finished";
  state: string;
  turn: Role | null;
  winner: Role | "draw" | null;
  last_move_at: number | null;
}

export interface GameChatRow {
  _row_id: number;
  match_id: number;
  sender: string;
  text: string;
}

export function aiPlayerName(difficulty: Difficulty): string {
  return `AI (${difficulty})`;
}

export function roleFor(row: GameMatchRow, username: string): Role | null {
  if (row.player1 === username) return "p1";
  if (row.player2 === username) return "p2";
  return null;
}

export function parseMatchState(row: GameMatchRow): MatchState<unknown> {
  try {
    return parseStoredState(JSON.parse(row.state));
  } catch {
    return parseStoredState(null);
  }
}

/** True when the bot in an AI match owes the next move or a setup choice. */
export function needsAiMove(row: GameMatchRow): boolean {
  if (row.mode !== "ai" || row.status !== "active") return false;
  const ms = parseMatchState(row);
  if (ms.phase === "setup") {
    return computeAiMove(row.game_type, ms, "p2", row.difficulty ?? "medium") !== null;
  }
  return ms.phase === "playing" && ms.turn === "p2";
}

export async function fetchMatches(): Promise<GameMatchRow[]> {
  const rows = await db.query<GameMatchRow & Record<string, unknown>>("game_matches", {});
  return rows
    .filter((r) => typeof r.game_type === "string")
    .sort((a, b) => (b.last_move_at ?? 0) - (a.last_move_at ?? 0));
}

export function myMatches(rows: GameMatchRow[], username: string): GameMatchRow[] {
  return rows.filter((r) => r.player1 === username || r.player2 === username);
}

export function openChallenges(rows: GameMatchRow[], username: string): GameMatchRow[] {
  return rows.filter((r) => r.status === "open" && r.mode === "multiplayer" && r.player1 !== username);
}

export async function createMatch(opts: {
  gameType: GameType;
  mode: "ai" | "multiplayer";
  difficulty: Difficulty;
  username: string;
  opponent?: string;
}): Promise<GameMatchRow> {
  const ms = createMatchState(opts.gameType, opts.difficulty);
  const againstAi = opts.mode === "ai";
  const opponent = againstAi
    ? aiPlayerName(opts.difficulty)
    : opts.opponent && opts.opponent.trim().length > 0
      ? opts.opponent.trim()
      : null;
  const row = await db.insertOne<GameMatchRow & Record<string, unknown>>("game_matches", {
    game_type: opts.gameType,
    mode: opts.mode,
    difficulty: opts.difficulty,
    player1: opts.username,
    player2: opponent,
    status: opponent ? "active" : "open",
    state: JSON.stringify(ms),
    turn: ms.turn,
    winner: null,
    last_move_at: Date.now(),
  });
  return row as GameMatchRow;
}

export async function joinMatch(rowId: number, username: string): Promise<void> {
  await db.updateOne("game_matches", { _row_id: `eq.${rowId}` }, { player2: username, status: "active", last_move_at: Date.now() });
}

export type SubmitOutcome = { ok: true; row: GameMatchRow } | { ok: false; error: string };

export async function submitMove(row: GameMatchRow, username: string, move: unknown): Promise<SubmitOutcome> {
  const role = roleFor(row, username);
  if (!role) return { ok: false, error: "You're not a player in this match." };
  const ms = parseMatchState(row);
  const difficulty: Difficulty = (row.difficulty ?? "medium") as Difficulty;
  const result = applyGameMove(row.game_type, ms, role, move, difficulty);
  if (!result.ok) return { ok: false, error: result.error };
  const updated = await db.updateOne<GameMatchRow & Record<string, unknown>>(
    "game_matches",
    { _row_id: `eq.${row._row_id}` },
    {
      state: JSON.stringify(result.state),
      turn: result.state.turn,
      winner: result.state.winner,
      status: result.state.phase === "done" ? "finished" : "active",
      last_move_at: Date.now(),
    },
  );
  return { ok: true, row: updated as GameMatchRow };
}

/** Plays the bot's move in an AI match. */
export async function submitAiMove(row: GameMatchRow): Promise<SubmitOutcome> {
  if (row.mode !== "ai" || row.status !== "active") return { ok: false, error: "This match isn't against the AI." };
  const ms = parseMatchState(row);
  const difficulty: Difficulty = (row.difficulty ?? "medium") as Difficulty;
  if (ms.phase !== "setup" && ms.phase !== "playing") return { ok: false, error: "This game is over." };
  const move = computeAiMove(row.game_type, ms, "p2", difficulty);
  if (move === null) return { ok: false, error: "The AI has no move to make." };
  const result = applyGameMove(row.game_type, ms, "p2", move, difficulty);
  if (!result.ok) return { ok: false, error: result.error };
  const updated = await db.updateOne<GameMatchRow & Record<string, unknown>>(
    "game_matches",
    { _row_id: `eq.${row._row_id}` },
    {
      state: JSON.stringify(result.state),
      turn: result.state.turn,
      winner: result.state.winner,
      status: result.state.phase === "done" ? "finished" : "active",
      last_move_at: Date.now(),
    },
  );
  return { ok: true, row: updated as GameMatchRow };
}

export async function resignMatch(row: GameMatchRow, username: string): Promise<void> {
  const role = roleFor(row, username);
  const ms = parseMatchState(row);
  ms.phase = "done";
  ms.turn = null;
  ms.winner = role === "p2" ? "p1" : "p2";
  ms.log.push({ by: "system", text: `${username} resigned.` });
  await db.updateOne(
    "game_matches",
    { _row_id: `eq.${row._row_id}` },
    {
      state: JSON.stringify(ms),
      turn: null,
      winner: ms.winner,
      status: "finished",
      last_move_at: Date.now(),
    },
  );
}

export async function listChat(matchId: number): Promise<GameChatRow[]> {
  const rows = await db.query<GameChatRow & Record<string, unknown>>("game_chat", { match_id: `eq.${matchId}` });
  return rows.sort((a, b) => a._row_id - b._row_id);
}

export async function sendChat(matchId: number, sender: string, text: string): Promise<void> {
  const trimmed = text.trim().slice(0, 500);
  if (!trimmed) return;
  await db.insertOne("game_chat", { match_id: matchId, sender, text: trimmed });
}

/** Recent side-chat lines across every match — for the admin monitor view. */
export async function fetchRecentGameChat(limit = 40): Promise<GameChatRow[]> {
  const rows = await db.query<GameChatRow & Record<string, unknown>>("game_chat", {});
  return rows.sort((a, b) => b._row_id - a._row_id).slice(0, limit);
}

export function describeOutcome(row: GameMatchRow, username: string): string {
  const ms = parseMatchState(row);
  if (row.status === "open") return "Waiting for an opponent to join";
  if (row.status === "finished" || ms.phase === "done") {
    if (ms.winner === "draw") return "Draw";
    if (ms.winner) {
      const winnerName = ms.winner === "p1" ? row.player1 : row.player2 ?? "the AI";
      return winnerName === username ? "You won" : `${winnerName} won`;
    }
    return "Finished";
  }
  if (ms.phase === "setup") {
    const role = roleFor(row, username);
    if (role === "p1" && ms.game && setupDone(ms, "p1")) return "Waiting on the other player's setup";
    return "Set up your side to start";
  }
  const role = roleFor(row, username);
  if (ms.turn && role && ms.turn === role) return "Your turn";
  const other = ms.turn === "p1" ? row.player1 : row.player2 ?? "the AI";
  return `${other === username ? "You" : other} to move`;
}

function setupDone(ms: MatchState<unknown>, role: Role): boolean {
  const g = ms.game as Record<string, unknown> | null;
  if (!g || typeof g !== "object") return false;
  if ("secretP1" in g && role === "p1") return g.secretP1 !== null;
  if ("secretP2" in g && role === "p2") return g.secretP2 !== null;
  if ("placed1" in g && role === "p1") return g.placed1 === true;
  if ("placed2" in g && role === "p2") return g.placed2 === true;
  return false;
}

export function matchTitle(row: GameMatchRow): string {
  const info = gameName(row.game_type);
  if (row.mode === "ai") return `${info} vs AI`;
  return info;
}
