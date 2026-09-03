import { describe, expect, it } from "vitest";
import { applyGn, createGn, gnAiMove, gnFeasible } from "./guessNumber";
import type { GnState } from "./guessNumber";
import type { MatchState } from "./types";

describe("guess the number", () => {
  it("starts once both secrets are set", () => {
    let ms = createGn("easy");
    expect(ms.phase).toBe("setup");
    let res = applyGn(ms, "p1", { kind: "setSecret", value: 10 });
    expect(res.ok).toBe(true);
    if (res.ok) ms = res.state as MatchState<GnState>;
    expect(ms.phase).toBe("setup");
    res = applyGn(ms, "p2", { kind: "setSecret", value: 42 });
    expect(res.ok).toBe(true);
    if (res.ok) ms = res.state as MatchState<GnState>;
    expect(ms.phase).toBe("playing");
    expect(ms.turn).toBe("p1");
  });

  it("gives correct higher/lower feedback and awards the exact guess", () => {
    let ms = createGn("easy");
    let res = applyGn(ms, "p1", { kind: "setSecret", value: 30 });
    if (res.ok) ms = res.state as MatchState<GnState>;
    res = applyGn(ms, "p2", { kind: "setSecret", value: 10 });
    if (res.ok) ms = res.state as MatchState<GnState>;

    res = applyGn(ms, "p1", { kind: "guess", guess: 20 }); // 20 > 10
    if (res.ok) ms = res.state as MatchState<GnState>;
    expect(ms.game.guessesP1[0].result).toBe("high");

    res = applyGn(ms, "p2", { kind: "guess", guess: 5 }); // 5 < 30
    if (res.ok) ms = res.state as MatchState<GnState>;
    expect(ms.game.guessesP2[0].result).toBe("low");

    res = applyGn(ms, "p1", { kind: "guess", guess: 10 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.state.winner).toBe("p1");
      expect(res.state.phase).toBe("done");
    }
  });

  it("narrows the feasible range from feedback", () => {
    const ms = createGn("medium");
    ms.game.secretP1 = 40;
    ms.game.secretP2 = 60;
    ms.game.guessesP1 = [
      { value: 50, result: "high" },
      { value: 25, result: "low" },
    ];
    ms.phase = "playing";
    const f = gnFeasible(ms.game, "p1");
    expect(f.min).toBe(26);
    expect(f.max).toBe(49);
  });

  // @kliv-spec-derived — the impossible AI should find any number in very few guesses.
  it("impossible AI binary-searches the secret quickly", () => {
    let ms = createGn("easy"); // 1-50
    let r = applyGn(ms, "p1", { kind: "setSecret", value: 37 });
    if (r.ok) ms = r.state as MatchState<GnState>;
    r = applyGn(ms, "p2", { kind: "setSecret", value: 20 });
    if (r.ok) ms = r.state as MatchState<GnState>;
    expect(ms.phase).toBe("playing");

    let guard = 0;
    while (ms.phase === "playing" && guard++ < 20) {
      if (ms.turn === "p1") {
        const move = gnAiMove(ms, "p1", "impossible") as { kind: string; guess: number };
        const res = applyGn(ms, "p1", move);
        if (!res.ok) break;
        ms = res.state as MatchState<GnState>;
      } else {
        const res = applyGn(ms, "p2", { kind: "guess", guess: 1 });
        if (!res.ok) break;
        ms = res.state as MatchState<GnState>;
      }
    }
    expect(ms.winner).toBe("p1");
    // binary search over 50 numbers needs at most 6 guesses
    expect(ms.game.guessesP1.length).toBeLessThanOrEqual(6);
  });
});
