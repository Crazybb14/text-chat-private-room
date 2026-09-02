import { useState } from "react";
import { Download, Loader2, Lock, LockOpen, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { downloadCsv, toCsv } from "@/lib/adminStats";
import { lockAccount, unlockAccount, getActiveLocks, isActiveLock, type AccountLockRow } from "@/lib/siteNotices";
import { useAdminData } from "./useAdminData";

interface ProfileRow {
  _row_id: number;
  username: string;
  display_name: string;
  _created_at: number;
  [key: string]: unknown;
}

interface IpRow {
  _row_id: number;
  username: string | null;
  ip: string;
  _created_at: number;
  [key: string]: unknown;
}

interface KickRow {
  _row_id: number;
  username: string;
  reason: string | null;
  kicked_at: number;
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
    : "unknown";

/** Search accounts by username, name, or the IPs they signed in from. */
const AdminUserSearch = () => {
  const { data, loading, error, refresh } = useAdminData(async () => {
    const [profiles, ips] = await Promise.all([
      db.query<ProfileRow>("user_profiles", { order: "_created_at.desc" }),
      db.query<IpRow>("ip_logs", { order: "_created_at.desc" }),
    ]);
    return { profiles, ips };
  });
  const [query, setQuery] = useState("");

  const profiles = data?.profiles ?? [];
  const ips = data?.ips ?? [];
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? profiles.filter(
        (p) =>
          p.username.toLowerCase().includes(needle) ||
          (p.display_name ?? "").toLowerCase().includes(needle) ||
          ips.some((ip) => ip.username === p.username && ip.ip.includes(needle)),
      )
    : [];
  const ipsFor = (username: string) => ips.filter((ip) => ip.username === username).slice(0, 3);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Find an account</CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Username, name, or IP address…"
            className="pl-9"
            aria-label="Search accounts"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {needle && matches.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No accounts match “{query}”.</p>
        )}
        {matches.slice(0, 20).map((profile) => (
          <div key={profile._row_id} className="rounded-lg border border-white/10 p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-sm">@{profile.username}</p>
              <span className="text-xs text-muted-foreground">joined {fmtTime(Number(profile._created_at))}</span>
            </div>
            {profile.display_name && (
              <p className="text-xs text-muted-foreground">{profile.display_name}</p>
            )}
            {ipsFor(profile.username).length > 0 && (
              <p className="text-xs text-muted-foreground">
                seen from {ipsFor(profile.username).map((ip) => ip.ip).join(", ")}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

/** Temporarily lock an account out of the site. */
const AdminLocksTable = () => {
  const { toast } = useToast();
  const { data, loading, error, refresh } = useAdminData(getActiveLocks, 20000);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const locks = (data ?? []).filter(isActiveLock);

  const handleLock = async () => {
    const username = target.trim().toLowerCase();
    if (!username) return;
    setBusy(true);
    try {
      const result = await lockAccount(username, reason.trim());
      if (result.error) {
        toast({ title: "Couldn't lock that account", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: `@${username} is locked out` });
      setTarget("");
      setReason("");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async (row: AccountLockRow) => {
    setBusy(true);
    try {
      const result = await unlockAccount(row.username);
      if (result.error) {
        toast({ title: "Couldn't unlock", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: `@${row.username} can sign back in` });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="w-4 h-4 text-amber-400" /> Account locks
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="lock-user">Username</Label>
          <Input id="lock-user" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="someone" />
          <Label htmlFor="lock-reason-input">Reason (shown to them)</Label>
          <Input
            id="lock-reason-input"
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Working on your account — back soon"
          />
          <Button onClick={handleLock} disabled={busy || !target.trim()}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
            Lock account
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-2">
          {locks.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">No locked accounts right now.</p>
          )}
          {locks.map((lock) => (
            <div key={lock._row_id} className="rounded-lg border border-white/10 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm">@{lock.username}</p>
                <p className="text-xs text-muted-foreground truncate">{lock.reason || "No reason given"}</p>
              </div>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => handleUnlock(lock)}>
                <LockOpen className="w-4 h-4 mr-1" /> Unlock
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

/** Everyone who's been force-signed-out. */
const AdminKickLog = () => {
  const { data, loading, error, refresh } = useAdminData(
    () => db.query<KickRow>("account_kicks", { order: "kicked_at.desc" }),
    20000,
  );
  const kicks = data ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Kick history</CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && kicks.length === 0 && (
          <p className="text-sm text-muted-foreground">Nobody has been kicked yet.</p>
        )}
        {kicks.slice(0, 50).map((kick) => (
          <div key={kick._row_id} className="rounded-lg border border-white/10 p-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium min-w-0 truncate">@{kick.username}</p>
            <span className="text-xs text-muted-foreground shrink-0">
              {kick.kicked_at ? fmtTime(kick.kicked_at) : fmtTime(Number(kick._created_at))}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

interface ExportRow extends Record<string, unknown> {
  _row_id: number;
}

/** Download the site's data as CSV files. */
const AdminDataExport = () => {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const exportTable = async (
    name: string,
    table: string,
    columns: string[],
    filename: string,
  ) => {
    setBusy(name);
    try {
      const rows = await db.query<ExportRow>(table, { order: "_row_id.asc" });
      downloadCsv(filename, toCsv(rows, columns));
      toast({ title: `${name} exported`, description: `${rows.length} rows downloaded.` });
    } catch {
      toast({ title: `Couldn't export ${name.toLowerCase()}`, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Download data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Each button downloads a CSV of that data. Passwords are never included.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => exportTable("Accounts", "user_profiles", ["username", "display_name", "_created_at"], "accounts.csv")}>
            {busy === "Accounts" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Accounts
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => exportTable("Messages", "messages", ["room_id", "sender_name", "content", "_created_at"], "messages.csv")}>
            {busy === "Messages" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Messages
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => exportTable("Rooms", "rooms", ["name", "type", "code", "is_voice"], "rooms.csv")}>
            {busy === "Rooms" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Rooms
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => exportTable("IP logs", "ip_logs", ["username", "ip", "user_agent", "_created_at"], "ip-logs.csv")}>
            {busy === "IP logs" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            IP logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export { AdminUserSearch, AdminLocksTable, AdminKickLog, AdminDataExport };
