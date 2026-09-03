import { describe, expect, it } from "vitest";
import { applyC4, c4AiMove, c4ValidCols, createC4 } from "./connect4";
import type { C4State } from "./connect4";
import type { MatchState } from "./types";

type Res = ReturnType<typeof applyC4>;

function play(sequence: Array<[("p1" | "p2"), number]>): { ms: MatchState<C4State>; last: Res } {
  let ms = createC4();
  let last: Res = { ok: false, error: "no moves" };
  for (const [role, col] of sequence) {
    last = applyC4(ms, role, col);
    if (last.ok) ms = last.state as MatchState<C4State>;
  }
  return { ms, last };
}

describe("connect four", () => {
  it("detects a horizontal four", () => {
    const { last } = play([
      ["p1", 0], ["p2", 0],
      ["p1", 1], ["p2", 1],
      ["p1", 2], ["p2", 2],
      ["p1", 3],
    ]);
    expect(last.ok).toBe(true);
    if (last.ok) expect(last.state.winner).toBe("p1");
  });

  it("detects a vertical four", () => {
    const { last } = play([
      ["p1", 2], ["p2", 3],
      ["p1", 2], ["p2", 3],
      ["p1", 2], ["p2", 3],
      ["p1", 2],
    ]);
    expect(last.ok).toBe(true);
    if (last.ok) expect(last.state.winner).toBe("p1");
  });

  it("rejects a move into a full column", () => {
    const { ms, last } = play([
      ["p1", 0], ["p2", 0],
      ["p1", 0], ["p2", 0],
      ["p1", 0], ["p2", 0],
    ]);
    expect(last.ok).toBe(true);
    expect(c4ValidCols(ms.game.board)).not.toContain(0);
    expect(applyC4(ms, "p1", 0).ok).toBe(false);
  });

  // @kliv-spec-derived — the AI should act like a competent opponent at higher levels.
  it("hard AI blocks an immediate vertical threat", () => {
    const { ms } = play([
      ["p1", 3], ["p2", 0],
      ["p1", 3], ["p2", 0],
      ["p1", 3],
    ]);
    // p1 has three stacked in column 3 and it's p2's turn — p2 must block
    const move = c4AiMove(ms, "p2", "hard");
    expect(move).toBe(3);
  });
});
