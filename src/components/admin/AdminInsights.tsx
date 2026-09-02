import { Loader2, RefreshCw, TrendingUp, Users, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import db from "@/lib/shared/kliv-database.js";
import { roomMessageCounts, signupTrend, topChatters, type StatMessage } from "@/lib/adminStats";
import { useAdminData } from "./useAdminData";

interface RoomLite {
  _row_id: number;
  name: string;
  [key: string]: unknown;
}

interface ProfileLite {
  _row_id: number;
  username: string;
  _created_at: number;
  [key: string]: unknown;
}

interface LoadedChatters {
  messages: StatMessage[];
  profiles: ProfileLite[];
}

const loadChatters = async (): Promise<LoadedChatters> => {
  const [messages, profiles] = await Promise.all([
    db.query<StatMessage>("messages", { order: "_created_at.desc", limit: "2000" }),
    db.query<ProfileLite>("user_profiles", { order: "_created_at.desc" }),
  ]);
  return { messages: messages.reverse(), profiles };
};

const MaxList = ({ items, emptyText }: { items: { label: string; value: number }[]; emptyText: string }) => {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-200 truncate">{item.label}</span>
            <span className="text-zinc-400 shrink-0 ml-2">{item.value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Who sends the most messages. */
const AdminTopChatters = () => {
  const { data, loading, error, refresh } = useAdminData(loadChatters, 30000);
  const chatters = data ? topChatters(data.messages, 12) : [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="w-4 h-4 text-primary" /> Top chatters
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Based on the last {data?.messages.length ?? 0} messages · {data?.profiles.length ?? 0} accounts on the site.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <MaxList
          items={chatters.map((c) => ({ label: `@${c.name}`, value: c.count }))}
          emptyText="No messages yet."
        />
      </CardContent>
    </Card>
  );
};

/** Which rooms get the most traffic. */
const AdminRoomInsights = () => {
  const { data, loading, error, refresh } = useAdminData(async () => {
    const [messages, rooms] = await Promise.all([
      db.query<StatMessage>("messages", { order: "_created_at.desc", limit: "2000" }),
      db.query<RoomLite>("rooms", { order: "_row_id.asc" }),
    ]);
    return { messages, rooms };
  }, 30000);
  const counts = data ? roomMessageCounts(data.rooms, data.messages) : [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="w-4 h-4 text-primary" /> Room insights
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Messages per room, busiest first.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <MaxList
          items={counts.map((c) => ({ label: c.name, value: c.count }))}
          emptyText="No rooms yet."
        />
      </CardContent>
    </Card>
  );
};

/** New accounts per day. */
const AdminSignupTrends = () => {
  const { data, loading, error, refresh } = useAdminData(
    () => db.query<ProfileLite>("user_profiles", { order: "_created_at.desc" }),
    30000,
  );
  const trend = data ? signupTrend(data, 14) : [];
  const total = trend.reduce((sum, bucket) => sum + bucket.count, 0);
  const max = Math.max(...trend.map((b) => b.count), 1);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4 text-primary" /> Signup trends
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {total} new account{total === 1 ? "" : "s"} in the last 14 days.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {trend.length === 0 && !loading && <p className="text-sm text-muted-foreground">No accounts yet.</p>}
        <div className="flex items-end gap-1 h-24">
          {trend.map((bucket) => (
            <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div
                className="w-full rounded-t bg-primary/80 group-hover:bg-primary"
                style={{ height: `${Math.max((bucket.count / max) * 100, bucket.count > 0 ? 8 : 2)}%` }}
                title={`${bucket.label}: ${bucket.count}`}
              />
              <span className="text-[9px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                {bucket.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export { AdminTopChatters, AdminRoomInsights, AdminSignupTrends };
