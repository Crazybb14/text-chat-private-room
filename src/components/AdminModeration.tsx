import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Laptop, Loader2, RefreshCw, ShieldX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import {
  formatDuration,
  PENALTY_LADDER_MINUTES,
  TIER_START_INDEX,
  WORD_TIERS,
} from "@/lib/moderation";

interface ViolationRow {
  _row_id: number;
  username: string;
  tier: number | null;
  matched_word: string | null;
  context: string | null;
  action: string | null;
  room_id: number | null;
  _created_at: number;
  [key: string]: unknown;
}

interface DeviceBan {
  deviceId: string;
  usernames: string[];
  anyPermanent: boolean;
  untilMs: number | null;
  rowIds: number[];
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

const tierBadge = (tier: number | null) =>
  WORD_TIERS.find((t) => t.tier === tier)?.label ?? `Tier ${tier ?? "?"}`;

const tierColor = (tier: number | null) =>
  WORD_TIERS.find((t) => t.tier === tier)?.color ??
  "bg-secondary text-foreground border-transparent";

/** Admin view of the auto-moderation system: penalties, violations, device bans. */
const AdminModeration = () => {
  const { toast } = useToast();
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [devices, setDevices] = useState<DeviceBan[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [violationRows, banRows] = await Promise.all([
        db.query<ViolationRow>("violations", { order: "_created_at.desc", limit: "100" }),
        db.query<{
          _row_id: number;
          username: string;
          device_id: string | null;
          ban_duration: number | null;
          _created_at: number;
        }>("bans", { order: "_created_at.desc" }),
      ]);
      setViolations(violationRows);

      const now = Date.now();
      const byDevice = new Map<string, DeviceBan>();
      for (const row of banRows) {
        if (!row.device_id) continue;
        const duration = Number(row.ban_duration ?? 0);
        const permanent = duration <= 0;
        const untilMs = permanent ? null : (Number(row._created_at) + duration) * 1000;
        const active = permanent || (untilMs ?? 0) > now;
        if (!active) continue;
        const existing = byDevice.get(row.device_id) ?? {
          deviceId: row.device_id,
          usernames: [],
          anyPermanent: false,
          untilMs: null,
          rowIds: [],
        };
        if (!existing.usernames.includes(row.username)) existing.usernames.push(row.username);
        existing.anyPermanent = existing.anyPermanent || permanent;
        if (untilMs && (!existing.untilMs || untilMs > existing.untilMs)) existing.untilMs = untilMs;
        existing.rowIds.push(row._row_id);
        byDevice.set(row.device_id, existing);
      }
      setDevices([...byDevice.values()]);
    } catch {
      toast({ title: "Couldn't load moderation data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const handleUnbanDevice = async (device: DeviceBan) => {
    await db.delete("bans", { device_id: `eq.${device.deviceId}` });
    toast({
      title: "Device unbanned",
      description: `All bans tied to that device were lifted (${device.usernames.join(", ")}).`,
    });
    load();
  };

  const q = filter.trim().toLowerCase();
  const visible = q
    ? violations.filter(
        (v) =>
          v.username.toLowerCase().includes(q) ||
          (v.matched_word ?? "").toLowerCase().includes(q)
      )
    : violations;

  const ladderStep = (index: number) => {
    const minutes = PENALTY_LADDER_MINUTES[index];
    return Number.isFinite(minutes) ? formatDuration(minutes) : "permanent";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How penalties escalate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-5">
            {WORD_TIERS.map((tier) => {
              const start = TIER_START_INDEX[tier.tier] ?? 2;
              return (
                <div
                  key={tier.tier}
                  className={`rounded-xl border p-3 space-y-1.5 ${tier.color}`}
                >
                  <p className="text-xs font-semibold">{tier.label}</p>
                  <p className="text-xs opacity-80">First: {ladderStep(start)}</p>
                  <p className="text-xs opacity-80">
                    Each repeat: +{ladderStep(start)}→ up the ladder
                  </p>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PENALTY_LADDER_MINUTES.map((minutes, i) => (
              <Badge key={i} variant="secondary" className="font-normal">
                {Number.isFinite(minutes) ? formatDuration(minutes) : "PERMANENT"}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Every violation is recorded. The next ban is always one step up the ladder for that
            user — two months is the longest temporary ban, and anything past it is permanent.
            Directed threats and the worst categories start much higher. Tune the speed in
            Settings → Moderation.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Banned devices</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {devices.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No banned devices right now. When someone is banned, their device is tagged — new
              accounts from that device get permanently banned for evasion automatically.
            </p>
          )}
          {devices.map((device) => (
            <div
              key={device.deviceId}
              className="flex items-center justify-between gap-3 border-b border-white/5 pb-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-mono truncate flex items-center gap-2">
                  <Laptop className="w-4 h-4 shrink-0 text-muted-foreground" />
                  {device.deviceId.slice(0, 16)}…
                </p>
                <p className="text-xs text-muted-foreground">
                  {device.anyPermanent ? "Permanent" : "Temporary ban"} ·{" "}
                  {device.usernames.map((u) => `@${u}`).join(", ")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleUnbanDevice(device)}>
                <Trash2 className="w-4 h-4 mr-2" /> Unban device
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Violation history</CardTitle>
          <Input
            placeholder="Filter by username or word…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent className="space-y-2 max-h-[480px] overflow-y-auto">
          {visible.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {violations.length === 0
                ? "No violations yet — clean chat so far."
                : "Nothing matches that filter."}
            </p>
          )}
          {visible.map((row) => (
            <div
              key={row._row_id}
              className="flex items-start justify-between gap-3 border-b border-white/5 pb-2"
            >
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">@{row.username}</span>{" "}
                  <span className="text-muted-foreground">triggered</span>{" "}
                  <code className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">
                    {row.matched_word}
                  </code>
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtTime(Number(row._created_at))}
                  {row.room_id !== null ? ` · Room #${row.room_id}` : ""}
                  {row.context ? ` · ${row.context.split(",").join(", ")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${tierColor(row.tier)}`}
                >
                  {tierBadge(row.tier)}
                </span>
                {row.action === "banned-permanent" ? (
                  <Badge variant="destructive" className="gap-1">
                    <ShieldX className="w-3 h-3" /> permanent
                  </Badge>
                ) : row.action === "banned" ? (
                  <Badge variant="destructive">banned</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="w-3 h-3" /> warned
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminModeration;
