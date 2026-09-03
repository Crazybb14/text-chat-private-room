import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GW_CHARS, GW_QUESTIONS, type GwState } from "@/lib/games/guessWho";
import type { MatchState, Role } from "@/lib/games/types";

interface Props {
  ms: MatchState<GwState>;
  myRole: Role | null;
  canMove: boolean;
  onMove: (move: unknown) => void;
}

function HairDot({ i }: { i: number }) {
  const c = GW_CHARS[i];
  const color = c.blonde ? "bg-yellow-400" : c.red ? "bg-red-500" : "bg-slate-600";
  const label = c.blonde ? "blonde hair" : c.red ? "red hair" : "dark hair";
  return <span title={label} aria-label={label} className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
}

function TraitBadges({ i }: { i: number }) {
  const c = GW_CHARS[i];
  return (
    <span className="flex gap-1 items-center text-[10px] leading-none">
      {c.female ? <span title="woman">♀</span> : <span title="man">♂</span>}
      <HairDot i={i} />
      {c.glasses && <span title="glasses">👓</span>}
      {c.hat && <span title="hat">🎩</span>}
      {c.beard && <span title="beard">🧔</span>}
      {c.mustache && <span title="mustache" className="font-bold">⌒</span>}
      {c.smile && <span title="smiling">😄</span>}
      {c.earrings && <span title="earrings">💎</span>}
    </span>
  );
}

export default function GuessWhoBoard({ ms, myRole, canMove, onMove }: Props) {
  const [question, setQuestion] = useState("");
  const [guessPick, setGuessPick] = useState<number | null>(null);
  const g = ms.game;

  const asked = myRole === "p2" ? g.askedP2 : g.askedP1;
  const mySecret = myRole === "p2" ? g.secretP2 : g.secretP1;
  const candidates = myRole === "p2" ? g.candP2 : g.candP1;
  const unasked = GW_QUESTIONS.filter((q) => !asked.includes(q.key));

  const grid = (mode: "pick" | "play") => (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5" aria-label="guess who board">
      {GW_CHARS.map((c, i) => {
        const alive = candidates.includes(i);
        const picked = guessPick === i;
        const clickable = mode === "pick" ? myRole !== null && mySecret === null : true;
        return (
          <button
            key={c.name}
            aria-label={`character ${c.name}`}
            disabled={!clickable}
            onClick={() => (mode === "pick" ? onMove({ kind: "pick", char: i }) : setGuessPick(picked ? null : i))}
            className={`rounded-lg border p-1.5 flex flex-col items-center gap-1 transition-all ${
              mode === "play" && !alive
                ? "opacity-30 grayscale border-border/40"
                : picked
                  ? "border-sky-400 bg-sky-500/15"
                  : "border-border bg-card hover:bg-accent"
            }`}
          >
            <span className="text-sm font-semibold">{c.name}</span>
            <TraitBadges i={i} />
          </button>
        );
      })}
    </div>
  );

  if (ms.phase === "setup") {
    if (!myRole || mySecret !== null) {
      return (
        <div className="space-y-3">
          {grid("play")}
          <p className="text-sm text-muted-foreground text-center">Waiting for both sides to choose…</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground text-center">Tap the character you want to be your mystery person.</p>
        {grid("pick")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          Your person: <span className="font-semibold text-sky-400">{mySecret !== null ? GW_CHARS[mySecret].name : "?"}</span>
        </p>
        <p className="text-xs text-muted-foreground">{candidates.length} left on their board</p>
      </div>

      {grid("play")}

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={question || undefined} onValueChange={setQuestion}>
          <SelectTrigger className="w-72" aria-label="Question to ask">
            <SelectValue placeholder="Ask a question…" />
          </SelectTrigger>
          <SelectContent>
            {unasked.map((q) => (
              <SelectItem key={q.key} value={q.key}>
                {q.text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!canMove || !question || unasked.length === 0}
          onClick={() => {
            if (question) onMove({ kind: "ask", q: question });
            setQuestion("");
          }}
        >
          Ask
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={!canMove || guessPick === null}
          onClick={() => {
            if (guessPick !== null) onMove({ kind: "guess", char: guessPick });
            setGuessPick(null);
          }}
        >
          Guess {guessPick !== null ? GW_CHARS[guessPick].name : ""}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">A wrong guess loses the round — only guess when you're sure.</p>

      {g.events.length > 0 && (
        <Card className="p-3">
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {[...g.events].reverse().slice(0, 10).map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                {e}
              </p>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
