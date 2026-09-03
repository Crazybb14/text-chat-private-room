import { hmDecode, hmWordLengths, HM_MISS_LIMIT, type HmState } from "@/lib/games/hangman";
import type { Difficulty, MatchState, Role } from "@/lib/games/types";

interface Props {
  ms: MatchState<HmState>;
  myRole: Role | null;
  canMove: boolean;
  onMove: (move: unknown) => void;
  difficulty: Difficulty;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function HangmanBoard({ ms, myRole, canMove, onMove, difficulty }: Props) {
  const g = ms.game;
  const word = hmDecode(g.word);
  const limit = HM_MISS_LIMIT[difficulty] ?? HM_MISS_LIMIT.medium;
  const myWrong = myRole === "p2" ? g.wrongP2 : g.wrongP1;
  const theirWrong = myRole === "p2" ? g.wrongP1 : g.wrongP2;
  void hmWordLengths;

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <span className="inline-block text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border text-muted-foreground">
          Category: {g.category}
        </span>
        <div className="flex justify-center gap-1.5 flex-wrap" aria-label="hangman word">
          {word.split("").map((ch, i) => (
            <span
              key={i}
              className={`w-8 h-10 sm:w-9 sm:h-11 rounded-lg border flex items-center justify-center text-xl font-bold ${
                g.revealed.includes(ch) || ms.phase === "done"
                  ? "bg-card border-border text-foreground"
                  : "bg-zinc-900/60 border-border/60 text-transparent"
              }`}
            >
              {g.revealed.includes(ch) || ms.phase === "done" ? ch : "?"}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
        <Meter label="Your misses" letters={myWrong ?? []} limit={limit} />
        <Meter label="Their misses" letters={theirWrong ?? []} limit={limit} hide />
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5" aria-label="letter keyboard">
          {LETTERS.map((letter) => {
            const used = g.used.includes(letter);
            const hit = g.revealed.includes(letter);
            return (
              <button
                key={letter}
                aria-label={`letter ${letter}`}
                disabled={!canMove || used}
                onClick={() => onMove({ letter })}
                className={`h-9 rounded-lg border text-sm font-bold transition-colors ${
                  used
                    ? hit
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                      : "border-red-500/40 bg-red-500/10 text-red-300/70 line-through"
                    : "border-border bg-card hover:bg-accent"
                } disabled:cursor-default`}
              >
                {letter}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          A correct letter keeps your turn. Too many misses and you lose the round.
        </p>
      </div>
    </div>
  );
}

function Meter({ label, letters, limit, hide = false }: { label: string; letters: string[]; limit: number; hide?: boolean }) {
  void hide;
  return (
    <div className="rounded-xl border border-border p-2.5 space-y-1">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase">
        {label} · {letters.length}/{limit}
      </p>
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${letters.length / limit > 0.6 ? "bg-red-500" : "bg-amber-500"}`}
          style={{ width: `${Math.min(100, (letters.length / limit) * 100)}%` }}
        />
      </div>
      <p className="text-xs font-mono text-muted-foreground">{letters.length > 0 ? letters.join(" ") : "—"}</p>
    </div>
  );
}
