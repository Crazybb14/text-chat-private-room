import { describe, expect, it } from "vitest";
import { applyHm, createHm, hmAiMove, hmDecode, hmEncode, HM_MISS_LIMIT } from "./hangman";
import type { HmState } from "./hangman";
import type { MatchState } from "./types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

describe("hangman", () => {
  it("encodes and decodes words", () => {
    const enc = hmEncode("SUNSHINE");
    expect(enc).not.toContain("SUNSHINE");
    expect(hmDecode(enc)).toBe("SUNSHINE");
  });

  it("a hit keeps your turn, a miss passes it", () => {
    let ms = createHm("medium");
    const word = hmDecode(ms.game.word);
    const hit = word[0];
    const miss = ALPHABET.find((l) => !word.includes(l)) as string;

    let res = applyHm(ms, "p1", { letter: hit }, "medium");
    expect(res.ok).toBe(true);
    if (res.ok) {
      ms = res.state as MatchState<HmState>;
      expect(ms.turn).toBe("p1"); // keeps going
    }
    res = applyHm(ms, "p1", { letter: miss }, "medium");
    expect(res.ok).toBe(true);
    if (res.ok) {
      ms = res.state as MatchState<HmState>;
      expect(ms.turn).toBe("p2");
    }
  });

  it("running out of misses loses the round", () => {
    let ms = createHm("impossible"); // limit 5
    const word = hmDecode(ms.game.word);
    const misses = ALPHABET.filter((l) => !word.includes(l));
    for (const letter of misses) {
      if (ms.game.wrongP1.length >= 5 || ms.phase === "done") break;
      const res = applyHm(ms, "p1", { letter }, "impossible");
      if (!res.ok) continue;
      ms = res.state as MatchState<HmState>;
      if (ms.phase === "done") break;
      if (ms.turn === "p2") {
        const dummy = misses.find((l) => !ms.game.used.includes(l)) ?? letter;
        const r2 = applyHm(ms, "p2", { letter: dummy }, "impossible");
        if (r2.ok) ms = r2.state as MatchState<HmState>;
        if (ms.phase === "done") break;
      }
    }
    expect(ms.phase).toBe("done");
    expect(ms.winner).toBe("p2");
    expect(HM_MISS_LIMIT.impossible).toBe(5);
  });

  it("rejects a repeated letter", () => {
    let ms = createHm("easy");
    const res = applyHm(ms, "p1", { letter: hmDecode(ms.game.word)[0] }, "easy");
    expect(res.ok).toBe(true);
    if (res.ok) {
      ms = res.state as MatchState<HmState>;
      expect(applyHm(ms, "p1", { letter: ms.game.used[0] }, "easy").ok).toBe(false);
    }
  });

  // @kliv-spec-derived — the sharpest AI should finish words with very few misses.
  it("impossible AI solves the word with few misses", () => {
    for (let round = 0; round < 5; round++) {
      let ms = createHm("hard");
      let guard = 0;
      while (ms.phase === "playing" && guard++ < 40) {
        if (ms.turn === "p1") {
          const word = hmDecode(ms.game.word);
          const dummy = ALPHABET.find((l) => !word.includes(l) && !ms.game.used.includes(l)) ?? "A";
          const res = applyHm(ms, "p1", { letter: dummy }, "hard");
          if (!res.ok) break;
          ms = res.state as MatchState<HmState>;
        } else {
          const move = hmAiMove(ms, "p2", "impossible") as { letter: string };
          const res = applyHm(ms, "p2", move, "hard");
          if (!res.ok) break;
          ms = res.state as MatchState<HmState>;
        }
      }
      expect(ms.winner).toBe("p2");
      expect(ms.game.wrongP2.length).toBeLessThan(HM_MISS_LIMIT.hard);
    }
  });
});
