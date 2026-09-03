import { cloneState, otherRole, type Difficulty, type MatchState, type MoveResult, type Role } from "./types";

export const BS_SIZE = 10;

export interface BsShipDef {
  name: string;
  size: number;
}

export const BS_FLEET: BsShipDef[] = [
  { name: "Carrier", size: 5 },
  { name: "Battleship", size: 4 },
  { name: "Cruiser", size: 3 },
  { name: "Submarine", size: 3 },
  { name: "Destroyer", size: 2 },
];

export interface BsShip {
  name: string;
  size: number;
  cells: number[]; // 0-99
  hits: number[];
}

export interface BsSide {
  ships: BsShip[];
  incoming: Record<string, "hit" | "miss">; // shots fired AT this side
}

export interface BsState {
  p1: BsSide;
  p2: BsSide;
  placed1: boolean;
  placed2: boolean;
}

export interface BsFireResult {
  by: Role;
  cell: number;
  result: "hit" | "miss" | "sunk";
  ship?: string;
}

export interface BsStateFull extends BsState {
  lastShot?: BsFireResult;
}

const cellKey = (cell: number): string => String(cell);

export function bsShipCells(row: number, col: number, size: number, horizontal: boolean): number[] {
  const cells: number[] = [];
  for (let k = 0; k < size; k++) {
    const r = horizontal ? row : row + k;
    const c = horizontal ? col + k : col;
    if (r < 0 || r >= BS_SIZE || c < 0 || c >= BS_SIZE) return [];
    cells.push(r * BS_SIZE + c);
  }
  return cells;
}

export function bsSunk(ship: BsShip): boolean {
  return ship.hits.length >= ship.size;
}

export function bsAllSunk(side: BsSide): boolean {
  return side.ships.length > 0 && side.ships.every(bsSunk);
}

function validatePlacement(ships: BsShip[]): string | null {
  if (ships.length !== BS_FLEET.length) return "Place all five ships.";
  const remaining = [...BS_FLEET];
  const seen = new Set<number>();
  for (const ship of ships) {
    const idx = remaining.findIndex((d) => d.name === ship.name && d.size === ship.size);
    if (idx === -1) return `Unexpected ship: ${ship.name}.`;
    remaining.splice(idx, 1);
    if (!Array.isArray(ship.cells) || ship.cells.length !== ship.size) return `${ship.name} isn't the right length.`;
    for (const cell of ship.cells) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= BS_SIZE * BS_SIZE) return `${ship.name} is off the grid.`;
      if (seen.has(cell)) return "Ships can't overlap.";
      seen.add(cell);
    }
  }
  return null;
}

/** Random but always-valid fleet. */
export function bsAutoPlace(): BsShip[] {
  const ships: BsShip[] = [];
  const taken = new Set<number>();
  for (const def of BS_FLEET) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const horizontal = Math.random() < 0.5;
      const row = Math.floor(Math.random() * BS_SIZE);
      const col = Math.floor(Math.random() * BS_SIZE);
      const cells = bsShipCells(row, col, def.size, horizontal);
      if (cells.length === 0) continue;
      if (cells.some((c) => taken.has(c))) continue;
      cells.forEach((c) => taken.add(c));
      ships.push({ name: def.name, size: def.size, cells, hits: [] });
      break;
    }
  }
  return ships;
}

export function createBs(): MatchState<BsStateFull> {
  return {
    phase: "setup",
    turn: null,
    winner: null,
    game: {
      p1: { ships: [], incoming: {} },
      p2: { ships: [], incoming: {} },
      placed1: false,
      placed2: false,
    },
    log: [{ by: "system", text: "Place your fleet, then hunt theirs. A hit lets you fire again." }],
  };
}

function isBsMove(move: unknown): move is { kind: "place"; ships: BsShip[] } | { kind: "fire"; cell: number } {
  if (typeof move !== "object" || move === null) return false;
  const m = move as Record<string, unknown>;
  if (m.kind === "place") return Array.isArray(m.ships);
  return m.kind === "fire" && typeof m.cell === "number";
}

function sideKey(role: Role): "p1" | "p2" {
  return role;
}

export function applyBs(ms: MatchState<BsStateFull>, role: Role, move: unknown): MoveResult {
  if (!isBsMove(move)) return { ok: false, error: "That isn't a valid move." };
  const g = ms.game;

  if (move.kind === "place") {
    if (ms.phase !== "setup") return { ok: false, error: "The battle has already started." };
    if (role === "p1" ? g.placed1 : g.placed2) return { ok: false, error: "Your fleet is already placed." };
    const problem = validatePlacement(move.ships);
    if (problem) return { ok: false, error: problem };
    const next = cloneState(ms);
    next.game[sideKey(role)] = { ships: cloneShips(move.ships), incoming: {} };
    if (role === "p1") next.game.placed1 = true;
    else next.game.placed2 = true;
    next.log.push({ by: role, text: `${role === "p1" ? "Player 1" : "Player 2"} deployed their fleet.` });
    if (next.game.placed1 && next.game.placed2) {
      next.phase = "playing";
      next.turn = "p1";
      next.log.push({ by: "system", text: "Fleets ready — Player 1 fires first." });
    }
    return { ok: true, state: next };
  }

  if (ms.phase !== "playing") return { ok: false, error: "Wait for both fleets." };
  if (ms.turn !== role) return { ok: false, error: "It's not your turn." };
  const cell = move.cell;
  if (!Number.isInteger(cell) || cell < 0 || cell >= BS_SIZE * BS_SIZE) return { ok: false, error: "Aim inside the grid." };

  const target = g[otherRole(role)];
  if (target.ships.length === 0) return { ok: false, error: "The other fleet isn't placed yet." };
  if (cellKey(cell) in target.incoming) return { ok: false, error: "You already fired there." };

  const next = cloneState(ms);
  const tgt = next.game[otherRole(role)];
  const hitShip = tgt.ships.find((s) => s.cells.includes(cell));
  if (!hitShip) {
    tgt.incoming[cellKey(cell)] = "miss";
    next.game.lastShot = { by: role, cell, result: "miss" };
    next.log.push({ by: role, text: `Fired at ${coordName(cell)} — miss.` });
    next.turn = otherRole(role);
  } else {
    tgt.incoming[cellKey(cell)] = "hit";
    hitShip.hits.push(cell);
    if (bsSunk(hitShip)) {
      next.game.lastShot = { by: role, cell, result: "sunk", ship: hitShip.name };
      next.log.push({ by: role, text: `Sank the ${hitShip.name} at ${coordName(cell)}!` });
    } else {
      next.game.lastShot = { by: role, cell, result: "hit" };
      next.log.push({ by: role, text: `Hit at ${coordName(cell)} — fire again.` });
    }
    if (bsAllSunk(tgt)) {
      next.winner = role;
      next.phase = "done";
      next.turn = null;
      next.log.push({ by: "system", text: `The whole fleet is down — ${role === "p1" ? "Player 1" : "Player 2"} wins!` });
    }
    // a hit keeps the turn
  }
  return { ok: true, state: next };
}

function cloneShips(ships: BsShip[]): BsShip[] {
  return ships.map((s) => ({ name: s.name, size: s.size, cells: [...s.cells], hits: [...s.hits] }));
}

export function coordName(cell: number): string {
  return `${String.fromCharCode(65 + Math.floor(cell / BS_SIZE))}${(cell % BS_SIZE) + 1}`;
}

/** The AI's next shot at `target`, scaled by difficulty. */
export function bsAiFire(target: BsSide, difficulty: Difficulty): number | null {
  const fired = Object.keys(target.incoming);
  const firedSet = new Set(fired);
  const unsunk = target.ships.filter((s) => !bsSunk(s));
  if (unsunk.length === 0) return null;

  if (difficulty === "easy") {
    return Math.floor(Math.random() * BS_SIZE * BS_SIZE);
  }

  const unfired = (): number[] => {
    const out: number[] = [];
    for (let c = 0; c < 100; c++) if (!firedSet.has(String(c))) out.push(c);
    return out;
  };
  const open = unfired();
  if (open.length === 0) return null;

  if (difficulty === "medium") {
    return open[Math.floor(Math.random() * open.length)];
  }

  // hunt/target: build the set of known hits on ships that haven't sunk
  const unsunkHits: number[] = [];
  for (const s of unsunk) for (const h of s.hits) unsunkHits.push(h);

  const neighbors = (cell: number): number[] => {
    const r = Math.floor(cell / BS_SIZE);
    const c = cell % BS_SIZE;
    const out: number[] = [];
    if (r > 0) out.push(cell - BS_SIZE);
    if (r < BS_SIZE - 1) out.push(cell + BS_SIZE);
    if (c > 0) out.push(cell - 1);
    if (c < BS_SIZE - 1) out.push(cell + 1);
    return out.filter((n) => !firedSet.has(String(n)));
  };

  if (unsunkHits.length > 0) {
    // with >=2 aligned hits, extend the line
    if (unsunkHits.length >= 2) {
      for (const a of unsunkHits) {
        for (const b of unsunkHits) {
          if (a === b) continue;
          const diff = b - a;
          if (diff === 1 || diff === BS_SIZE) {
            const lo = Math.min(a, b);
            const before = lo - diff;
            const after = b + diff;
            if (!firedSet.has(String(before)) && inBounds(before, diff)) return before;
            if (!firedSet.has(String(after)) && inBounds(after, diff)) return after;
          }
        }
      }
    }
    const adj = unsunkHits.flatMap(neighbors);
    if (adj.length > 0) return adj[Math.floor(Math.random() * adj.length)];
  }

  if (difficulty === "hard") {
    const parity = open.filter((c) => (Math.floor(c / BS_SIZE) + (c % BS_SIZE)) % 2 === 0);
    const pool = parity.length > 0 ? parity : open;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // impossible: probability density over remaining ships
  const sunkCells = new Set<number>();
  for (const s of target.ships) if (bsSunk(s)) s.cells.forEach((c) => sunkCells.add(c));
  const density = new Map<number, number>();
  for (const ship of unsunk) {
    for (let r = 0; r < BS_SIZE; r++) {
      for (let c = 0; c < BS_SIZE; c++) {
        for (const horizontal of [true, false]) {
          const cells = bsShipCells(r, c, ship.size, horizontal);
          if (cells.length === 0) continue;
          if (cells.some((cell) => target.incoming[String(cell)] === "miss" || sunkCells.has(cell))) continue;
          const coversHit = cells.some((cell) => unsunkHits.includes(cell));
          const weight = coversHit ? 12 : 1;
          for (const cell of cells) {
            if (firedSet.has(String(cell))) continue;
            density.set(cell, (density.get(cell) ?? 0) + weight);
          }
        }
      }
    }
  }
  if (density.size === 0) return open[Math.floor(Math.random() * open.length)];
  let bestCell = open[0];
  let bestScore = -1;
  for (const [cell, score] of density) {
    if (score > bestScore) {
      bestScore = score;
      bestCell = cell;
    }
  }
  return bestCell;
}

function inBounds(cell: number, diff: number): boolean {
  if (cell < 0 || cell >= BS_SIZE * BS_SIZE) return false;
  if (diff === 1 && cell % BS_SIZE === BS_SIZE - 1) return false; // wrapped rows
  return true;
}

/** AI places its own fleet — impossible spreads the ships out a bit. */
export function bsAiPlace(difficulty: Difficulty): BsShip[] {
  if (difficulty === "impossible") {
    let best: BsShip[] | null = null;
    let bestScore = -1;
    for (let i = 0; i < 25; i++) {
      const candidate = bsAutoPlace();
      let contacts = 0;
      const all = candidate.flatMap((s) => s.cells);
      for (const cell of all) {
        const r = Math.floor(cell / BS_SIZE);
        const c = cell % BS_SIZE;
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0],
        ]) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= BS_SIZE || nc < 0 || nc >= BS_SIZE) continue;
          if (all.includes(nr * BS_SIZE + nc)) contacts++;
        }
      }
      if (contacts > bestScore) {
        bestScore = contacts;
        best = candidate;
      }
    }
    return best ?? bsAutoPlace();
  }
  return bsAutoPlace();
}

export function bsAiMove(ms: MatchState<BsStateFull>, role: Role, difficulty: Difficulty): unknown | null {
  const g = ms.game;
  if (ms.phase === "setup") {
    const mine = role === "p1" ? g.p1 : g.p2;
    const placed = role === "p1" ? g.placed1 : g.placed2;
    if (placed || mine.ships.length > 0) return null;
    return { kind: "place", ships: bsAiPlace(difficulty) };
  }
  if (ms.phase !== "playing" || ms.turn !== role) return null;
  const cell = bsAiFire(g[otherRole(role)], difficulty);
  if (cell === null) return null;
  return { kind: "fire", cell };
}
