import { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { recentAnnouncements, sendAnnouncement, type SiteNotification } from "@/lib/notifications";

const fmtTime = (value: number) =>
  value
    ? new Date(value * (value > 1e11 ? 1 : 1000)).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "unknown";

/** Compose and send a notification that reaches every account on the site. */
const AdminNotifications = () => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<SiteNotification[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await recentAnnouncements());
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    try {
      const count = await sendAnnouncement(title, message);
      toast({
        title: "Notification sent",
        description: count > 0 ? `Delivered to ${count} account${count === 1 ? "" : "s"}.` : "No accounts to receive it yet.",
      });
      setTitle("");
      setMessage("");
      loadHistory();
    } catch {
      toast({ title: "Couldn't send that notification", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" /> Send a notification to everyone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notif-title">Title</Label>
            <Input
              id="notif-title"
              placeholder="e.g. Site update tonight"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notif-message">Message</Label>
            <Textarea
              id="notif-message"
              placeholder="What should everyone know?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
            />
          </div>
          <Button onClick={handleSend} disabled={sending || !title.trim() || !message.trim()}>
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send to everyone
          </Button>
          <p className="text-xs text-muted-foreground">
            Every account sees it in their notification bell, and anyone who allowed browser
            notifications gets a pop-up on their screen.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent broadcasts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No notifications have been sent yet.</p>
          )}
          {history.slice(0, 15).map((row) => (
            <div key={row._row_id} className="border-b border-white/5 pb-2">
              <p className="text-sm font-medium">{row.title}</p>
              <p className="text-sm text-muted-foreground break-words">{row.message}</p>
              <p className="text-xs text-muted-foreground">
                Sent to @{row.recipient_username ?? "unknown"} · {fmtTime(row._created_at)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
};

export default AdminNotifications;
