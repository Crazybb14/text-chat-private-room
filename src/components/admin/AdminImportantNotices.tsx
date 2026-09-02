import { useState } from "react";
import { Loader2, Megaphone, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  createImportantNotice,
  deactivateNotice,
  deleteImportantNotice,
  getAllImportantNotices,
  reactivateNotice,
  isNoticeActive,
} from "@/lib/importantNotices";
import { useAdminData } from "./useAdminData";

const fmtTime = (value: number) =>
  value
    ? new Date(value * (value > 1e11 ? 1 : 1000)).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "unknown";

/**
 * Manage the big "important" banners: the ones that pop onto every screen
 * until each reader dismisses them.
 */
const AdminImportantNotices = ({ createdBy }: { createdBy: string }) => {
  const { toast } = useToast();
  const { data, loading, error, refresh } = useAdminData(getAllImportantNotices, 15000);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const notices = data ?? [];

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Add a title and a message", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await createImportantNotice(title, message, createdBy);
      toast({
        title: "Important announcement is live",
        description: "Everyone sees a big banner on every screen until they dismiss it.",
      });
      setTitle("");
      setMessage("");
      await refresh();
    } catch {
      toast({ title: "Couldn't post that announcement", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    setBusyId(id);
    try {
      if (active) await deactivateNotice(id);
      else await reactivateNotice(id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this announcement? Nobody will see the banner again.")) return;
    setBusyId(id);
    try {
      await deleteImportantNotice(id);
      toast({ title: "Announcement deleted" });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="w-4 h-4 text-amber-400" />
            Post an important announcement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="notice-title">Title</Label>
            <Input
              id="notice-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Site update tonight at 9pm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notice-message">Message</Label>
            <Textarea
              id="notice-message"
              value={message}
              maxLength={1000}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="The site will be briefly offline while we move to faster servers."
              rows={4}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Shows as a big banner on every screen — the lobby, chats, DMs, settings — until each
            person taps “Got it”.
          </p>
          <Button onClick={handleCreate} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
            Post banner
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">All important announcements</CardTitle>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && notices.length === 0 && (
            <p className="text-sm text-muted-foreground">No important announcements yet.</p>
          )}
          {notices.map((notice) => (
            <div
              key={notice._row_id}
              className="rounded-lg border border-white/10 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm break-words">{notice.title}</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-line break-words">
                    {notice.message}
                  </p>
                </div>
                <Badge variant={isNoticeActive(notice) ? "default" : "secondary"}>
                  {isNoticeActive(notice) ? "showing" : "off"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{fmtTime(Number(notice._created_at))}</span>
                <span className="flex-1" />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === notice._row_id}
                  onClick={() => handleToggle(notice._row_id, isNoticeActive(notice))}
                >
                  {isNoticeActive(notice) ? "Turn off" : "Show again"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40"
                  disabled={busyId === notice._row_id}
                  onClick={() => handleDelete(notice._row_id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminImportantNotices;
