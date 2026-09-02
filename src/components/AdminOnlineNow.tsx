import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/DiscordShell";
import db from "@/lib/shared/kliv-database.js";
import { isPresenceOnline, parseSeen, ONLINE_WINDOW_MS, type PresenceRow } from "@/lib/presence";

interface RoomNameRow {
  _row_id: number;
  name: string;
  [key: string]: unknown;
}

/** Admin tab: who is on the site right now, and where they are. */
const AdminOnlineNow = () => {
  const [rows, setRows] = useState<PresenceRow[] | null>(null);
  const [rooms, setRooms] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [presenceRows, roomRows] = await Promise.all([
        db.query<PresenceRow>("online_users", { order: "last_seen.desc", limit: 200 }),
        db.query<RoomNameRow>("rooms", { order: "_row_id.asc" }),
      ]);
      setRows(presenceRows);
      setRooms(
        Object.fromEntries(roomRows.map((r) => [Number(r._row_id), String(r.name ?? `#${r._row_id}`)]))
      );
      setNow(Date.now());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const online = (rows ?? []).filter((row) => isPresenceOnline(row, now));
  const stale = (rows ?? []).length - online.length;

  const roomLabel = (row: PresenceRow): string | null => {
    const rid = row.room_id == null ? null : Number(row.room_id);
    return rid != null && rooms[rid] ? rooms[rid] : null;
  };

  const lastSeenLabel = (row: PresenceRow): string => {
    const seen = parseSeen(row.last_seen);
    const seconds = Math.max(0, Math.round((now - seen) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
    return `${Math.round(seconds / 3600)}h ago`;
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Wifi className="w-4 h-4" /> Online right now
          <Badge variant="outline" className="ml-1">{online.length}</Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Updated automatically every 15 seconds. Someone counts as online if they were seen in the
          last {Math.round(ONLINE_WINDOW_MS / 60000)} minutes.
        </p>
        {rows === null ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </p>
        ) : online.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nobody is online right now{stale > 0 ? ` (${stale} seen earlier today).` : "."}
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {online.map((row) => (
              <div key={String(row.username)} className="flex items-center gap-3 py-2">
                <span className="relative">
                  <Avatar name={String(row.username)} size={32} />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">@{String(row.username)}</p>
                  <p className="text-xs text-muted-foreground">
                    {roomLabel(row) ? `In #${roomLabel(row)}` : "On the main page"} · seen{" "}
                    {lastSeenLabel(row)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminOnlineNow;
