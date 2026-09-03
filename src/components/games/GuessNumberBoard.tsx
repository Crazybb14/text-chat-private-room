import { useState } from "react";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { gnFeasible, GN_RANGES, type GnState } from "@/lib/games/guessNumber";
import type { Difficulty, MatchState, Role } from "@/lib/games/types";

interface Props {
  ms: MatchState<GnState>;
  myRole: Role | null;
  canMove: boolean;
  onMove: (move: unknown) => void;
  difficulty: Difficulty;
}

function ResultChip({ result }: { result: "high" | "low" | "exact" }) {
  const style =
    result === "exact"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : result === "high"
        ? "bg-red-500/15 text-red-300 border-red-500/40"
        : "bg-sky-500/15 text-sky-300 border-sky-500/40";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${style}`}>{result === "exact" ? "EXACT" : result === "high" ? "TOO HIGH" : "TOO LOW"}</span>;
}

export default function GuessNumberBoard({ ms, myRole, canMove, onMove, difficulty }: Props) {
  const [secret, setSecret] = useState("");
  const [guess, setGuess] = useState("");
  const g = ms.game;

  if (ms.phase === "setup" && myRole) {
    const mine = myRole === "p1" ? g.secretP1 : g.secretP2;
    const range = GN_RANGES[difficulty] ?? GN_RANGES.medium;
    if (mine === null) {
      return (
        <div className="space-y-3 max-w-sm mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            Pick your secret number between {g.min} and {g.max}. Your opponent has to guess it.
          </p>
          <div className="flex gap-2">
            <Input
              aria-label="Your secret number"
              type="number"
              min={g.min}
              max={g.max}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={`${g.min}–${g.max}`}
            />
            <Button variant="outline" size="sm" aria-label="Random secret number" onClick={() => setSecret(String(range.min + Math.floor(Math.random() * (range.max - range.min + 1))))}>
              <Dices className="w-4 h-4" />
            </Button>
            <Button
              disabled={!secret.trim()}
              onClick={() => onMove({ kind: "setSecret", value: Number(secret) })}
            >
              Lock in
            </Button>
          </div>
        </div>
      );
    }
    return <p className="text-sm text-muted-foreground text-center">Secret locked in — waiting for the other player…</p>;
  }

  const myGuesses = myRole === "p2" ? g.guessesP2 : g.guessesP1;
  const theirGuesses = myRole === "p2" ? g.guessesP1 : g.guessesP2;
  const mySecret = myRole === "p2" ? g.secretP2 : g.secretP1;
  const feasible = myRole ? gnFeasible(g, myRole) : { min: g.min, max: g.max };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Your guesses (at their number)</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...myGuesses].reverse().map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono">{entry.value}</span>
                <ResultChip result={entry.result} />
              </div>
            ))}
            {myGuesses.length === 0 && <p className="text-xs text-muted-foreground">No guesses yet.</p>}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Numbers left: {feasible.max - feasible.min + 1} (between {feasible.min} and {feasible.max})
          </p>
        </div>
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Their guesses {mySecret !== null && <span className="normal-case">(your number is {mySecret})</span>}
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {[...theirGuesses].reverse().map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-mono">{entry.value}</span>
                <ResultChip result={entry.result} />
              </div>
            ))}
            {theirGuesses.length === 0 && <p className="text-xs text-muted-foreground">No guesses yet.</p>}
          </div>
        </div>
      </div>
      <div className="flex gap-2 max-w-xs mx-auto">
        <Input
          aria-label="Number guess"
          type="number"
          min={g.min}
          max={g.max}
          value={guess}
          disabled={!canMove}
          onChange={(e) => setGuess(e.target.value)}
          placeholder={`Guess ${g.min}–${g.max}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && guess.trim() && canMove) {
              onMove({ kind: "guess", guess: Number(guess) });
              setGuess("");
            }
          }}
        />
        <Button
          disabled={!canMove || !guess.trim()}
          onClick={() => {
            onMove({ kind: "guess", guess: Number(guess) });
            setGuess("");
          }}
        >
          Guess
        </Button>
      </div>
    </div>
  );
}
