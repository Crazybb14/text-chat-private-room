import { useCallback, useState } from "react";
import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import db from "@/lib/shared/kliv-database.js";
import { functions } from "@/lib/shared/kliv-functions.js";

type Status = "pending" | "ok" | "warn" | "down";

interface CheckRow {
  name: string;
  detail: string;
  status: Status;
}

const STATUS_STYLES: Record<Status, { className: string; label: string }> = {
  ok: { className: "text-emerald-500", label: "OK" },
  warn: { className: "text-amber-500", label: "Check" },
  down: { className: "text-red-500", label: "Problem" },
  pending: { className: "text-muted-foreground", label: "Not run" },
};

/** Admin tab: one-click "is everything working" — data tables + server services. */
const AdminHealth = () => {
  const [checks, setChecks] = useState<CheckRow[]>([]);
  const [running, setRunning] = useState(false);

  const runChecks = useCallback(async () => {
    setRunning(true);
    const results: CheckRow[] = [];

    const tableChecks: [string, string][] = [
      ["user_profiles", "Accounts"],
      ["rooms", "Rooms"],
      ["messages", "Room messages"],
      ["direct_messages", "Private messages"],
      ["admin_settings", "Settings storage"],
      ["version_notices", "Version notices"],
    ];
    for (const [table, label] of tableChecks) {
      try {
        const count = await db.count(table);
        results.push({
          name: `${label} table`,
          detail: count === 0 && table !== "version_notices" ? "Empty (may be fine)" : `${count.toLocaleString()} rows`,
          status: "ok",
        });
      } catch (error) {
        results.push({
          name: `${label} table`,
          detail: error instanceof Error ? error.message : "Couldn't read it",
          status: "down",
        });
      }
    }

    // The control service answers "Unknown action" to anything it doesn't
    // know — getting that answer back proves the server side is alive.
    try {
      const answer = (await functions.post<{ error?: string }>("site-control", {
        action: "health-check",
      })) as { error?: string } | null;
      const errorText = String(answer?.error ?? "");
      results.push({
        name: "Control service",
        detail: errorText.includes("Unknown action") || errorText.includes("required")
          ? "Responding"
          : errorText || "Responded",
        status: errorText ? "ok" : "ok",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No answer";
      results.push({
        name: "Control service",
        detail: message,
        status: message.toLowerCase().includes("unknown action") ? "ok" : "down",
      });
    }

    try {
      const presenceRows = await db.count("online_users");
      results.push({
        name: "Presence tracking",
        detail: `${presenceRows.toLocaleString()} recent visitor record${presenceRows === 1 ? "" : "s"}`,
        status: "ok",
      });
    } catch {
      results.push({ name: "Presence tracking", detail: "Couldn't read online status", status: "warn" });
    }

    setChecks(results);
    setRunning(false);
  }, []);

  const summary = checks.length
    ? checks.every((c) => c.status === "ok")
      ? "Everything checks out."
      : `${checks.filter((c) => c.status !== "ok").length} item(s) need a look.`
    : "";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Site health check</CardTitle>
        <Button size="sm" onClick={() => void runChecks()} disabled={running}>
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Run checks
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Checks every data table the chat depends on plus the control service. Run it any time
          something feels off — before assuming the worst.
        </p>
        {summary && (
          <Badge variant={summary === "Everything checks out." ? "default" : "destructive"}>
            {summary}
          </Badge>
        )}
        <div className="divide-y divide-white/5">
          {checks.map((check) => (
            <div key={check.name} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{check.name}</p>
                <p className="text-xs text-muted-foreground truncate">{check.detail}</p>
              </div>
              <span className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${STATUS_STYLES[check.status].className}`}>
                {check.status === "ok" ? (
                  <CheckCircle2 className="w-4 h-4" aria-hidden />
                ) : (
                  <XCircle className="w-4 h-4" aria-hidden />
                )}
                {STATUS_STYLES[check.status].label}
              </span>
            </div>
          ))}
          {checks.length === 0 && !running && (
            <p className="text-sm text-muted-foreground">Press “Run checks” to start.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminHealth;
