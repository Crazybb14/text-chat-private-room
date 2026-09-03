import { describe, expect, it } from "vitest";
import { applyGw, createGw, gwAiMove, GW_CHARS, GW_QUESTIONS } from "./guessWho";
import type { GwState } from "./guessWho";
import type { MatchState } from "./types";

describe("guess who", () => {
  it("has a balanced 24-person board", () => {
    expect(GW_CHARS).toHaveLength(24);
    const females = GW_CHARS.filter((c) => c.female).length;
    expect(females).toBe(12);
    // male-only traits never appear on women
    for (const c of GW_CHARS) {
      if (c.female) {
        expect(c.beard).toBe(false);
        expect(c.mustache).toBe(false);
      } else {
        expect(c.earrings).toBe(false);
      }
      // hair colors are mutually exclusive
      expect([c.blonde, c.red, c.dark].filter(Boolean).length).toBe(1);
    }
    // every question splits the board into two live halves
    for (const q of GW_QUESTIONS) {
      const yes = GW_CHARS.filter((c) => c[q.key]).length;
      expect(yes).toBeGreaterThanOrEqual(3);
      expect(yes).toBeLessThanOrEqual(21);
    }
  });

  it("answers truthfully and narrows the asker's board", () => {
    let ms = createGw();
    ms.game.secretP1 = 0; // Ava: woman, blonde, glasses, smiling
    ms.game.secretP2 = 12; // Max
    ms.phase = "playing";
    ms.turn = "p2";
    const res = applyGw(ms, "p2", { kind: "ask", q: "female" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      ms = res.state as MatchState<GwState>;
      expect(ms.game.candP2).toHaveLength(12);
      expect(ms.turn).toBe("p1");
      expect(ms.game.events[0]).toContain("Yes");
    }
  });

  it("a wrong guess loses and a right one wins", () => {
    let ms = createGw();
    ms.game.secretP1 = 5;
    ms.game.secretP2 = 10;
    ms.phase = "playing";
    ms.turn = "p2";
    let res = applyGw(ms, "p2", { kind: "guess", char: 5 }); // correct (p1's secret)
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.winner).toBe("p2");

    ms = createGw();
    ms.game.secretP1 = 5;
    ms.game.secretP2 = 10;
    ms.phase = "playing";
    ms.turn = "p2";
    res = applyGw(ms, "p2", { kind: "guess", char: 6 }); // wrong
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.state.winner).toBe("p1");
  });

  // @kliv-spec-derived — the top AI should reliably deduce the mystery person.
  it("impossible AI narrows to one and guesses right", () => {
    for (let round = 0; round < 5; round++) {
      let ms = createGw();
      ms.game.secretP1 = Math.floor(Math.random() * GW_CHARS.length);
      ms.game.secretP2 = Math.floor(Math.random() * GW_CHARS.length);
      ms.phase = "playing";
      ms.turn = "p2";
      let guard = 0;
      while (ms.phase === "playing" && guard++ < 30) {
        if (ms.turn === "p2") {
          const move = gwAiMove(ms, "p2", "impossible");
          const res = applyGw(ms, "p2", move);
          if (!res.ok) break;
          ms = res.state as MatchState<GwState>;
        } else {
          const unasked = GW_QUESTIONS.filter((q) => !ms.game.askedP1.includes(q.key));
          if (unasked.length === 0) break;
          const res = applyGw(ms, "p1", { kind: "ask", q: unasked[0].key });
          if (!res.ok) break;
          ms = res.state as MatchState<GwState>;
        }
      }
      expect(ms.winner).toBe("p2");
    }
  });
});
