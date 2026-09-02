import { useEffect, useState } from "react";
import { Eraser, FileText, Loader2, Megaphone, RefreshCw, Wifi, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { functions } from "@/lib/shared/kliv-functions.js";
import { useAppSettings, settingText } from "@/lib/appSettings";
import { useAdminData } from "./useAdminData";

/** Edit the text people see on the home screen. */
const AdminSiteInfo = () => {
  const { toast } = useToast();
  const { settings, update } = useAppSettings();
  const [siteName, setSiteName] = useState("");
  const [welcome, setWelcome] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [rules, setRules] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSiteName(settingText(settings, "site_name"));
    setWelcome(settingText(settings, "welcome_message"));
    setAnnouncement(settingText(settings, "announcement"));
    setRules(settingText(settings, "rules_text"));
  }, [settings]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await update("site_name", siteName);
      await update("welcome_message", welcome);
      await update("announcement", announcement);
      await update("rules_text", rules);
      toast({ title: "Saved", description: "The live site now uses this text." });
    } catch {
      toast({ title: "Couldn't save", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="w-4 h-4 text-primary" /> Site text
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="site-name-input">Site name</Label>
          <Input id="site-name-input" value={siteName} maxLength={40} onChange={(e) => setSiteName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="welcome-input">Welcome message (home screen)</Label>
          <Input id="welcome-input" value={welcome} maxLength={200} onChange={(e) => setWelcome(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="announcement-input">Announcement banner</Label>
          <Input
            id="announcement-input"
            value={announcement}
            maxLength={300}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Leave empty to hide"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rules-input">Community rules (home screen)</Label>
          <Textarea
            id="rules-input"
            value={rules}
            maxLength={2000}
            rows={4}
            onChange={(e) => setRules(e.target.value)}
            placeholder={"Be kind.\nNo spam."}
          />
          <p className="text-xs text-muted-foreground">Leave empty to hide the rules card.</p>
        </div>
        <Button onClick={handleSave} disabled={busy}>
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save site text
        </Button>
      </CardContent>
    </Card>
  );
};

const DEFAULT_TERMS_HINT =
  "Anything you type here replaces the Terms of Use page text. Leave empty to use the built-in terms.";

/** Edit the Terms of Use text people accept. */
const AdminTermsEditor = () => {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, loading, refresh } = useAdminData(
    () => db.query<{ setting_key: string; setting_value: string }>("admin_settings"),
  );

  useEffect(() => {
    const row = data?.find((r) => r.setting_key === "terms_text");
    setText(row ? String(row.setting_value ?? "") : "");
  }, [data]);

  const save = async (value: string) => {
    setBusy(true);
    try {
      const existing = await db.query<{ setting_key: string }>("admin_settings", {
        setting_key: "eq.terms_text",
      });
      if (existing.length > 0) {
        await db.update("admin_settings", { setting_key: "eq.terms_text" }, { setting_value: value });
      } else {
        await db.insert("admin_settings", { setting_key: "terms_text", setting_value: value });
      }
      toast({
        title: "Terms saved",
        description: value.trim() ? "Everyone now accepts your custom terms." : "Back to the built-in terms.",
      });
      await refresh();
    } catch {
      toast({ title: "Couldn't save the terms", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="w-4 h-4 text-primary" /> Terms of Use
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{DEFAULT_TERMS_HINT}</p>
        <Textarea
          aria-label="Terms of Use text"
          value={text}
          rows={12}
          maxLength={20000}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Our terms…\n\n1. Be respectful…"}
        />
        <div className="flex gap-2">
          <Button onClick={() => save(text)} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save terms
          </Button>
          <Button variant="outline" onClick={() => save("")} disabled={busy || text === ""}>
            Reset to built-in
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

/** Small one-click cleanups. */
const AdminMaintenance = () => {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const runPurge = async () => {
    setBusy("purge");
    try {
      const result = await functions.post<{ deletedMessages?: number }>("purge-messages", {});
      setLastResult(`Cleanup removed ${result.deletedMessages ?? 0} old message(s).`);
      toast({ title: "Cleanup ran" });
    } catch {
      toast({ title: "Cleanup couldn't run", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const clearTyping = async () => {
    setBusy("typing");
    try {
      const rows = await db.query<{ _row_id: number }>("typing_status", {});
      if (rows.length > 0) await db.delete("typing_status", {});
      setLastResult(`Cleared ${rows.length} stale typing indicator(s).`);
      toast({ title: "Typing indicators cleared" });
    } catch {
      toast({ title: "Couldn't clear typing indicators", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const clearOfflinePresence = async () => {
    setBusy("presence");
    try {
      const rows = await db.query<{ _row_id: number }>("online_users", { is_online: "eq.0" });
      if (rows.length > 0) await db.delete("online_users", { is_online: "eq.0" });
      setLastResult(`Removed ${rows.length} offline presence record(s).`);
      toast({ title: "Offline presence cleared" });
    } catch {
      toast({ title: "Couldn't clear presence records", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wrench className="w-4 h-4 text-primary" /> Maintenance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Quick cleanups that are safe to run any time. Nothing here deletes real messages or accounts.
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" disabled={busy !== null} onClick={runPurge}>
            {busy === "purge" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Remove old messages
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={clearTyping}>
            {busy === "typing" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eraser />}
            Clear typing
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={clearOfflinePresence}>
            {busy === "presence" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wifi className="w-4 h-4 mr-2" />}
            Clear offline presence
          </Button>
        </div>
        {lastResult && <p className="text-sm text-emerald-400">{lastResult}</p>}
      </CardContent>
    </Card>
  );
};

export { AdminSiteInfo, AdminTermsEditor, AdminMaintenance };
