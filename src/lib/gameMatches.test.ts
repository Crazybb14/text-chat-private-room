import { describe, expect, it } from "vitest";
import { createMatchState } from "./games";
import {
  aiPlayerName,
  describeOutcome,
  myMatches,
  openChallenges,
  parseMatchState,
  roleFor,
  type GameMatchRow,
} from "./gameMatches";

function row(over: Partial<GameMatchRow>): GameMatchRow {
  const ms = createMatchState("tictactoe", "medium");
  return {
    _row_id: 1,
    game_type: "tictactoe",
    mode: "ai",
    difficulty: "medium",
    player1: "ada",
    player2: "AI (medium)",
    status: "active",
    state: JSON.stringify(ms),
    turn: ms.turn,
    winner: null,
    last_move_at: 1000,
    ...over,
  };
}

describe("game matches", () => {
  it("works out each player's role", () => {
    const r = row({});
    expect(roleFor(r, "ada")).toBe("p1");
    expect(roleFor(r, "AI (medium)")).toBe("p2");
    expect(roleFor(r, "someone-else")).toBeNull();
  });

  it("falls back safely on corrupt state", () => {
    const r = row({ state: "{not json" });
    const ms = parseMatchState(r);
    expect(ms.phase).toBe("done");
  });

  it("filters my matches and open challenges", () => {
    const mine = row({});
    const otherOpen = row({ _row_id: 2, player1: "ben", player2: null, mode: "multiplayer", status: "open" });
    const mineFinished = row({ _row_id: 3, player1: "ben", player2: "ada", status: "finished" });
    const all = [mine, otherOpen, mineFinished];
    expect(myMatches(all, "ada").map((r) => r._row_id)).toEqual([1, 3]);
    expect(openChallenges(all, "ada").map((r) => r._row_id)).toEqual([2]);
    expect(openChallenges(all, "ben")).toHaveLength(0);
  });

  it("describes what's happening in a match", () => {
    expect(describeOutcome(row({ status: "open", mode: "multiplayer", player2: null }), "ada")).toContain("opponent");
    const active = row({});
    expect(describeOutcome(active, "ada")).toBe("Your turn");
    // flip the turn to p2 (the AI)
    const ms = parseMatchState(active);
    ms.turn = "p2";
    expect(describeOutcome(row({ state: JSON.stringify(ms), turn: "p2" }), "ada")).toContain("AI");
    expect(describeOutcome(row({ state: JSON.stringify(ms), status: "finished", winner: "p2" }), "ada")).toContain("won");
  });

  it("names the AI opponent consistently", () => {
    expect(aiPlayerName("impossible")).toBe("AI (impossible)");
  });
});
