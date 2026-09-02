import { describe, expect, it } from "vitest";
import {
  hasVoted,
  parseOptions,
  tallyVotes,
  validatePoll,
  votePercentages,
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
} from "./polls";

describe("parseOptions", () => {
  it("reads the option list off a poll row", () => {
    expect(parseOptions(JSON.stringify(["Pizza", "Tacos"]))).toEqual(["Pizza", "Tacos"]);
  });

  it("survives broken or missing JSON", () => {
    expect(parseOptions("not json")).toEqual([]);
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions(undefined)).toEqual([]);
  });
});

// @kliv-spec-derived — from user intent: "polls where I pick options and people vote"
describe("validatePoll", () => {
  it("rejects a poll without a question", () => {
    expect(validatePoll("", ["A", "B"])).not.toBeNull();
    expect(validatePoll("   ", ["A", "B"])).not.toBeNull();
  });

  it("rejects fewer than two real options", () => {
    expect(validatePoll("Pick one", ["A", "  "])).not.toBeNull();
    expect(validatePoll("Pick one", [])).not.toBeNull();
  });

  it("rejects more than the maximum options", () => {
    const tooMany = Array.from({ length: MAX_POLL_OPTIONS + 1 }, (_, i) => `Option ${i}`);
    expect(validatePoll("Pick one", tooMany)).not.toBeNull();
  });

  it("accepts a normal poll", () => {
    expect(validatePoll("Pizza or tacos?", ["Pizza", "Tacos"])).toBeNull();
  });

  it("matches the published option bounds", () => {
    expect(MIN_POLL_OPTIONS).toBe(2);
    expect(MAX_POLL_OPTIONS).toBeGreaterThanOrEqual(4);
  });
});

describe("tallyVotes", () => {
  it("counts votes per option", () => {
    const counts = tallyVotes(["A", "B", "C"], [
      { option_index: 0 },
      { option_index: 1 },
      { option_index: 1 },
    ]);
    expect(counts).toEqual([1, 2, 0]);
  });

  it("ignores out-of-range votes instead of crashing", () => {
    expect(tallyVotes(["A", "B"], [{ option_index: 7 }, { option_index: -1 }, { option_index: 1 }])).toEqual([
      0,
      1,
    ]);
  });

  it("returns zeros when nobody voted", () => {
    expect(tallyVotes(["A", "B", "C"], [])).toEqual([0, 0, 0]);
  });
});

// @kliv-spec-derived — one person, one vote, results as percentages
describe("votePercentages", () => {
  it("splits votes into whole-number percentages", () => {
    expect(votePercentages([1, 1])).toEqual([50, 50]);
    expect(votePercentages([2, 1, 1])).toEqual([50, 25, 25]);
  });

  it("returns all zeros when there are no votes", () => {
    expect(votePercentages([0, 0])).toEqual([0, 0]);
  });
});

describe("hasVoted", () => {
  it("spots the voter's own ballot", () => {
    expect(hasVoted([{ username: "ada" }], "ada")).toBe(true);
    expect(hasVoted([{ username: "ada" }], "bob")).toBe(false);
  });
});
