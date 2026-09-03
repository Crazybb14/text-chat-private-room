import { describe, expect, it } from "vitest";
import { applyTtt, createTtt, tttAiMove, TTT_LINES } from "./tictactoe";
import type { MatchState } from "./types";
import type { TttState } from "./tictactoe";

function fresh(): MatchState<TttState> {
  return createTtt();
}

describe("tic tac toe", () => {
  it("has eight winning lines", () => {
    expect(TTT_LINES).toHaveLength(8);
  });

  it("awards the win when a row completes", () => {
    let ms = fresh();
    ms.game.board[0] = "p1";
    ms.game.board[1] = "p1";
    const res = applyTtt(ms, "p1", 2);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.winner).toBe("p1");
      expect(res.state.phase).toBe("done");
    }
  });

  it("rejects a taken square and out-of-turn moves", () => {
    let ms = fresh();
    ms.game.board[4] = "p2";
    expect(applyTtt(ms, "p1", 4).ok).toBe(false);
    expect(applyTtt(ms, "p2", 0).ok).toBe(false);
  });

  // @kliv-spec-derived — from the user's ask: an "impossible" AI must never lose.
  it("never loses to a random opponent", () => {
    for (let game = 0; game < 15; game++) {
      let ms = fresh();
      let guard = 0;
      while (ms.phase === "playing" && guard++ < 12) {
        if (ms.turn === "p1") {
          const empty = ms.game.board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
          const move = empty[Math.floor(Math.random() * empty.length)];
          const res = applyTtt(ms, "p1", move);
          expect(res.ok).toBe(true);
          if (res.ok) ms = res.state as MatchState<TttState>;
        } else {
          const move = tttAiMove(ms, "p2", "impossible");
          expect(move).not.toBeNull();
          const res = applyTtt(ms, "p2", move as number);
          expect(res.ok).toBe(true);
          if (res.ok) ms = res.state as MatchState<TttState>;
        }
      }
      expect(ms.winner).not.toBe("p1");
    }
  });
});
