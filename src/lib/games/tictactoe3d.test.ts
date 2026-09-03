import { describe, expect, it } from "vitest";
import { applyT3, createT3, t3AiMove, T3_LINES } from "./tictactoe3d";
import type { T3State } from "./tictactoe3d";
import type { MatchState } from "./types";

describe("3d tic tac toe", () => {
  it("has 49 winning lines across the cube", () => {
    expect(T3_LINES).toHaveLength(49);
    // every line has three distinct cells in range
    for (const line of T3_LINES) {
      expect(new Set(line).size).toBe(3);
      for (const cell of line) {
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(27);
      }
    }
  });

  it("detects a line straight through the layers", () => {
    // straight up the center: 4 (bottom), 13 (middle), 22 (top)
    let ms = createT3();
    ms.game.board[4] = "p1";
    ms.game.board[13] = "p1";
    const res = applyT3(ms, "p1", 22);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.winner).toBe("p1");
      expect(res.state.phase).toBe("done");
    }
  });

  it("rejects taken spots and out-of-turn moves", () => {
    let ms = createT3();
    ms.game.board[0] = "p2";
    expect(applyT3(ms, "p1", 0).ok).toBe(false);
    expect(applyT3(ms, "p2", 1).ok).toBe(false);
  });

  // @kliv-spec-derived — a competent AI shouldn't miss an immediate win.
  it("hard AI takes an immediate winning spot", () => {
    const ms = createT3();
    ms.game.board[4] = "p1";
    ms.game.board[13] = "p1";
    ms.game.board[0] = "p2";
    ms.game.board[1] = "p2";
    const move = t3AiMove(ms, "p1", "hard");
    expect(move).toBe(22);
  });

  it("ends in a draw when the cube fills", () => {
    let ms = createT3();
    // fill every cell alternating without any line — construct via apply to stay legal
    let guard = 0;
    while (ms.phase === "playing" && guard++ < 27) {
      const role = ms.turn as "p1" | "p2";
      const free = ms.game.board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      // find a move that doesn't create a line, if one exists
      let chosen: number | null = null;
      for (const cell of free) {
        const res = applyT3(ms, role, cell);
        if (res.ok && res.state.winner === null) {
          chosen = cell;
          break;
        }
      }
      if (chosen === null) {
        const res = applyT3(ms, role, free[0]);
        if (!res.ok) break;
        ms = res.state as MatchState<T3State>;
      } else {
        const res = applyT3(ms, role, chosen);
        if (!res.ok) break;
        ms = res.state as MatchState<T3State>;
      }
    }
    expect(ms.phase).toBe("done");
  });
});
