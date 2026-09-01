import { describe, expect, it } from "vitest";
import {
  findViolation,
  formatDuration,
  formatRemaining,
  nextPenalty,
  TWO_MONTHS_MINUTES,
} from "./moderation";

// @kliv-spec-derived — from user intent: "the auto-ban thing is not working, fix it
// and make sure it involves bypasses for words"
describe("findViolation catches bannable words", () => {
  it.each(["fuck", "shit", "bitch", "cunt", "nigger", "faggot", "retard"])(
    "catches the plain word '%s'",
    (word: string) => {
      expect(findViolation(`well ${word} then`)).not.toBeNull();
    }
  );

  it("catches spaced-out spelling (f u c k)", () => {
    expect(findViolation("what the f u c k man")).not.toBeNull();
  });

  it("catches symbol-separated spelling (f*ck)", () => {
    expect(findViolation("f*ck this place")).not.toBeNull();
  });

  it("catches leetspeak (sh1t, b1tch, n1gger)", () => {
    expect(findViolation("oh sh1t")).not.toBeNull();
    expect(findViolation("you b1tch")).not.toBeNull();
    expect(findViolation("hey n1gger")).not.toBeNull();
  });

  it("catches stretched letters (fuuuck, shiiit)", () => {
    expect(findViolation("fuuuck")).not.toBeNull();
    expect(findViolation("shiiit")).not.toBeNull();
  });

  it("catches mixed split forms (n1 gg er, cu nt)", () => {
    expect(findViolation("n1 gg er")).not.toBeNull();
    expect(findViolation("cu nt")).not.toBeNull();
  });

  it("catches the highest tier when several are present", () => {
    const match = findViolation("damn what a nigger");
    expect(match?.tier).toBe(5);
  });

  it("marks messages aimed at someone as directed", () => {
    const match = findViolation("fuck you");
    expect(match?.flags).toContain("directed");
  });

  it("flags kill-yourself phrases as threats", () => {
    const match = findViolation("go kill yourself");
    expect(match?.tier).toBe(5);
    expect(match?.flags).toContain("threat");
  });
});

// @kliv-spec-derived — ordinary words must not trip the filter
describe("findViolation leaves normal language alone", () => {
  it.each([
    "hello world",
    "see you in class tomorrow",
    "the assassin crept by",
    "can you pass it over",
    "we watched a documentary in class",
    "Scunthorpe is a town",
    "gas hit different today",
    "analyze the results",
    "Monday homework is the worst",
  ])("allows '%s'", (text: string) => {
    expect(findViolation(text)).toBeNull();
  });
});

// @kliv-spec-derived — from user intent: "depending how bad the word is, and if
// repetitive the ban gets longer and longer, past 2 months = permanent"
describe("nextPenalty escalates with repeats", () => {
  it("tier 1 first offense is a warning, then bans", () => {
    expect(nextPenalty(1, 0).kind).toBe("warn");
    const second = nextPenalty(1, 1);
    expect(second.kind).toBe("ban");
    expect(second.permanent).toBe(false);
  });

  it("penalties never shrink as violations pile up", () => {
    const minutes = Array.from({ length: 20 }, (_, i) => {
      const p = nextPenalty(3, i);
      return p.permanent ? Infinity : p.minutes;
    });
    const sorted = [...minutes].sort((a, b) => a - b);
    expect(minutes).toEqual(sorted);
  });

  it("eventually becomes permanent", () => {
    expect(nextPenalty(3, 20).permanent).toBe(true);
    expect(nextPenalty(1, 30).permanent).toBe(true);
  });

  it("never issues a temporary ban longer than two months", () => {
    for (let priors = 0; priors < 40; priors++) {
      for (const tier of [1, 2, 3, 4, 5]) {
        const p = nextPenalty(tier, priors);
        if (!p.permanent) {
          expect(p.minutes).toBeLessThanOrEqual(TWO_MONTHS_MINUTES);
        }
      }
    }
  });

  it("worse tiers start with much bigger bans", () => {
    const t1 = nextPenalty(1, 1);
    const t3 = nextPenalty(3, 0);
    const t5 = nextPenalty(5, 0);
    expect((t3.permanent ? Infinity : t3.minutes)).toBeGreaterThan(t1.permanent ? Infinity : t1.minutes);
    expect((t5.permanent ? Infinity : t5.minutes)).toBeGreaterThan(t3.permanent ? Infinity : t3.minutes);
  });

  it("threats start at 30 days minimum", () => {
    const p = nextPenalty(5, 0, { threat: true });
    expect(p.permanent ? Infinity : p.minutes).toBeGreaterThanOrEqual(43200);
  });

  it("the multiplier makes bans climb faster", () => {
    const normal = nextPenalty(3, 1);
    const fast = nextPenalty(3, 1, { multiplier: 3 });
    const value = (p: { permanent: boolean; minutes: number }) => (p.permanent ? Infinity : p.minutes);
    expect(value(fast)).toBeGreaterThan(value(normal));
  });
});

// code-consistent — formatting used across ban screens and admin lists
describe("duration formatting", () => {
  it("formats minutes, hours, days, and months", () => {
    expect(formatDuration(5)).toBe("5 min");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(1440)).toBe("1 day");
    expect(formatDuration(43200)).toBe("1 month");
  });

  it("marks permanent explicitly", () => {
    expect(formatDuration(Infinity)).toBe("permanent");
    expect(formatRemaining(null, true)).toBe("permanent");
  });
});
