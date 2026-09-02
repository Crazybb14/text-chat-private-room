import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  castVote,
  getAllVotes,
  getActivePolls,
  hasVoted,
  parseOptions,
  tallyVotes,
  votePercentages,
  type PollRow,
  type PollVoteRow,
} from "@/lib/polls";

const PollCard = ({ username }: { username: string | null }) => {
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [votes, setVotes] = useState<PollVoteRow[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    try {
      const [activePolls, allVotes] = await Promise.all([getActivePolls(), getAllVotes()]);
      setPolls(activePolls);
      setVotes(allVotes);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  if (polls.length === 0) return null;

  const handleVote = async (poll: PollRow, index: number) => {
    if (!username) return;
    setBusy(poll._row_id);
    try {
      const result = await castVote(poll._row_id, username, index, parseOptions(poll.options).length);
      if (result.ok) {
        await load();
      } else {
        setErrors((prev) => ({ ...prev, [poll._row_id]: result.reason }));
        await load();
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Polls" className="rounded-xl border border-white/10 bg-[var(--dc-side)] p-5 space-y-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h2 className="text-base font-semibold text-zinc-100">Polls</h2>
        <span className="text-xs text-zinc-500">Tell us what you think</span>
      </div>
      <div className="space-y-5">
        {polls.map((poll) => {
          const options = parseOptions(poll.options);
          const pollVotes = votes.filter((v) => v.poll_id === poll._row_id);
          const counts = tallyVotes(options, pollVotes);
          const percentages = votePercentages(counts);
          const total = counts.reduce((sum, c) => sum + c, 0);
          const voted = username ? hasVoted(pollVotes, username) : false;
          const myVote = pollVotes.find((v) => v.username === username);
          return (
            <div key={poll._row_id} className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
              <p className="font-medium text-zinc-100 break-words">{poll.question}</p>
              <div className="space-y-2">
                {options.map((option, index) => {
                  const mine = voted && myVote?.option_index === index;
                  const row = (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-zinc-200 min-w-0">
                        <span className="truncate">{option}</span>
                        {mine && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
                      </span>
                      <span className="text-zinc-400 shrink-0">
                        {percentages[index]}% ({counts[index]})
                      </span>
                    </div>
                  );
                  if (voted) {
                    return (
                      <div key={option} className="space-y-1">
                        {row}
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${mine ? "bg-emerald-400" : "bg-primary"}`}
                            style={{ width: `${percentages[index]}%` }}
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <Button
                      key={option}
                      variant="outline"
                      className="w-full justify-between border-white/15 text-zinc-200 hover:bg-white/10"
                      disabled={busy === poll._row_id || !username}
                      onClick={() => handleVote(poll, index)}
                    >
                      <span className="truncate">{option}</span>
                      <Vote className="w-4 h-4 shrink-0 opacity-60" />
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-zinc-500">
                {total} vote{total === 1 ? "" : "s"}
                {voted ? " · thanks for voting" : username ? "" : " · sign in to vote"}
                {errors[poll._row_id] ? ` · ${errors[poll._row_id]}` : ""}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default PollCard;
