import { C4_COLS, C4_ROWS, c4WinnerCells, type C4State } from "@/lib/games/connect4";
import type { MatchState, Role } from "@/lib/games/types";

interface Props {
  ms: MatchState<C4State>;
  myRole: Role | null;
  canMove: boolean;
  onMove: (move: unknown) => void;
}

export default function Connect4Board({ ms, myRole, canMove, onMove }: Props) {
  void myRole;
  const { cells } = c4WinnerCells(ms.game.board);
  const winSet = new Set(cells);
  const fullCols = new Set<number>();
  for (let c = 0; c < C4_COLS; c++) {
    if (ms.game.board[c] !== null) fullCols.add(c);
  }

  return (
    <div className="w-fit mx-auto space-y-2">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${C4_COLS}, minmax(0, 1fr))` }}>
        {Array.from({ length: C4_COLS }, (_, c) => (
          <button
            key={`drop-${c}`}
            aria-label={`drop column ${c + 1}`}
            disabled={!canMove || fullCols.has(c)}
            onClick={() => onMove(c)}
            className="h-8 rounded-lg border border-border bg-card text-muted-foreground text-xs font-semibold hover:bg-accent disabled:opacity-40"
          >
            ▼
          </button>
        ))}
      </div>
      <div
        className="rounded-xl bg-zinc-900/70 border border-border p-2 grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${C4_COLS}, minmax(0, 1fr))` }}
        aria-label="Connect four board"
      >
        {Array.from({ length: C4_ROWS * C4_COLS }, (_, i) => {
          const v = ms.game.board[i];
          return (
            <div
              key={i}
              aria-label={`cell ${i}`}
              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full border flex items-center justify-center ${
                winSet.has(i) ? "border-emerald-400 ring-2 ring-emerald-400/60" : "border-border/60"
              } ${v === null ? "bg-zinc-950" : v === "p1" ? "bg-red-500" : "bg-amber-400"}`}
            />
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        <span className="inline-block w-3 h-3 rounded-full bg-red-500 align-middle" /> Player 1 ·{" "}
        <span className="inline-block w-3 h-3 rounded-full bg-amber-400 align-middle" /> Player 2
      </p>
    </div>
  );
}
