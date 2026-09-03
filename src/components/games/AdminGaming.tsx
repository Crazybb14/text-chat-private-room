import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Box,
  CircleDot,
  Flag,
  Hash,
  LayoutGrid,
  Plus,
  RefreshCw,
  Ship,
  Type,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAdminSession } from "@/lib/adminAccounts";
import {
  DIFFICULTIES,
  GAME_CATALOG,
  type Difficulty,
  type GameType,
  type MatchState,
} from "@/lib/games";
import type { TttState } from "@/lib/games/tictactoe";
import type { C4State } from "@/lib/games/connect4";
import type { GnState } from "@/lib/games/guessNumber";
import type { BsStateFull } from "@/lib/games/battleship";
import type { GwState } from "@/lib/games/guessWho";
import type { HmState } from "@/lib/games/hangman";
import type { T3State } from "@/lib/games/tictactoe3d";
import {
  createMatch,
  describeOutcome,
  fetchMatches,
  fetchRecentGameChat,
  joinMatch,
  matchTitle,
  myMatches,
  needsAiMove,
  openChallenges,
  parseMatchState,
  resignMatch,
  roleFor,
  submitAiMove,
  submitMove,
  type GameChatRow,
  type GameMatchRow,
} from "@/lib/gameMatches";
import TicTacToeBoard from "./TicTacToeBoard";
import Connect4Board from "./Connect4Board";
import GuessNumberBoard from "./GuessNumberBoard";
import BattleshipBoard from "./BattleshipBoard";
import GuessWhoBoard from "./GuessWhoBoard";
import HangmanBoard from "./HangmanBoard";
import TicTacToe3DBoard from "./TicTacToe3DBoard";
import GameChatPanel from "./GameChatPanel";

const GAME_ICONS: Record<GameType, LucideIcon> = {
  tictactoe: LayoutGrid,
  connect4: CircleDot,
  guessnumber: Hash,
  battleship: Ship,
  guesswho: Users,
  hangman: Type,
  tictactoe3d: Box,
};

interface Props {
  username: string;
}

export default function AdminGaming({ username }: Props) {
  // Prefer the signed-in site account; staff admins fall back to their panel name.
  const me = username.trim() || getAdminSession()?.username || "admin";
  const { toast } = useToast();
  const [matches, setMatches] = useState<GameMatchRow[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [monitor, setMonitor] = useState<GameChatRow[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [gType, setGType] = useState<GameType>("tictactoe");
  const [gMode, setGMode] = useState<"ai" | "multiplayer">("ai");
  const [gDiff, setGDiff] = useState<Difficulty>("medium");
  const [gOpp, setGOpp] = useState("");

  const activeRow = useMemo(() => matches.find((m) => m._row_id === activeId) ?? null, [matches, activeId]);
  const ms = useMemo(() => (activeRow ? parseMatchState(activeRow) : null), [activeRow]);
  const myRole = activeRow ? roleFor(activeRow, me) : null;
  const canMove = Boolean(ms && myRole && ms.phase === "playing" && ms.turn === myRole);

  const refresh = useCallback(async () => {
    try {
      setMatches(await fetchMatches());
    } catch {
      /* transient network error — the next poll retries */
    }
  }, []);

  const refreshMonitor = useCallback(async () => {
    try {
      setMonitor(await fetchRecentGameChat(30));
    } catch {
      /* transient network error — the next poll retries */
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshMonitor();
    const poll = setInterval(() => {
      void refresh();
    }, 2500);
    const slowPoll = setInterval(() => {
      void refreshMonitor();
    }, 15000);
    return () => {
      clearInterval(poll);
      clearInterval(slowPoll);
    };
  }, [refresh, refreshMonitor]);

  // When a match against the AI is waiting on the bot, play its move.
  const aiBusy = useRef(false);
  useEffect(() => {
    const row = matches.find((m) => m._row_id === activeId);
    if (!row || aiBusy.current || !needsAiMove(row)) return;
    aiBusy.current = true;
    const timer = setTimeout(async () => {
      try {
        const outcome = await submitAiMove(row);
        if (!outcome.ok) {
          toast({ title: "The AI stumbled", description: outcome.error });
        }
        await refresh();
      } catch {
        /* the next poll picks it back up */
      } finally {
        aiBusy.current = false;
      }
    }, 650);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, activeId]);

  useEffect(() => {
    if (activeId === null) void refreshMonitor();
  }, [activeId, refreshMonitor]);

  const handleMove = async (move: unknown) => {
    if (!activeRow) return;
    const outcome = await submitMove(activeRow, me, move);
    if (!outcome.ok) {
      toast({ title: "Can't do that", description: outcome.error });
      return;
    }
    setMatches((prev) => prev.map((m) => (m._row_id === outcome.row._row_id ? outcome.row : m)));
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const row = await createMatch({
        gameType: gType,
        mode: gMode,
        difficulty: gDiff,
        username: me,
        opponent: gOpp,
      });
      setNewOpen(false);
      setGOpp("");
      await refresh();
      setActiveId(row._row_id);
    } catch {
      toast({ title: "Couldn't start the game", description: "Please try again." });
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (row: GameMatchRow) => {
    try {
      await joinMatch(row._row_id, me);
      await refresh();
      setActiveId(row._row_id);
    } catch {
      toast({ title: "Couldn't join", description: "Please try again." });
    }
  };

  const handleResign = async () => {
    if (!activeRow || !myRole) return;
    try {
      await resignMatch(activeRow, me);
      await refresh();
    } catch {
      toast({ title: "Couldn't resign", description: "Please try again." });
    }
  };

  const mine = myMatches(matches, me);
  const challenges = openChallenges(matches, me);
  const spectate = matches.filter(
    (m) => m.status === "active" && m.player1 !== me && m.player2 !== me,
  );
  const matchById = useMemo(() => new Map(matches.map((m) => [m._row_id, m])), [matches]);

  /* ---------------------------------- lobby --------------------------------- */

  if (!activeRow) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" /> Gaming lounge
              </p>
              <p className="text-xs text-muted-foreground">
                Playing as @{me} · single player against the AI (easy → impossible) or invite another admin.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void refresh()}>
                <RefreshCw className="w-4 h-4 mr-1" /> Refresh
              </Button>
              <Button size="sm" onClick={() => setNewOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> New game
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Your matches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mine.length === 0 && (
                <p className="text-xs text-muted-foreground">No games yet — start one with “New game”.</p>
              )}
              {mine.slice(0, 8).map((row) => {
                const Icon = GAME_ICONS[row.game_type];
                return (
                  <div key={row._row_id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{matchTitle(row)}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {describeOutcome(row, me)}
                          {row.difficulty ? ` · ${row.difficulty}` : ""}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setActiveId(row._row_id)}>
                      Open
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Open challenges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {challenges.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nobody is waiting for an opponent right now.</p>
                )}
                {challenges.map((row) => {
                  const Icon = GAME_ICONS[row.game_type];
                  return (
                    <div key={row._row_id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{GAME_CATALOG.find((g) => g.type === row.game_type)?.name ?? row.game_type}</p>
                          <p className="text-xs text-muted-foreground truncate">from @{row.player1}</p>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => void handleJoin(row)}>
                        Join
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Live matches · staff view</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {spectate.length === 0 && <p className="text-xs text-muted-foreground">No other matches in progress.</p>}
                {spectate.slice(0, 6).map((row) => {
                  const Icon = GAME_ICONS[row.game_type];
                  return (
                    <div key={row._row_id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            @{row.player1} vs {row.player2 ? `@${row.player2}` : "?"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {GAME_CATALOG.find((g) => g.type === row.game_type)?.name ?? row.game_type}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setActiveId(row._row_id)}>
                        Watch
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Game chat monitor · admins only</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {monitor.length === 0 && <p className="text-xs text-muted-foreground">No game chat yet.</p>}
            {monitor.map((line) => {
              const row = matchById.get(line.match_id);
              const label = row ? `${GAME_CATALOG.find((g) => g.type === row.game_type)?.name ?? row.game_type} · @${row.player1} vs @${row.player2 ?? "?"}` : `match #${line.match_id}`;
              return (
                <p key={line._row_id} className="text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-sky-400 font-semibold"> @{line.sender}:</span>{" "}
                  <span className="text-foreground/85 break-words">{line.text}</span>
                </p>
              );
            })}
          </CardContent>
        </Card>

        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Start a game</DialogTitle>
              <DialogDescription>Play the AI at four difficulty levels, or invite another player by username.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {GAME_CATALOG.map((g) => {
                const Icon = GAME_ICONS[g.type];
                const selected = gType === g.type;
                return (
                  <button
                    key={g.type}
                    aria-label={`choose ${g.name}`}
                    onClick={() => setGType(g.type)}
                    className={`rounded-xl border p-3 text-left space-y-1 transition-colors ${
                      selected ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon className="w-4 h-4 text-primary" />
                      <Badge variant="secondary" className="text-[10px]">{g.dimension}</Badge>
                    </div>
                    <p className="text-sm font-semibold">{g.name}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug">{g.blurb}</p>
                  </button>
                );
              })}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Opponent</Label>
                <Select value={gMode} onValueChange={(v) => setGMode(v as "ai" | "multiplayer")}>
                  <SelectTrigger aria-label="Opponent type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">Play the AI</SelectItem>
                    <SelectItem value="multiplayer">Play a person</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {gMode === "ai" ? (
                <div className="space-y-1.5">
                  <Label>AI difficulty</Label>
                  <Select value={gDiff} onValueChange={(v) => setGDiff(v as Difficulty)}>
                    <SelectTrigger aria-label="AI difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d === "impossible" ? "Impossible (never slips)" : d[0].toUpperCase() + d.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="opponent-name">Opponent username (blank = open challenge)</Label>
                  <Input
                    id="opponent-name"
                    value={gOpp}
                    onChange={(e) => setGOpp(e.target.value)}
                    placeholder="e.g. bex"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleCreate()} disabled={creating}>
                {creating ? "Starting…" : "Create match"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ------------------------------- match view ------------------------------- */

  const opponentName = myRole === "p2" ? activeRow.player1 : activeRow.player2 ?? "waiting…";
  const lastLog = ms ? ms.log.slice(-3) : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActiveId(null)} aria-label="Back to games">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <p className="font-semibold">{matchTitle(activeRow)}</p>
          {activeRow.difficulty && <Badge variant="secondary">{activeRow.difficulty}</Badge>}
          <span className="text-sm text-muted-foreground">
            @
            {myRole === "p1" ? activeRow.player1 : activeRow.player2 ?? "?"} vs {opponentName.startsWith("AI") ? opponentName : `@${opponentName}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{describeOutcome(activeRow, me)}</p>
          {myRole && activeRow.status !== "finished" && (
            <Button variant="outline" size="sm" onClick={() => void handleResign()}>
              <Flag className="w-4 h-4 mr-1" /> Resign
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardContent className="py-5">
            {renderBoard(activeRow, ms, myRole, canMove, handleMove)}
            {lastLog.length > 0 && (
              <div className="mt-5 pt-3 border-t border-border space-y-0.5">
                {lastLog.map((line, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">
                    {line.text}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <GameChatPanel matchId={activeRow._row_id} me={me} opponent={opponentName.startsWith("AI") ? "AI" : opponentName} />
      </div>
    </div>
  );
}

function renderBoard(
  row: GameMatchRow,
  ms: MatchState<unknown> | null,
  myRole: ReturnType<typeof roleFor>,
  canMove: boolean,
  onMove: (move: unknown) => void,
) {
  if (!ms) return <p className="text-sm text-muted-foreground text-center py-10">Loading the board…</p>;
  const difficulty = (row.difficulty ?? "medium") as Difficulty;
  switch (row.game_type) {
    case "tictactoe":
      return <TicTacToeBoard ms={ms as unknown as MatchState<TttState>} myRole={myRole} canMove={canMove} onMove={onMove} />;
    case "connect4":
      return <Connect4Board ms={ms as unknown as MatchState<C4State>} myRole={myRole} canMove={canMove} onMove={onMove} />;
    case "guessnumber":
      return <GuessNumberBoard ms={ms as unknown as MatchState<GnState>} myRole={myRole} canMove={canMove} onMove={onMove} difficulty={difficulty} />;
    case "battleship":
      return <BattleshipBoard ms={ms as unknown as MatchState<BsStateFull>} myRole={myRole} canMove={canMove} onMove={onMove} />;
    case "guesswho":
      return <GuessWhoBoard ms={ms as unknown as MatchState<GwState>} myRole={myRole} canMove={canMove} onMove={onMove} />;
    case "hangman":
      return <HangmanBoard ms={ms as unknown as MatchState<HmState>} myRole={myRole} canMove={canMove} onMove={onMove} difficulty={difficulty} />;
    case "tictactoe3d":
      return <TicTacToe3DBoard ms={ms as unknown as MatchState<T3State>} myRole={myRole} canMove={canMove} onMove={onMove} />;
    default:
      return <p className="text-sm text-muted-foreground text-center py-10">Unknown game.</p>;
  }
}
