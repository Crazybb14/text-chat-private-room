import { tttWinnerLine, type TttState } from "@/lib/games/tictactoe";
import { roleMark, type MatchState, type Role } from "@/lib/games/types";

interface Props {
  ms: MatchState<TttState>;
  myRole: Role | null;
  canMove: boolean;
  onMove: (move: unknown) => void;
}

export default function TicTacToeBoard({ ms, myRole, canMove, onMove }: Props) {
  void myRole;
  const line = tttWinnerLine(ms.game.board);
  const winSet = new Set(line ?? []);
  return (
    <div className="grid grid-cols-3 gap-2 w-fit mx-auto" aria-label="Tic tac toe board">
      {ms.game.board.map((v, i) => (
        <button
          key={i}
          aria-label={`square ${i + 1}`}
          disabled={!canMove || v !== null}
          onClick={() => onMove(i)}
          className={`w-24 h-24 sm:w-28 sm:h-28 rounded-xl border text-4xl font-black transition-colors disabled:cursor-default ${
            winSet.has(i) ? "border-emerald-400 bg-emerald-500/20" : "border-border bg-card hover:bg-accent"
          } ${v === "p1" ? "text-sky-400" : v === "p2" ? "text-amber-400" : "text-muted-foreground"}`}
        >
          {v ? roleMark(v) : ""}
        </button>
      ))}
    </div>
  );
}
