import { useState } from "react";
import { Eraser, Loader2, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import type { FriendshipRow } from "@/lib/friends";
import { useAdminData } from "./useAdminData";

interface ProfileBioRow {
  _row_id: number;
  username: string;
  display_name: string;
  bio: string | null;
  [key: string]: unknown;
}

/** See friendships and pending requests, and remove them when needed. */
const AdminFriendsManager = () => {
  const { toast } = useToast();
  const { data, loading, error, refresh } = useAdminData(async () => {
    const [friendships, profiles] = await Promise.all([
      db.query<FriendshipRow>("friendships", { order: "_row_id.desc" }),
      db.query<ProfileBioRow>("user_profiles", { order: "_row_id.asc" }),
    ]);
    return { friendships, profiles };
  }, 30000);
  const [busyId, setBusyId] = useState<number | null>(null);

  const friendships = data?.friendships ?? [];
  const pending = friendships.filter((row) => row.status === "pending");
  const accepted = friendships.filter((row) => row.status !== "pending");
  const orphaned = accepted.filter(
    (row) =>
      !data?.profiles.some(
        (p) => p.username === row.user_id || p.username === row.friend_id,
      ),
  );

  const handleRemove = async (row: FriendshipRow) => {
    setBusyId(row._row_id);
    try {
      await db.deleteOne("friendships", { _row_id: `eq.${row._row_id}` });
      toast({ title: row.status === "pending" ? "Request deleted" : "Friendship removed", description: `@${row.user_id} ⇄ @${row.friend_id}` });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const rowFor = (row: FriendshipRow, pending: boolean) => (
    <div key={row._row_id} className="rounded-lg border border-white/10 p-3 flex items-center justify-between gap-2">
      <p className="text-sm min-w-0 truncate">
        @{row.user_id} <span className="text-muted-foreground">⇄</span> @{row.friend_id}
      </p>
      <div className="flex items-center gap-2 shrink-0">
        {pending && <Badge variant="secondary">pending</Badge>}
        <Button
          variant="outline"
          size="sm"
          disabled={busyId === row._row_id}
          onClick={() => handleRemove(row)}
        >
          Remove
        </Button>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4 text-primary" /> Friendships
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {accepted.length} friendship{accepted.length === 1 ? "" : "s"}
            {pending.length > 0 ? ` · ${pending.length} pending request${pending.length === 1 ? "" : "s"}` : ""}
          </p>
          {orphaned.length > 0 && (
            <p className="text-xs text-amber-400">
              {orphaned.length} of these involve a deleted account.
            </p>
          )}
          {!loading && accepted.length === 0 && (
            <p className="text-sm text-muted-foreground">No friendships yet.</p>
          )}
          {accepted.slice(0, 30).map((row) => rowFor(row, false))}
          {pending.slice(0, 10).map((row) => rowFor(row, true))}
        </div>
      </CardContent>
    </Card>
  );
};

/** Review profile bios and clear ones that break the rules. */
const AdminBios = () => {
  const { toast } = useToast();
  const { data, loading, error, refresh } = useAdminData(
    () => db.query<ProfileBioRow>("user_profiles", { order: "_row_id.asc" }),
    30000,
  );
  const [busyId, setBusyId] = useState<number | null>(null);
  const withBios = (data ?? []).filter((profile) => (profile.bio ?? "").trim() !== "");

  const handleClear = async (profile: ProfileBioRow) => {
    setBusyId(profile._row_id);
    try {
      await db.updateOne("user_profiles", { _row_id: `eq.${profile._row_id}` }, { bio: "" });
      toast({ title: `Cleared @${profile.username}'s bio` });
      await refresh();
    } catch {
      toast({ title: "Couldn't clear that bio", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Profile bios</CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && withBios.length === 0 && (
          <p className="text-sm text-muted-foreground">Nobody has written a bio yet.</p>
        )}
        {withBios.map((profile) => (
          <div key={profile._row_id} className="rounded-lg border border-white/10 p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">@{profile.username}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line break-words">{profile.bio}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-destructive border-destructive/40"
              disabled={busyId === profile._row_id}
              onClick={() => handleClear(profile)}
            >
              <Eraser className="w-4 h-4 mr-1" /> Clear
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export { AdminFriendsManager, AdminBios };
