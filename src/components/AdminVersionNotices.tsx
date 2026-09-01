import { useCallback, useEffect, useState } from "react";
import { BellRing, History, Loader2, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  clearReloadNotice,
  deleteNotice,
  getNotices,
  getReloadState,
  isValidVersion,
  nextVersion,
  postNotice,
  sendReloadNotice,
  type ReloadState,
  type VersionNotice,
} from "@/lib/siteNotices";

/**
 * Admin tab for version notices. Nothing here posts by itself — the owner
 * writes each notice (version number + what's new) and presses Post.
 */
const AdminVersionNotices = ({
  isOwner,
  adminUsername,
}: {
  isOwner: boolean;
  adminUsername: string;
}) => {
  const { toast } = useToast();
  const [notices, setNotices] = useState<VersionNotice[]>([]);
  const [reload, setReload] = useState<ReloadState>({ at: 0, message: "" });

  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const [reloadMessage, setReloadMessage] = useState("");
  const [reloadBusy, setReloadBusy] = useState(false);

  // Invited admins prove who they are with their password (the owner doesn't
  // need to — their sign-in is checked server-side).
  const [password, setPassword] = useState("");
  const auth = isOwner ? undefined : { adminUsername, adminPassword: password };

  const load = useCallback(async () => {
    const [noticeRows, reloadState] = await Promise.all([getNotices(), getReloadState()]);
    setNotices(noticeRows);
    setReload(reloadState);
    setVersion((current) => current || nextVersion(noticeRows[0]?.version));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePost = async () => {
    if (!isValidVersion(version)) {
      toast({
        title: "Check the version number",
        description: "It should look like 1.4.2.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const result = await postNotice({ version: version.trim(), title: title.trim(), body: body.trim() }, auth);
      if (result.error) {
        toast({ title: "Couldn't post the notice", description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: `Version ${version.trim()} posted`,
        description: "It's now in the What's-new widget on the main site.",
      });
      setBody("");
      setTitle("");
      setVersion("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (notice: VersionNotice) => {
    const result = await deleteNotice(notice._row_id, auth);
    if (result.error) {
      toast({ title: "Couldn't remove that notice", description: result.error, variant: "destructive" });
      return;
    }
    await load();
  };

  const handleSendReload = async () => {
    setReloadBusy(true);
    try {
      const result = await sendReloadNotice(reloadMessage.trim(), auth);
      if (result.error) {
        toast({ title: "Couldn't send it", description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Reload notice sent",
        description: "Everyone on the site right now is being asked to reload.",
      });
      setReloadMessage("");
      await load();
    } finally {
      setReloadBusy(false);
    }
  };

  const handleClearReload = async () => {
    setReloadBusy(true);
    try {
      const result = await clearReloadNotice(auth);
      if (result.error) {
        toast({ title: "Couldn't clear it", description: result.error, variant: "destructive" });
        return;
      }
      await load();
    } finally {
      setReloadBusy(false);
    }
  };

  const reloadActive = reload.at > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4" /> Post a version notice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Nothing posts automatically. You write each notice and press Post — it then appears in
            the “What’s new” widget on the main site. Leave out anything you changed only here in
            the admin panel.
          </p>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <div className="space-y-1">
              <Label htmlFor="notice-version">Version</Label>
              <Input
                id="notice-version"
                value={version}
                onChange={(e) => setVersion(e.target.value.trim())}
                placeholder={nextVersion(notices[0]?.version)}
                className="font-mono"
                maxLength={16}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notice-title">Title (optional)</Label>
              <Input
                id="notice-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Voice rooms, site stats, and more"
                maxLength={120}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notice-body">What&apos;s new</Label>
            <Textarea
              id="notice-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"• What you added\n• What you fixed\n• What changed for users"}
              rows={5}
              maxLength={4000}
            />
          </div>
          {!isOwner && (
            <div className="space-y-1 max-w-xs">
              <Label htmlFor="notice-admin-pw">Your admin password</Label>
              <Input
                id="notice-admin-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Needed to post"
              />
            </div>
          )}
          <Button onClick={handlePost} disabled={busy || !body.trim() || !isValidVersion(version)}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Post notice
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="w-4 h-4" /> Tell everyone to reload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            After you ship an update, press this and every visitor sees a green banner asking them
            to reload the site. It stays until you clear it.
          </p>
          <div className="flex gap-2 flex-wrap items-end">
            <div className="space-y-1 flex-1 min-w-48">
              <Label htmlFor="reload-message">Message (optional)</Label>
              <Input
                id="reload-message"
                value={reloadMessage}
                onChange={(e) => setReloadMessage(e.target.value)}
                placeholder="New version is live — reload to get it!"
                maxLength={200}
              />
            </div>
            <Button onClick={handleSendReload} disabled={reloadBusy}>
              {reloadBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Send reload notice
            </Button>
            {reloadActive && (
              <Button variant="outline" onClick={handleClearReload} disabled={reloadBusy}>
                Clear it
              </Button>
            )}
          </div>
          {reloadActive && (
            <p className="text-xs text-emerald-500">
              Active — sent {new Date(reload.at).toLocaleString()}
              {reload.message ? `: “${reload.message}”` : ""}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Posted notices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {notices.map((notice) => (
            <div key={notice._row_id} className="flex items-start justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="font-mono">v{notice.version}</Badge>
                  {notice.title && <span className="text-sm font-medium">{notice.title}</span>}
                  <span className="text-xs text-muted-foreground">
                    {new Date((notice.posted_at || 0) * 1000).toLocaleDateString()} · by{" "}
                    {String(notice.posted_by ?? "").startsWith("admin:") ? String(notice.posted_by).slice(6) : "you"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-line break-words mt-1 line-clamp-3">
                  {notice.body}
                </p>
              </div>
              <Button variant="ghost" size="sm" aria-label={`Delete version ${notice.version} notice`} onClick={() => handleDelete(notice)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {notices.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No notices yet — post the first one above and it shows up on the main site right away.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminVersionNotices;
