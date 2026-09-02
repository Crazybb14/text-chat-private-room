import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import db from "@/lib/shared/kliv-database.js";

interface AuditRow {
  _row_id: number;
  action: string | null;
  actor_email: string | null;
  target: string | null;
  detail: string | null;
  _created_at: number;
}

const AdminAuditLog = () => {
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await db.query<AuditRow>("admin_audit", { order: "_row_id.desc", limit: "300" });
      setRows(data);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => clearInterval(timer);
  }, [load]);

  const filtered = (rows ?? []).filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [row.action, row.actor_email, row.target, row.detail]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q));
  });

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" aria-hidden /> Admin action history
            </h3>
            <p className="text-xs text-muted-foreground">
              Every moderation action taken from this panel — who did it, to whom, and when.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search actions…"
                className="pl-8 w-52"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        </div>

        {rows === null ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading history…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <div className="divide-y divide-white/5 rounded-lg border border-white/10">
            {filtered.map((row) => (
              <div key={row._row_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-sm">
                <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary">
                  {row.action ?? "action"}
                </span>
                <span className="text-muted-foreground">{row.actor_email ?? "system"}</span>
                {row.target ? <span className="font-medium">{row.target}</span> : null}
                {row.detail ? (
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{row.detail}</span>
                ) : null}
                <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden />
                  {new Date((row._created_at || 0) * 1000).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAuditLog;
