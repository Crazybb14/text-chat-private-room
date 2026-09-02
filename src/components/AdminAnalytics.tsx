import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, MessageSquare, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import db from "@/lib/shared/kliv-database.js";
import { loadActivitySummary, type ActivitySummary } from "@/lib/activity";

interface RoomRow {
  _row_id: number;
  name: string;
}

interface MessageRow {
  room_id: number;
  sender_name: string | null;
  _created_at: number;
}

interface DmRow {
  sender_username: string | null;
  _created_at: number;
}

interface ProfileRow {
  username: string | null;
  _created_at: number;
}

interface DayCount {
  day: string;
  messages: number;
  people: number;
}

interface AnalyticsData {
  days: DayCount[];
  topRooms: { name: string; messages: number }[];
  topChatters: { name: string; messages: number }[];
  totalMessages: number;
  totalDms: number;
  totalMembers: number;
  activity: ActivitySummary | null;
}

function toMs(ts: number): number {
  return ts > 1e12 ? ts : ts * 1000;
}

const tooltipStyle = {
  background: "#1e1f22",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#f2f3f5",
  fontSize: 12,
};

const AdminAnalytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rooms, messages, dms, profiles, activity] = await Promise.all([
          db.query<RoomRow>("rooms", { order: "_row_id.asc" }),
          db.query<MessageRow>("messages", { order: "_created_at.desc", limit: "2000" }),
          db.query<DmRow>("direct_messages", { order: "_created_at.desc", limit: "1000" }),
          db.query<ProfileRow>("user_profiles", { order: "_row_id.desc", limit: "1000" }),
          loadActivitySummary(7),
        ]);
        if (!alive) return;

        // messages per day, last 7 days
        const dayMap = new Map<string, { messages: number; people: Set<string> }>();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86_400_000);
          dayMap.set(d.toDateString(), { messages: 0, people: new Set() });
        }
        for (const m of messages) {
          const key = new Date(toMs(m._created_at)).toDateString();
          const slot = dayMap.get(key);
          if (!slot) continue;
          slot.messages += 1;
          if (m.sender_name) slot.people.add(m.sender_name.toLowerCase());
        }
        const days: DayCount[] = Array.from(dayMap.entries()).map(([key, v]) => ({
          day: new Date(key).toLocaleDateString([], { weekday: "short" }),
          messages: v.messages,
          people: v.people.size,
        }));

        // top rooms + top chatters
        const roomNames = new Map(rooms.map((r) => [Number(r._row_id), r.name]));
        const roomCounts = new Map<number, number>();
        const chatterCounts = new Map<string, number>();
        for (const m of messages) {
          const rid = Number(m.room_id);
          roomCounts.set(rid, (roomCounts.get(rid) ?? 0) + 1);
          if (m.sender_name) {
            const key = m.sender_name.toLowerCase();
            chatterCounts.set(key, (chatterCounts.get(key) ?? 0) + 1);
          }
        }
        const topRooms = Array.from(roomCounts.entries())
          .map(([id, count]) => ({ name: roomNames.get(id) ?? `Room ${id}`, messages: count }))
          .sort((a, b) => b.messages - a.messages)
          .slice(0, 6);
        const topChatters = Array.from(chatterCounts.entries())
          .map(([name, count]) => ({ name, messages: count }))
          .sort((a, b) => b.messages - a.messages)
          .slice(0, 8);

        setData({
          days,
          topRooms,
          topChatters,
          totalMessages: messages.length,
          totalDms: dms.length,
          totalMembers: profiles.filter((p) => p.username).length,
          activity,
        });
      } catch {
        if (alive) setError("Couldn't load analytics right now.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const stats = [
    { label: "room messages (recent)", value: data?.totalMessages ?? 0, icon: MessageSquare },
    { label: "direct messages", value: data?.totalDms ?? 0, icon: MessageSquare },
    { label: "members", value: data?.totalMembers ?? 0, icon: Users },
    { label: "busiest hour", value: data?.activity?.peak?.label ?? "—", icon: TrendingUp },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="py-4 text-center">
              <stat.icon className="mx-auto h-4 w-4 text-muted-foreground" aria-hidden />
              <p className="mt-1 text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="py-5">
          <h3 className="font-semibold">Messages per day</h3>
          <p className="text-xs text-muted-foreground">Room chat activity over the last 7 days.</p>
          {data ? (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.days}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "#949ba4", fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                  <YAxis allowDecimals={false} tick={{ fill: "#949ba4", fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="messages" fill="#5865f2" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {error ?? "Loading…"}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="py-5">
            <h3 className="font-semibold">Busiest hours</h3>
            <p className="text-xs text-muted-foreground">Distinct people chatting, by hour of day.</p>
            {data?.activity ? (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.activity.points}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#949ba4", fontSize: 10 }}
                      stroke="rgba(255,255,255,0.1)"
                      interval={3}
                    />
                    <YAxis allowDecimals={false} tick={{ fill: "#949ba4", fontSize: 11 }} stroke="rgba(255,255,255,0.1)" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="people" stroke="#23a559" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Loading…</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <h3 className="font-semibold">Most active rooms &amp; chatters</h3>
            <p className="text-xs text-muted-foreground">Recent message volume.</p>
            {data ? (
              <div className="mt-4 space-y-4">
                {data.topRooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  data.topRooms.map((room) => (
                    <div key={room.name} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-sm">{room.name}</span>
                      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-[#5865f2]"
                          style={{ width: `${Math.min(100, (room.messages / (data.topRooms[0]?.messages || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{room.messages}</span>
                    </div>
                  ))
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {data.topChatters.map((chatter) => (
                    <span key={chatter.name} className="rounded-full bg-white/5 px-2.5 py-1 text-xs">
                      @{chatter.name} · {chatter.messages}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Loading…</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;
