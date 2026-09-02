import { useCallback, useEffect, useState } from "react";
import { Check, Clock, Loader2, ScrollText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import db from "@/lib/shared/kliv-database.js";
import { useToast } from "@/hooks/use-toast";

interface AppealRow {
  _row_id: number;
  real_name: string | null;
  banned_username: string | null;
  reason: string | null;
  device_id: string | null;
  status: string | null;
  _created_at: number;
}

const statusBadge = (status: string | null) => {
  if (status === "approved") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>;
  if (status === "denied") return <Badge className="bg-rose-600 hover:bg-rose-600">Denied</Badge>;
  return <Badge className="bg-amber-500 hover:bg-amber-500">Waiting for review</Badge>;
};

const AdminAppeals = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<AppealRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await db.query<AppealRow>("appeals", { order: "_row_id.desc", limit: "200" });
      setRows(data);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  const decide = async (row: AppealRow, outcome: "approved" | "denied") => {
    if (!row.banned_username) return;
    setBusy(row._row_id);
    try {
      if (outcome === "approved") {
        // Lift every active ban for this username
        await db.delete("bans", { username: `eq.${row.banned_username}` });
      }
      await db.update("appeals", { _row_id: `eq.${row._row_id}` }, { status: outcome });
      await db.insert("notifications", {
        type: "appeal",
        title: outcome === "approved" ? "Your appeal was approved" : "Your appeal was denied",
        message:
          outcome === "approved"
            ? "Good news — your ban has been lifted. Welcome back, and please keep the rules in mind."
            : "An admin reviewed your appeal and decided to keep the ban in place.",
        recipient_username: row.banned_username,
        link: "/",
      });
      toast({
        title: outcome === "approved" ? "Appeal approved" : "Appeal denied",
        description:
          outcome === "approved"
            ? `@${row.banned_username} can chat again.`
            : `@${row.banned_username} stays banned.`,
      });
      await load();
    } catch {
      toast({ title: "Couldn't save that decision", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-semibold">
              <ScrollText className="h-4 w-4" aria-hidden /> Ban appeals
            </h3>
            <p className="text-xs text-muted-foreground">
              Banned users who asked for a second chance. Approving removes every active ban for that username.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>

        {rows === null ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading appeals…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No appeals have been submitted.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row._row_id} className="rounded-lg border border-white/10 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">@{row.banned_username}</span>
                  {row.real_name ? (
                    <span className="text-xs text-muted-foreground">({row.real_name})</span>
                  ) : null}
                  {statusBadge(row.status)}
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden />
                    {new Date((row._created_at || 0) * 1000).toLocaleString()}
                  </span>
                </div>
                {row.reason ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.reason}</p>
                ) : (
                  <p className="mt-2 text-sm italic text-muted-foreground">No reason given.</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500"
                    disabled={busy === row._row_id || row.status === "approved"}
                    onClick={() => void decide(row, "approved")}
                  >
                    {busy === row._row_id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="h-4 w-4" aria-hidden />
                    )}
                    Approve &amp; unban
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy === row._row_id || row.status === "denied"}
                    onClick={() => void decide(row, "denied")}
                  >
                    <X className="h-4 w-4" aria-hidden />
                    Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminAppeals;
