import { useState } from "react";
import { t3WinnerLine, type T3State } from "@/lib/games/tictactoe3d";
import { roleMark, type MatchState, type Role } from "@/lib/games/types";

interface Props {
  ms: MatchState<T3State>;
  myRole: Role | null;
  canMove: boolean;
  onMove: (move: unknown) => void;
}

const LAYER_NAMES = ["Bottom", "Middle", "Top"];

export default function TicTacToe3DBoard({ ms, myRole, canMove, onMove }: Props) {
  void myRole;
  const [view, setView] = useState<"3d" | "flat">("3d");
  const line = t3WinnerLine(ms.game.board);
  const winSet = new Set(line ?? []);

  const cell = (idx: number) => {
    const v = ms.game.board[idx];
    const layer = Math.floor(idx / 9);
    const spot = (idx % 9) + 1;
    return (
      <button
        key={idx}
        aria-label={`${LAYER_NAMES[layer].toLowerCase()} board spot ${spot}`}
        disabled={!canMove || v !== null}
        onClick={() => onMove(idx)}
        className={`aspect-square w-full rounded-lg border flex items-center justify-center text-2xl font-black transition-colors disabled:cursor-default ${
          winSet.has(idx) ? "border-emerald-400 bg-emerald-500/25" : "border-border bg-card/90 hover:bg-accent"
        } ${v === "p1" ? "text-sky-400" : "text-amber-400"}`}
      >
        <span
          className="inline-block"
          style={view === "3d" ? { transform: "rotateZ(45deg) rotateX(-56deg)" } : undefined}
        >
          {v ? roleMark(v) : ""}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-center gap-2">
        <Button3dView active={view === "3d"} onClick={() => setView("3d")} label="3D view" />
        <Button3dView active={view === "flat"} onClick={() => setView("flat")} label="Flat view" />
      </div>

      {view === "3d" ? (
        <div className="flex justify-center py-4" style={{ perspective: "950px" }}>
          <div
            className="relative h-[300px] w-[280px] sm:h-[340px] sm:w-[320px]"
            style={{ transform: "rotateX(56deg) rotateZ(-45deg)", transformStyle: "preserve-3d" }}
          >
            {[0, 1, 2].map((layer) => (
              <div key={layer} className="absolute inset-0" style={{ transform: `translateZ(${layer * 100}px)` }}>
                <div className="grid grid-cols-3 gap-2">{Array.from({ length: 9 }, (_, i) => cell(layer * 9 + i))}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {LAYER_NAMES.map((name, layer) => (
            <div key={name} className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground text-center">{name} board</p>
              <div className="grid grid-cols-3 gap-1.5">{Array.from({ length: 9 }, (_, i) => cell(layer * 9 + i))}</div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground text-center">
        Three boards stacked — a line can run across a single board or straight through all three layers.
      </p>
    </div>
  );
}

function Button3dView({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
        active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );
}
