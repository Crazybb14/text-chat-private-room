import { useState } from "react";
import { BarChart3, Loader2, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { sendAnnouncement } from "@/lib/notifications";
import {
  closePoll,
  createPoll,
  deletePoll,
  getAllPolls,
  getAllVotes,
  MAX_POLL_OPTIONS,
  parseOptions,
  reopenPoll,
  tallyVotes,
  validatePoll,
  votePercentages,
  type PollRow,
  type PollVoteRow,
} from "@/lib/polls";
import { useAdminData } from "./useAdminData";

/** Create polls and watch live results. */
const AdminPolls = ({ createdBy }: { createdBy: string }) => {
  const { toast } = useToast();
  const { data, loading, error, refresh } = useAdminData(
    async () => {
      const [polls, votes] = await Promise.all([getAllPolls(), getAllVotes()]);
      return { polls, votes };
    },
    10000,
  );
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const setOption = (index: number, value: string) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));

  const handleCreate = async () => {
    const problem = validatePoll(question, options);
    if (problem) {
      toast({ title: problem, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await createPoll(question, options, createdBy);
      if (notify) {
        await sendAnnouncement("New poll", question.trim());
      }
      toast({
        title: "Poll is live",
        description: notify
          ? "Everyone got a notification and can vote on the home screen."
          : "People can vote on the home screen.",
      });
      setQuestion("");
      setOptions(["", ""]);
      await refresh();
    } catch {
      toast({ title: "Couldn't create that poll", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (poll: PollRow) => {
    setBusyId(poll._row_id);
    try {
      if (Number(poll.is_active) === 1) {
        await closePoll(poll._row_id);
        toast({ title: "Poll closed", description: "Votes are kept but nobody new can vote." });
      } else {
        await reopenPoll(poll._row_id);
        toast({ title: "Poll reopened" });
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (poll: PollRow) => {
    if (!window.confirm(`Delete "${poll.question}" and its votes?`)) return;
    setBusyId(poll._row_id);
    try {
      await deletePoll(poll._row_id);
      toast({ title: "Poll deleted" });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const polls = data?.polls ?? [];
  const votes = data?.votes ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4 text-primary" /> Create a poll
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="poll-question">Question</Label>
            <Input
              id="poll-question"
              value={question}
              maxLength={200}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What should the next movie night be?"
            />
          </div>
          <div className="space-y-2">
            <Label>Options (2–{MAX_POLL_OPTIONS})</Label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  aria-label={`Option ${index + 1}`}
                  value={option}
                  maxLength={80}
                  onChange={(e) => setOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                />
                {options.length > 2 && (
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < MAX_POLL_OPTIONS && (
              <Button variant="outline" size="sm" onClick={() => setOptions((prev) => [...prev, ""])}>
                <Plus className="w-4 h-4 mr-1" /> Add option
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch id="poll-notify" checked={notify} onCheckedChange={setNotify} />
            <Label htmlFor="poll-notify" className="text-sm font-normal">
              Notify everyone about this poll
            </Label>
          </div>
          <Button onClick={handleCreate} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}
            Post poll
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">All polls {polls.length > 0 && <span className="text-muted-foreground text-sm">({polls.length})</span>}</CardTitle>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && polls.length === 0 && (
            <p className="text-sm text-muted-foreground">No polls yet — create one above.</p>
          )}
          {polls.map((poll) => {
            const pollOptions = parseOptions(poll.options);
            const pollVotes = votes.filter((v: PollVoteRow) => v.poll_id === poll._row_id);
            const counts = tallyVotes(pollOptions, pollVotes);
            const percentages = votePercentages(counts);
            const total = counts.reduce((sum, c) => sum + c, 0);
            const best = Math.max(...counts, 0);
            const winner = total > 0 ? pollOptions[counts.indexOf(best)] : null;
            return (
              <div key={poll._row_id} className="rounded-lg border border-white/10 p-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-sm break-words">{poll.question}</p>
                  <Badge variant={Number(poll.is_active) === 1 ? "default" : "secondary"}>
                    {Number(poll.is_active) === 1 ? "open" : "closed"}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  {pollOptions.map((option, index) => (
                    <div key={option} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-300">{option}</span>
                        <span className="text-zinc-500">
                          {counts[index]} · {percentages[index]}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${winner === option ? "bg-emerald-400" : "bg-primary"}`}
                          style={{ width: `${percentages[index]}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {total} vote{total === 1 ? "" : "s"}
                    {winner ? ` · leading: ${winner}` : ""}
                  </span>
                  <span className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === poll._row_id}
                    onClick={() => handleToggle(poll)}
                  >
                    {Number(poll.is_active) === 1 ? "Close poll" : "Reopen"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/40"
                    disabled={busyId === poll._row_id}
                    onClick={() => handleDelete(poll)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPolls;
