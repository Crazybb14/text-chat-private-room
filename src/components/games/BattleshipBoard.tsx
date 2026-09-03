import { useState } from "react";
import { RotateCw, Undo2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BS_FLEET,
  BS_SIZE,
  bsAutoPlace,
  bsShipCells,
  bsSunk,
  coordName,
  type BsShip,
  type BsStateFull,
} from "@/lib/games/battleship";
import type { MatchState, Role } from "@/lib/games/types";

interface Props {
  ms: MatchState<BsStateFull>;
  myRole: Role | null;
  canMove: boolean;
  onMove: (move: unknown) => void;
}

const FLEET_COLORS = ["bg-cyan-600", "bg-indigo-600", "bg-purple-600", "bg-teal-600", "bg-rose-600"];

export default function BattleshipBoard({ ms, myRole, canMove, onMove }: Props) {
  const g = ms.game;
  const [placing, setPlacing] = useState<BsShip[]>([]);
  const [horizontal, setHorizontal] = useState(true);

  const mySide = myRole === "p2" ? g.p2 : g.p1;
  const enemySide = myRole === "p2" ? g.p1 : g.p2;
  const iAmPlaced = myRole === "p2" ? g.placed2 : g.placed1;

  if (ms.phase === "setup") {
    if (!myRole || iAmPlaced) {
      return <p className="text-sm text-muted-foreground text-center py-6">Waiting for both fleets to deploy…</p>;
    }
    const nextIdx = placing.length;
    const nextShip = BS_FLEET[nextIdx];
    const taken = new Set(placing.flatMap((s) => s.cells));
    const shipColorOf = (cell: number): string | null => {
      for (let i = 0; i < placing.length; i++) {
        if (placing[i].cells.includes(cell)) return FLEET_COLORS[i];
      }
      return null;
    };
    const placeAt = (cell: number) => {
      if (!nextShip) return;
      const cells = bsShipCells(Math.floor(cell / BS_SIZE), cell % BS_SIZE, nextShip.size, horizontal);
      if (cells.length === 0 || cells.some((c) => taken.has(c))) return;
      setPlacing([...placing, { name: nextShip.name, size: nextShip.size, cells, hits: [] }]);
    };

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-center">
          <span className="text-sm">
            Placing: <span className="font-semibold">{nextShip ? `${nextShip.name} (${nextShip.size})` : "fleet ready"}</span>
          </span>
          <Button size="sm" variant="outline" onClick={() => setHorizontal(!horizontal)} aria-label="toggle ship direction">
            <RotateCw className="w-4 h-4 mr-1" /> {horizontal ? "Across" : "Down"}
          </Button>
          <Button size="sm" variant="outline" disabled={placing.length === 0} onClick={() => setPlacing(placing.slice(0, -1))}>
            <Undo2 className="w-4 h-4 mr-1" /> Undo
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPlacing(bsAutoPlace())}>
            <Wand2 className="w-4 h-4 mr-1" /> Auto-place
          </Button>
          <Button size="sm" disabled={placing.length !== BS_FLEET.length} onClick={() => onMove({ kind: "place", ships: placing })}>
            Deploy fleet
          </Button>
        </div>
        <div className="overflow-x-auto">
          <div
            className="grid gap-px mx-auto w-fit rounded-lg border border-border p-1 bg-zinc-900/60"
            style={{ gridTemplateColumns: `repeat(${BS_SIZE}, minmax(0, 1fr))` }}
            aria-label="your fleet grid"
          >
            {Array.from({ length: BS_SIZE * BS_SIZE }, (_, cell) => {
              const color = shipColorOf(cell);
              return (
                <button
                  key={cell}
                  aria-label={`place at ${coordName(cell)}`}
                  disabled={!nextShip}
                  onClick={() => placeAt(cell)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-sm border border-border/40 ${
                    color ?? "bg-zinc-950 hover:bg-accent"
                  } disabled:cursor-default`}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const myShipCells = new Map<number, string>();
  mySide.ships.forEach((ship, i) => {
    const color = bsSunk(ship) ? "bg-zinc-700" : FLEET_COLORS[i % FLEET_COLORS.length];
    ship.cells.forEach((c) => myShipCells.set(c, color));
  });
  const enemySunk = enemySide.ships.filter(bsSunk).length;
  const mySunk = mySide.ships.filter(bsSunk).length;

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase text-center">
            Enemy waters — click to fire {canMove && <span className="text-emerald-400">· your shot</span>}
          </p>
          <div className="overflow-x-auto">
            <div
              className="grid gap-px mx-auto w-fit rounded-lg border border-border p-1 bg-zinc-900/60"
              style={{ gridTemplateColumns: `repeat(${BS_SIZE}, minmax(0, 1fr))` }}
              aria-label="enemy waters"
            >
              {Array.from({ length: BS_SIZE * BS_SIZE }, (_, cell) => {
                const shot = enemySide.incoming[String(cell)];
                return (
                  <button
                    key={cell}
                    aria-label={`fire at ${coordName(cell)}`}
                    disabled={!canMove || shot !== undefined}
                    onClick={() => onMove({ kind: "fire", cell })}
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-sm border border-border/40 disabled:cursor-default ${
                      shot === "hit"
                        ? "bg-red-500"
                        : shot === "miss"
                          ? "bg-zinc-700"
                          : "bg-zinc-950 hover:bg-sky-900/60"
                    }`}
                  />
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">Sunk {enemySunk}/5 of their ships</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase text-center">
            Your waters · {mySunk}/5 of your ships sunk
          </p>
          <div className="overflow-x-auto">
            <div
              className="grid gap-px mx-auto w-fit rounded-lg border border-border p-1 bg-zinc-900/60"
              style={{ gridTemplateColumns: `repeat(${BS_SIZE}, minmax(0, 1fr))` }}
              aria-label="your waters"
            >
              {Array.from({ length: BS_SIZE * BS_SIZE }, (_, cell) => {
                const shipColor = myShipCells.get(cell);
                const shot = mySide.incoming[String(cell)];
                return (
                  <div
                    key={cell}
                    aria-label={`your waters ${coordName(cell)}`}
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-sm border border-border/40 flex items-center justify-center ${
                      shot === "hit" ? "bg-red-500" : shot === "miss" ? "bg-zinc-800" : shipColor ?? "bg-zinc-950"
                    }`}
                  >
                    {shot === "miss" && <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />}
                  </div>
                );
              })}
            </div>
          </div>
          <Card className="p-2.5">
            <div className="flex flex-wrap gap-2">
              {mySide.ships.map((ship) => (
                <span
                  key={ship.name}
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                    bsSunk(ship) ? "border-red-500/50 text-red-300 line-through" : "border-border text-muted-foreground"
                  }`}
                >
                  {ship.name}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">A hit lets you fire again — chain them to win.</p>
    </div>
  );
}
