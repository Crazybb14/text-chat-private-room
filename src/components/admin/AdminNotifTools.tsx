import { Activity, BellRing, Hash, Loader2, PhoneCall, RefreshCw, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import db from "@/lib/shared/kliv-database.js";
import { announcementStats, dmPairStats, ipGroups } from "@/lib/adminStats";
import type { DirectMessageRow, FriendshipRow } from "@/lib/friends";
import { useAdminData } from "./useAdminData";

interface NotificationLite {
  _row_id: number;
  title: string;
  is_read: number;
  [key: string]: unknown;
}

interface CallLite {
  _row_id: number;
  room_id: number | null;
  dm_pair: string | null;
  type: string;
  status: string;
  started_by: string;
  started_at: number;
  [key: string]: unknown;
}

interface CallParticipantLite {
  _row_id: number;
  call_id: number;
  username: string;
  [key: string]: unknown;
}

interface IpLite {
  _row_id: number;
  username: string | null;
  ip: string;
  [key: string]: unknown;
}

interface FeedItem {
  at: number;
  text: string;
}

const fmtTime = (value: number) =>
  value
    ? new Date(value * (value > 1e11 ? 1 : 1000)).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "unknown";

const RefreshButton = ({ onClick, loading }: { onClick: () => void; loading: boolean }) => (
  <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
  </Button>
);

/** How many people actually read each announcement. */
const AdminAnnouncementStats = () => {
  const { data, loading, error, refresh } = useAdminData(
    () => db.query<NotificationLite>("notifications", { order: "_row_id.desc", limit: "1000" }),
    30000,
  );
  const stats = announcementStats(data ?? []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="w-4 h-4 text-primary" /> Announcement reads
        </CardTitle>
        <RefreshButton onClick={refresh} loading={loading} />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Delivered vs read, per announcement (most recent 1000 notifications).
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && stats.length === 0 && (
          <p className="text-sm text-muted-foreground">No announcements sent yet.</p>
        )}
        {stats.slice(0, 20).map((stat) => (
          <div key={stat.title} className="space-y-1">
            <div className="flex justify-between text-sm gap-2">
              <span className="truncate">{stat.title}</span>
              <span className="text-muted-foreground shrink-0">
                {stat.read}/{stat.sent} read
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${stat.sent > 0 ? Math.round((stat.read / stat.sent) * 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

/** Past and present calls, with who joined. */
const AdminCallHistory = () => {
  const { data, loading, error, refresh } = useAdminData(async () => {
    const [calls, parts] = await Promise.all([
      db.query<CallLite>("call_sessions", { order: "_row_id.desc", limit: "50" }),
      db.query<CallParticipantLite>("call_participants", { order: "_row_id.desc" }),
    ]);
    return { calls, parts };
  }, 30000);
  const calls = data?.calls ?? [];
  const parts = data?.parts ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <PhoneCall className="w-4 h-4 text-primary" /> Call history
        </CardTitle>
        <RefreshButton onClick={refresh} loading={loading} />
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && calls.length === 0 && (
          <p className="text-sm text-muted-foreground">No calls have been made yet.</p>
        )}
        {calls.map((call) => {
          const who = parts.filter((p) => p.call_id === call._row_id).map((p) => `@${p.username}`);
          const label = call.dm_pair
            ? call.dm_pair.replace("::", " ⇄ ")
            : call.room_id
              ? `room #${call.room_id}`
              : "call";
          return (
            <div key={call._row_id} className="rounded-lg border border-white/10 p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">
                  {call.type === "video" ? "Video" : call.type === "audio" ? "Voice" : call.type} · {label}
                </p>
                <Badge variant={call.status === "active" ? "default" : "secondary"}>{call.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                started by @{call.started_by} · {fmtTime(call.started_at)}
                {who.length > 0 ? ` · ${who.join(", ")}` : ""}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

/** Which pairs talk the most, and DM file totals. */
const AdminDmStats = () => {
  const { data, loading, error, refresh } = useAdminData(async () => {
    const [dms, files, friends] = await Promise.all([
      db.query<DirectMessageRow>("direct_messages", { order: "_row_id.desc", limit: "2000" }),
      db.query<{ _row_id: number; status: string; file_name: string }>("dm_files", { order: "_row_id.desc", limit: "500" }),
      db.query<FriendshipRow>("friendships", { status: "eq.accepted" }),
    ]);
    return { dms, files, friends };
  }, 30000);
  const pairs = dmPairStats(data?.dms ?? []);
  const files = data?.files ?? [];
  const pending = files.filter((f) => f.status === "pending").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Hash className="w-4 h-4 text-primary" /> Direct message stats
        </CardTitle>
        <RefreshButton onClick={refresh} loading={loading} />
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          {data?.dms.length ?? 0} recent DMs · {data?.friends.length ?? 0} friendships ·{" "}
          {files.length} DM file{files.length === 1 ? "" : "s"}
          {pending > 0 ? ` (${pending} awaiting review)` : ""}
        </p>
        {!loading && pairs.length === 0 && (
          <p className="text-sm text-muted-foreground">No direct messages yet.</p>
        )}
        {pairs.map((pair) => (
          <div key={pair.pair} className="flex justify-between text-sm">
            <span className="text-zinc-200 truncate">{pair.pair}</span>
            <span className="text-muted-foreground shrink-0 ml-2">{pair.count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

/** IPs shared by multiple accounts — usually ban evasion. */
const AdminIpInsights = () => {
  const { data, loading, error, refresh } = useAdminData(
    () => db.query<IpLite>("ip_logs", { order: "_row_id.desc", limit: "2000" }),
    30000,
  );
  const groups = ipGroups(
    (data ?? []).map((row) => ({ username: row.username ?? "", ip: row.ip })),
  );
  const shared = groups.filter((group) => group.usernames.length > 1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wifi className="w-4 h-4 text-primary" /> IP insights
        </CardTitle>
        <RefreshButton onClick={refresh} loading={loading} />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {groups.length} unique IP{groups.length === 1 ? "" : "s"} seen · {shared.length} used by
          more than one account.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No IP data available in this view — the site owner can see sign-in IPs on the IP Logs tab.
          </p>
        )}
        {shared.slice(0, 20).map((group) => (
          <div key={group.ip} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
            <p className="text-sm font-mono">{group.ip}</p>
            <p className="text-xs text-muted-foreground break-words">
              {group.usernames.map((name) => `@${name}`).join(", ")}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

interface FeedRow {
  _row_id: number;
  _created_at: number;
  [key: string]: unknown;
}

const feedText = (rows: FeedRow[], build: (row: FeedRow) => string): FeedItem[] =>
  rows.map((row) => ({ at: Number(row._created_at), text: build(row) }));

/** One combined stream of everything happening on the site. */
const AdminActivityFeed = () => {
  const { data, loading, error, refresh } = useAdminData(async () => {
    const [messages, profiles, bans, reports, suggestions] = await Promise.all([
      db.query<FeedRow & { sender_name: string; content: string }>("messages", { order: "_row_id.desc", limit: "40" }),
      db.query<FeedRow & { username: string }>("user_profiles", { order: "_row_id.desc", limit: "20" }),
      db.query<FeedRow & { username: string; reason: string | null }>("bans", { order: "_row_id.desc", limit: "20" }),
      db.query<FeedRow & { reported_username: string }>("user_reports", { order: "_row_id.desc", limit: "20" }),
      db.query<FeedRow & { content: string }>("suggestions", { order: "_row_id.desc", limit: "20" }),
    ]);
    return { messages, profiles, bans, reports, suggestions };
  }, 15000);

  const items: FeedItem[] = [
    ...feedText(data?.messages ?? [], (row) => `@${row.sender_name}: ${String(row.content).slice(0, 60)}`),
    ...feedText(data?.profiles ?? [], (row) => `@${row.username} joined`),
    ...feedText(data?.bans ?? [], (row) => `@${row.username} was banned`),
    ...feedText(data?.reports ?? [], (row) => `report filed about @${row.reported_username}`),
    ...feedText(data?.suggestions ?? [], (row) => `suggestion: ${String(row.content).slice(0, 60)}`),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 60);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-primary" /> Activity feed
        </CardTitle>
        <RefreshButton onClick={refresh} loading={loading} />
      </CardHeader>
      <CardContent className="space-y-1.5">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>
        )}
        {items.map((item, index) => (
          <div key={`${item.at}-${index}`} className="flex items-baseline gap-3 text-sm">
            <span className="text-xs text-muted-foreground shrink-0 w-24">{fmtTime(item.at)}</span>
            <span className="text-zinc-300 truncate">{item.text}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export { AdminAnnouncementStats, AdminCallHistory, AdminDmStats, AdminIpInsights, AdminActivityFeed };
