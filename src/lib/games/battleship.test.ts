import { describe, expect, it } from "vitest";
import {
  applyBs,
  bsAiFire,
  bsAllSunk,
  bsAutoPlace,
  bsSunk,
  BS_FLEET,
  BS_SIZE,
  createBs,
} from "./battleship";
import type { BsSide, BsStateFull } from "./battleship";
import type { MatchState } from "./types";

function sortedSizes(ships: { size: number }[]): number[] {
  return ships.map((s) => s.size).sort((a, b) => a - b);
}

describe("battleship", () => {
  it("auto-placement is always a legal fleet", () => {
    for (let round = 0; round < 20; round++) {
      const ships = bsAutoPlace();
      expect(sortedSizes(ships)).toEqual([2, 3, 3, 4, 5]);
      const seen = new Set<number>();
      for (const ship of ships) {
        expect(ship.cells.length).toBe(ship.size);
        for (const cell of ship.cells) {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThan(BS_SIZE * BS_SIZE);
          expect(seen.has(cell)).toBe(false);
          seen.add(cell);
        }
        // straight line: consecutive cells differ by 1 or 10
        const ordered = [...ship.cells].sort((a, b) => a - b);
        const step = ordered[1] - ordered[0];
        expect([1, BS_SIZE]).toContain(step);
        for (let i = 1; i < ordered.length; i++) {
          expect(ordered[i] - ordered[i - 1]).toBe(step);
        }
      }
    }
  });

  it("runs a full game: place, fire, sink, win", () => {
    let ms = createBs();
    const fleetP1 = bsAutoPlace();
    const tinyFleetP2 = bsAutoPlace();
    // p2 places a fleet whose first ship we can sink cell by cell
    let res = applyBs(ms, "p1", { kind: "place", ships: fleetP1 });
    expect(res.ok).toBe(true);
    if (res.ok) ms = res.state as MatchState<BsStateFull>;
    res = applyBs(ms, "p2", { kind: "place", ships: tinyFleetP2 });
    expect(res.ok).toBe(true);
    if (res.ok) ms = res.state as MatchState<BsStateFull>;
    expect(ms.phase).toBe("playing");

    // p1 fires at every cell of p2's fleet, p2 misses on alternate turns
    const allCells = tinyFleetP2.flatMap((s) => s.cells);
    let fired = new Set<number>();
    let p2shots = 0;
    for (const cell of allCells) {
      const r = applyBs(ms, "p1", { kind: "fire", cell });
      if (!r.ok) break;
      ms = r.state as MatchState<BsStateFull>;
      fired.add(cell);
      if (ms.phase === "done") break;
      // p2 takes a wasted shot somewhere harmless (a cell we know is empty of p1's fleet is hard
      // to guarantee — instead let p2 fire at cells already fired at, which is rejected; so we
      // fire at fresh cells and simply accept hits/misses)
      while (ms.turn === "p2") {
        const candidate = 99 - (p2shots % 100);
        p2shots++;
        const r2 = applyBs(ms, "p2", { kind: "fire", cell: candidate });
        if (!r2.ok) break;
        ms = r2.state as MatchState<BsStateFull>;
      }
    }
    expect(ms.winner).toBe("p1");
    void fired;
  });

  it("rejects firing at the same spot twice", () => {
    let ms = createBs();
    let r = applyBs(ms, "p1", { kind: "place", ships: bsAutoPlace() });
    expect(r.ok).toBe(true);
    if (r.ok) ms = r.state as MatchState<BsStateFull>;
    r = applyBs(ms, "p1", { kind: "place", ships: bsAutoPlace() });
    expect(r.ok).toBe(false); // already placed
    r = applyBs(ms, "p2", { kind: "place", ships: bsAutoPlace() });
    if (r.ok) ms = r.state as MatchState<BsStateFull>;
    r = applyBs(ms, "p1", { kind: "fire", cell: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) ms = r.state as MatchState<BsStateFull>;
    if (ms.turn === "p1") {
      // it was a hit; still can't repeat the same cell
      const repeat = applyBs(ms, "p1", { kind: "fire", cell: 0 });
      expect(repeat.ok).toBe(false);
    } else {
      // miss passed the turn; make p2 fire, then p1 repeats
      const r2 = applyBs(ms, "p2", { kind: "fire", cell: 99 });
      if (r2.ok) ms = r2.state as MatchState<BsStateFull>;
      const repeat = applyBs(ms, "p1", { kind: "fire", cell: 0 });
      expect(repeat.ok).toBe(false);
    }
  });

  // @kliv-spec-derived — the smarter AI should actually finish off a fleet.
  it("impossible AI sinks the whole fleet without repeating shots", () => {
    for (let round = 0; round < 5; round++) {
      const side: BsSide = { ships: bsAutoPlace(), incoming: {} };
      let shots = 0;
      while (!bsAllSunk(side) && shots < 200) {
        const cell = bsAiFire(side, "impossible");
        expect(cell).not.toBeNull();
        expect(String(cell) in side.incoming).toBe(false);
        const ship = side.ships.find((s) => s.cells.includes(cell as number));
        if (ship) {
          ship.hits.push(cell as number);
          side.incoming[String(cell)] = "hit";
        } else {
          side.incoming[String(cell)] = "miss";
        }
        shots++;
      }
      expect(bsAllSunk(side)).toBe(true);
    }
  });

  it("medium AI never repeats a shot", () => {
    const side: BsSide = { ships: bsAutoPlace(), incoming: {} };
    for (let i = 0; i < 40; i++) {
      const cell = bsAiFire(side, "medium");
      expect(cell).not.toBeNull();
      expect(String(cell) in side.incoming).toBe(false);
      side.incoming[String(cell)] = "miss";
    }
  });

  it("knows when a ship is sunk", () => {
    const fleet = bsAutoPlace();
    const ship = fleet[0];
    expect(bsSunk({ ...ship, hits: [...ship.cells] })).toBe(true);
    expect(bsSunk({ ...ship, hits: ship.cells.slice(0, 1) })).toBe(false);
    void BS_FLEET;
  });
});
