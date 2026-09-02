import { useState } from "react";
import { Eraser, FlaskConical, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { functions } from "@/lib/shared/kliv-functions.js";
import { useAppSettings, settingBool, filterMessage } from "@/lib/appSettings";
import { findViolation } from "@/lib/moderation";
import { useAdminData } from "./useAdminData";

interface RoomLite {
  _row_id: number;
  name: string;
  [key: string]: unknown;
}

const fmtTime = (value: number) =>
  value
    ? new Date(value * (value > 1e11 ? 1 : 1000)).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "never";

/** Clean up old messages and check the hourly auto-cleanup. */
const AdminMessageCleanup = () => {
  const { toast } = useToast();
  const { data: roomData, loading, error } = useAdminData(
    () => db.query<RoomLite>("rooms", { order: "_row_id.asc" }),
  );
  const { data: purgeData } = useAdminData(
    () => db.query<{ setting_key: string; setting_value: string }>("admin_settings"),
  );
  const [busy, setBusy] = useState(false);
  const [wipeRoom, setWipeRoom] = useState("");
  const [wipeBusy, setWipeBusy] = useState(false);

  const lastAt = Number(
    purgeData?.find((r) => r.setting_key === "last_purge_at")?.setting_value ?? 0,
  );
  const lastCount = Number(
    purgeData?.find((r) => r.setting_key === "last_purge_count")?.setting_value ?? 0,
  );

  const handleRunNow = async () => {
    setBusy(true);
    try {
      const result = await functions.post<{ deletedMessages?: number }>("purge-messages", {});
      toast({
        title: "Cleanup finished",
        description: `${result.deletedMessages ?? 0} old message(s) removed.`,
      });
    } catch {
      toast({ title: "Cleanup couldn't run", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleWipe = async () => {
    const room = roomData?.find((r) => String(r._row_id) === wipeRoom);
    if (!room) return;
    if (!window.confirm(`Delete every message in "${room.name}"? This can't be undone.`)) return;
    setWipeBusy(true);
    try {
      await db.delete("messages", { room_id: `eq.${room._row_id}` });
      toast({ title: "Room cleared", description: `All messages in "${room.name}" were deleted.` });
    } catch {
      toast({ title: "Couldn't clear that room", variant: "destructive" });
    } finally {
      setWipeBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eraser className="w-4 h-4 text-primary" /> Message cleanup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-white/10 p-3">
          <p className="text-sm">
            Last auto-cleanup: {lastAt > 0 ? `${fmtTime(lastAt)} — removed ${lastCount} message(s)` : "not run yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Old public room messages are removed automatically every hour.
          </p>
          <Button className="mt-3" onClick={handleRunNow} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Run cleanup now
          </Button>
        </div>

        <div className="rounded-lg border border-white/10 p-3 space-y-2">
          <p className="text-sm">Clear a single room</p>
          <select
            aria-label="Pick a room to clear"
            value={wipeRoom}
            onChange={(e) => setWipeRoom(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm"
          >
            <option value="">Pick a room…</option>
            {(roomData ?? []).map((room) => (
              <option key={room._row_id} value={String(room._row_id)}>
                {room.name}
              </option>
            ))}
          </select>
          <Button variant="destructive" disabled={!wipeRoom || wipeBusy} onClick={handleWipe}>
            {wipeBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delete all messages in room
          </Button>
          {loading && <p className="text-xs text-muted-foreground">Loading rooms…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

/** Try messages against the live ban rules and word filter. */
const AdminWordTester = () => {
  const { settings } = useAppSettings();
  const [text, setText] = useState("");
  const violation = text.trim() ? findViolation(text) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="w-4 h-4 text-primary" /> Word rule tester
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Type a message to see exactly what the auto-moderation and word filter would do with it.
        </p>
        <Textarea
          aria-label="Message to test"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a test message…"
          rows={3}
        />
        {text.trim() === "" ? (
          <p className="text-sm text-muted-foreground">Nothing typed yet.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-32">Auto-moderation:</span>
              {violation ? (
                <Badge variant="destructive">
                  would ban · tier {violation.tier}
                </Badge>
              ) : (
                <Badge className="bg-emerald-600">clean</Badge>
              )}
            </div>
            {violation && (
              <p className="text-xs text-muted-foreground">
                Matched “{violation.word}” · {violation.occurrences}×
                {violation.flags.length > 0 ? ` · ${violation.flags.join(", ")}` : ""}
              </p>
            )}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-32">Word filter:</span>
              {settingBool(settings, "word_filter_enabled") ? (
                <span className="break-all">“{filterMessage(text, settings)}”</span>
              ) : (
                <span className="text-muted-foreground">filter is off</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { AdminMessageCleanup, AdminWordTester };
