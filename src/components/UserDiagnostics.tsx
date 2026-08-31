import { useEffect, useState, type ReactNode } from "react";
import { Ban as BanIcon, FileText, Loader2, MessageSquare, Shield, Users, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { functions } from "@/lib/shared/kliv-functions.js";
import { formatBytes } from "@/lib/dmFiles";

interface DiagProfile {
  username: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  status: string | null;
  last_seen: number | null;
}

interface DiagData {
  ok?: boolean;
  error?: string;
  profile: DiagProfile;
  credentials: { email: string | null; first_name: string | null; last_name: string | null; _created_at: number } | null;
  presence: { last_seen: string | null; is_online: number | null; room_id: number | null } | null;
  messages: { sender_name: string; content: string; room_id: number; _created_at: number }[];
  dmPartners: { username: string; count: number; lastAt: number; lastMessage: string }[];
  friends: { username: string; status: string; requestedBy: string }[];
  ips: { ip: string | null; user_agent: string | null; _created_at: number }[];
  bans: { username: string; room_id: number | null; _created_at: number }[];
  reports: { reported_username: string; reporter_username: string; report_reason: string; status: string | null; _created_at: number }[];
  files: { file_name: string; file_size: number; recipient_username: string; _created_at: number }[];
}

function when(value: number | null | undefined): string {
  if (!value) return "—";
  const ms = value > 1e11 ? value : value * 1000;
  return new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-1.5 border-b border-white/5 last:border-0">
    <span className="text-xs text-muted-foreground shrink-0">{label}</span>
    <span className="text-xs text-right break-all">{value ?? "—"}</span>
  </div>
);

/**
 * Owner-only window into a single user's account — everything the owner would
 * see by signing in as them, without signing out of the owner session.
 */
const UserDiagnostics = ({ username, onClose }: { username: string | null; onClose: () => void }) => {
  const [data, setData] = useState<DiagData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    setData(null);
    setError(null);
    functions
      .post<DiagData>("user-diagnostics", { username })
      .then((result) => {
        if (result?.error) setError(result.error);
        else setData(result);
      })
      .catch(() => setError("Couldn't load that account right now."));
  }, [username]);

  const p = data?.profile;

  return (
    <Dialog open={Boolean(username)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Account diagnostics: @{username}
          </DialogTitle>
          <DialogDescription>
            Everything this user sees and does, pulled live while you stay signed in as the owner.
          </DialogDescription>
        </DialogHeader>

        {!data && !error && (
          <div className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading account…</p>
          </div>
        )}

        {error && (
          <div className="py-8 text-center text-sm text-destructive space-y-3">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )}

        {data && p && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 p-3">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="font-semibold text-sm">{p.display_name || p.username}</span>
                <Badge variant="secondary">@{p.username}</Badge>
                {data.presence?.is_online === 1 && (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">online</Badge>
                )}
                {data.bans.length > 0 && <Badge variant="destructive">banned</Badge>}
              </div>
              <Row label="Account email" value={p.email || data.credentials?.email || "—"} />
              <Row label="Name" value={[data.credentials?.first_name, data.credentials?.last_name].filter(Boolean).join(" ") || "—"} />
              <Row label="Joined" value={when(data.credentials?._created_at)} />
              <Row label="Last active" value={data.presence?.last_seen ? when(Date.parse(String(data.presence.last_seen).includes("T") ? String(data.presence.last_seen) : String(data.presence.last_seen).replace(" ", "T"))) : when(p.last_seen)} />
              {data.presence?.room_id ? <Row label="Last room" value={`Room #${data.presence.room_id}`} /> : null}
              <Row label="Bio" value={p.bio || "—"} />
            </div>

            <Tabs defaultValue="dms">
              <TabsList className="flex-wrap h-auto w-full">
                <TabsTrigger value="dms">DMs ({data.dmPartners.length})</TabsTrigger>
                <TabsTrigger value="messages">Room messages</TabsTrigger>
                <TabsTrigger value="friends">Friends ({data.friends.filter((f) => f.status === "accepted").length})</TabsTrigger>
                <TabsTrigger value="files">Files ({data.files.length})</TabsTrigger>
                <TabsTrigger value="security">IP & security</TabsTrigger>
              </TabsList>

              <TabsContent value="dms" className="mt-3 space-y-2">
                {data.dmPartners.length === 0 && <p className="text-sm text-muted-foreground py-3">No direct messages yet.</p>}
                {data.dmPartners
                  .sort((a, b) => b.lastAt - a.lastAt)
                  .map((partner) => (
                    <div key={partner.username} className="rounded-xl border border-white/10 p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">@{partner.username}</p>
                        <p className="text-xs text-muted-foreground truncate">{partner.lastMessage || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline">{partner.count} msgs</Badge>
                        <p className="text-[10px] text-muted-foreground mt-1">{when(partner.lastAt)}</p>
                      </div>
                    </div>
                  ))}
              </TabsContent>

              <TabsContent value="messages" className="mt-3 space-y-2">
                {data.messages.length === 0 && <p className="text-sm text-muted-foreground py-3">No room messages yet.</p>}
                {[...data.messages].reverse().map((m, i) => (
                  <div key={i} className="rounded-xl border border-white/10 p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-medium flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-muted-foreground" /> room #{m.room_id}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{when(m._created_at)}</span>
                    </div>
                    <p className="text-xs break-words">{m.content}</p>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="friends" className="mt-3 space-y-2">
                {data.friends.length === 0 && <p className="text-sm text-muted-foreground py-3">No friends or requests yet.</p>}
                {data.friends.map((f, i) => (
                  <div key={i} className="rounded-xl border border-white/10 p-3 flex items-center justify-between gap-3">
                    <span className="text-sm flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-muted-foreground" /> @{f.username}
                    </span>
                    <Badge variant={f.status === "accepted" ? "default" : f.status === "pending" ? "outline" : "secondary"}>
                      {f.status}
                    </Badge>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="files" className="mt-3 space-y-2">
                {data.files.length === 0 && <p className="text-sm text-muted-foreground py-3">No shared files yet.</p>}
                {data.files.map((f, i) => (
                  <div key={i} className="rounded-xl border border-white/10 p-3 flex items-center justify-between gap-3">
                    <span className="text-sm flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{f.file_name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatBytes(f.file_size)} · with @{f.recipient_username === p.username ? "them" : f.recipient_username}
                    </span>
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="security" className="mt-3 space-y-2">
                {data.bans.length > 0 && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-1">
                    {data.bans.map((b, i) => (
                      <p key={i} className="text-xs flex items-center gap-2">
                        <BanIcon className="w-3.5 h-3.5 text-red-400" /> Banned {b.room_id ? `from room #${b.room_id}` : "site-wide"} · {when(b._created_at)}
                      </p>
                    ))}
                  </div>
                )}
                {data.reports.length > 0 && (
                  <div className="rounded-xl border border-white/10 p-3 space-y-2">
                    <p className="text-xs font-semibold">Reports ({data.reports.length})</p>
                    {data.reports.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {r.reporter_username === p.username ? "Filed" : "Against"} · {r.report_reason} · {r.status ?? "pending"} · {when(r._created_at)}
                      </p>
                    ))}
                  </div>
                )}
                <div className="rounded-xl border border-white/10 p-3">
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5" /> Recent logins ({data.ips.length})
                  </p>
                  {data.ips.length === 0 && <p className="text-xs text-muted-foreground">No IP records.</p>}
                  {data.ips.slice(0, 10).map((ip, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-1 border-b border-white/5 last:border-0">
                      <span className="text-xs font-mono">{ip.ip ?? "unknown"}</span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[45%]">{ip.user_agent ?? ""}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{when(ip._created_at)}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserDiagnostics;
