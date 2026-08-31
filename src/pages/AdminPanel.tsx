import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Ban as BanIcon,
  CheckCircle2,
  Copy,
  DoorOpen,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Flag,
  KeyRound,
  Lightbulb,
  Loader2,
  LogIn,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCog,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import auth from "@/lib/shared/kliv-auth.js";
import { functions } from "@/lib/shared/kliv-functions.js";
import { downloadWebsiteZip } from "@/lib/websiteZip";
import UserManager, { type SessionInfo } from "@/lib/userManagement";
import {
  SETTING_DEFS,
  SETTING_GROUPS,
  suggestPassword,
  useAppSettings,
  type SettingValue,
} from "@/lib/appSettings";
import { isPresenceOnline, parseSeen, type PresenceRow } from "@/lib/presence";

interface RoomRow {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
  [key: string]: unknown;
}

interface BanRow {
  _row_id: number;
  username: string;
  room_id: number | null;
  [key: string]: unknown;
}

interface ReportRow {
  _row_id: number;
  reported_username: string;
  reporter_username: string;
  report_reason: string;
  custom_reason: string | null;
  status: string;
  _created_at: number;
  [key: string]: unknown;
}

interface SuggestionRow {
  _row_id: number;
  content: string;
  username: string;
  _created_at: number;
  [key: string]: unknown;
}

interface MessageRow {
  _row_id: number;
  room_id: number;
  sender_name: string;
  content: string;
  _created_at: number;
  impersonated_by?: string | null;
  [key: string]: unknown;
}

interface DowntimeRow {
  _row_id: number;
  start_time: number;
  end_time: number;
  reason: string | null;
  is_active: number;
  [key: string]: unknown;
}

interface ProfileAccountRow {
  _row_id: number;
  user_id: string;
  username: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  _created_at: number;
  [key: string]: unknown;
}

interface CredentialRow {
  _row_id: number;
  user_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  _created_at: number;
  [key: string]: unknown;
}

interface IpRow {
  _row_id: number;
  user_id: string | null;
  username: string | null;
  email: string | null;
  ip: string;
  user_agent: string | null;
  _created_at: number;
  [key: string]: unknown;
}

interface TypingRow {
  _row_id: number;
  room_id: number;
  username: string;
  draft: string;
  updated_at: number;
  [key: string]: unknown;
}

interface AuditRow {
  _row_id: number;
  action: string;
  actor_email: string | null;
  target: string | null;
  detail: string | null;
  _created_at: number;
  [key: string]: unknown;
}

const WEBSITE_SNAPSHOT_DATE = "August 31, 2026";

const generateRoomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const fmtTime = (value: number) =>
  value
    ? new Date(value * (value > 1e11 ? 1 : 1000)).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "unknown";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [downtimes, setDowntimes] = useState<DowntimeRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileAccountRow[]>([]);
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [ips, setIps] = useState<IpRow[]>([]);
  const [presence, setPresence] = useState<PresenceRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [ownerDataError, setOwnerDataError] = useState<string | null>(null);
  const [messageRoom, setMessageRoom] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("public");
  const [banInput, setBanInput] = useState("");
  const [downtimeHours, setDowntimeHours] = useState("2");
  const [downtimeReason, setDowntimeReason] = useState("");
  const [ipFilter, setIpFilter] = useState("");

  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [liveRoom, setLiveRoom] = useState<string>("");
  const [liveMessages, setLiveMessages] = useState<MessageRow[]>([]);
  const [liveTyping, setLiveTyping] = useState<TypingRow[]>([]);
  const [asUser, setAsUser] = useState("");
  const [asText, setAsText] = useState("");
  const [asBusy, setAsBusy] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<string | null>(null);

  // Settings + cleanup
  const { settings, loaded: settingsLoaded, update: updateSetting, reload: reloadSettings } = useAppSettings();
  const [purgeInfo, setPurgeInfo] = useState<{ at: number; count: number } | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);

  // Password reset
  const [pwTarget, setPwTarget] = useState<{ userId: string; username: string } | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState<string | null>(null);

  useEffect(() => {
    setAuthorized(localStorage.getItem("isAdmin") === "true");
  }, []);

  useEffect(() => {
    if (authorized === false) {
      navigate("/admin");
    }
  }, [authorized, navigate]);

  useEffect(() => {
    if (authorized !== true) return;
    let cancelled = false;
    UserManager.getSession()
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authorized]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [roomRows, banRows, reportRows, suggestionRows, downtimeRows, profileRows, presenceRows] =
        await Promise.all([
          db.query<RoomRow>("rooms", { order: "_row_id.asc" }),
          db.query<BanRow>("bans", { order: "_created_at.desc" }),
          db.query<ReportRow>("user_reports", { order: "_created_at.desc" }),
          db.query<SuggestionRow>("suggestions", { order: "_created_at.desc" }),
          db.query<DowntimeRow>("downtime_schedules", { order: "start_time.desc" }),
          db.query<ProfileAccountRow>("user_profiles", { order: "_created_at.desc" }),
          db.query<PresenceRow>("online_users", { order: "last_seen.desc" }),
        ]);
      setRooms(roomRows);
      setBans(banRows);
      setReports(reportRows);
      setSuggestions(suggestionRows);
      setDowntimes(downtimeRows);
      setProfiles(profileRows);
      setPresence(presenceRows);
    } catch (error) {
      console.error("Admin load failed:", error);
      toast({ title: "Couldn't load admin data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authorized) {
      loadAll();
    }
  }, [authorized, loadAll]);

  // Keep online/offline status fresh while the panel is open
  useEffect(() => {
    if (!authorized) return;
    const loadPresence = async () => {
      try {
        setPresence(await db.query<PresenceRow>("online_users", { order: "last_seen.desc" }));
      } catch {
        // best-effort
      }
    };
    const timer = setInterval(loadPresence, 30000);
    return () => clearInterval(timer);
  }, [authorized]);

  const loadMessages = useCallback(async () => {
    try {
      const rows = await db.query<MessageRow>("messages", { order: "_created_at.desc" });
      setMessages(rows.slice(0, 100));
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, []);

  useEffect(() => {
    if (authorized && session) {
      loadMessages();
    }
  }, [authorized, session, loadMessages]);

  const loadPurgeInfo = useCallback(async () => {
    try {
      const rows = await db.query<{ setting_key: string; setting_value: string }>("admin_settings");
      const at = Number(rows.find((r) => r.setting_key === "last_purge_at")?.setting_value ?? 0);
      const count = Number(rows.find((r) => r.setting_key === "last_purge_count")?.setting_value ?? 0);
      setPurgeInfo(at > 0 ? { at, count } : null);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    if (authorized) {
      loadPurgeInfo();
    }
  }, [authorized, loadPurgeInfo]);

  const loadOwnerData = useCallback(async () => {
    setOwnerDataError(null);
    try {
      const [credRows, ipRows, auditRows] = await Promise.all([
        db.query<CredentialRow>("account_credentials", { order: "_created_at.desc" }),
        db.query<IpRow>("ip_logs", { order: "_created_at.desc" }),
        db.query<AuditRow>("admin_audit", { order: "_created_at.desc", limit: "20" }),
      ]);
      setCredentials(credRows);
      setIps(ipRows);
      setAudit(auditRows);
    } catch {
      setOwnerDataError("Couldn't load account and IP data.");
    }
  }, []);

  useEffect(() => {
    if (session?.isPrimaryTeam) {
      loadOwnerData();
    }
  }, [session, loadOwnerData]);

  const loadLive = useCallback(async () => {
    if (!liveRoom) return;
    try {
      const [msgRows, typingRows] = await Promise.all([
        db.query<MessageRow>("messages", {
          room_id: `eq.${liveRoom}`,
          order: "_created_at.desc",
          limit: "50",
        }),
        db.query<TypingRow>("typing_status", { room_id: `eq.${liveRoom}` }),
      ]);
      setLiveMessages(msgRows);
      setLiveTyping(
        typingRows.filter((t) => t.draft && Date.now() - Number(t.updated_at) < 15000)
      );
    } catch {
      // best-effort live view
    }
  }, [liveRoom]);

  useEffect(() => {
    if (!authorized || !session || !liveRoom) return;
    loadLive();
    const timer = setInterval(loadLive, 2500);
    return () => clearInterval(timer);
  }, [authorized, session, liveRoom, loadLive]);

  useEffect(() => {
    if (!liveRoom && rooms.length > 0) {
      setLiveRoom(String(rooms[0]._row_id));
    }
  }, [rooms, liveRoom]);

  const roomName = (id: number) => rooms.find((r) => r._row_id === id)?.name ?? `Room #${id}`;
  const bannedUsernames = new Set(bans.map((b) => b.username));

  const handleCreateRoom = async () => {
    const name = newRoomName.trim();
    if (!name) return;
    const type = newRoomType === "private" ? "private" : "public";
    const code = type === "private" ? generateRoomCode() : null;
    await db.insert("rooms", { name, code, type });
    toast({
      title: "Room created",
      description: type === "private" ? `Private room code: ${code}` : undefined,
    });
    setNewRoomName("");
    setNewRoomType("public");
    loadAll();
  };

  const handleDeleteRoom = async (room: RoomRow) => {
    await db.delete("messages", { room_id: `eq.${room._row_id}` });
    await db.delete("rooms", { _row_id: `eq.${room._row_id}` });
    toast({ title: `Deleted "${room.name}" and its messages` });
    loadAll();
    loadMessages();
  };

  const openRoomById = (id: number) => {
    sessionStorage.setItem(`room_unlocked_${id}`, "1");
    navigate(`/chat/${id}`);
  };

  const handleOpenRoom = (room: RoomRow) => {
    // Admins skip the private-room code gate
    openRoomById(room._row_id);
  };

  const handleDeleteMessage = async (row: MessageRow) => {
    await db.deleteOne("messages", { _row_id: `eq.${row._row_id}` });
    loadMessages();
    loadLive();
  };

  const handleBanUser = async (usernameRaw: string) => {
    const username = usernameRaw.trim().toLowerCase();
    if (!username) return;
    await db.insert("bans", {
      username,
      device_id: null,
      room_id: null,
    });
    toast({ title: "Banned", description: `${username} is now banned from the site.` });
    setBanInput("");
    loadAll();
  };

  const handleUnban = async (username: string) => {
    await db.delete("bans", { username: `eq.${username}` });
    toast({ title: "Unbanned", description: `${username} can use the site again.` });
    loadAll();
  };

  const handleResolveReport = async (row: ReportRow) => {
    await db.update("user_reports", { _row_id: `eq.${row._row_id}` }, { status: "resolved" });
    toast({ title: "Report resolved" });
    loadAll();
  };

  const handleDeleteReport = async (row: ReportRow) => {
    await db.deleteOne("user_reports", { _row_id: `eq.${row._row_id}` });
    loadAll();
  };

  const handleDeleteSuggestion = async (row: SuggestionRow) => {
    await db.deleteOne("suggestions", { _row_id: `eq.${row._row_id}` });
    loadAll();
  };

  const handleSendAs = async () => {
    if (!liveRoom || !asUser.trim() || !asText.trim()) return;
    setAsBusy(true);
    try {
      const target = asUser.trim().toLowerCase();
      await db.insert("messages", {
        room_id: Number(liveRoom),
        sender_name: target,
        content: asText.trim().slice(0, 2000),
        device_id: null,
        is_ai: 0,
        impersonated_by: session?.username ?? session?.email ?? "admin",
      });
      setAsText("");
      toast({
        title: "Message sent",
        description: `It now appears in the chat as @${target}.`,
      });
      loadLive();
      loadMessages();
    } catch {
      toast({ title: "Couldn't send that message", variant: "destructive" });
    } finally {
      setAsBusy(false);
    }
  };

  const handleDeleteAccount = async (userId: string, username: string) => {
    if (!window.confirm(`Delete @${username}'s account and all their chat data?`)) return;
    setDeletingAccount(userId);
    try {
      try {
        await auth.deleteUser(userId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        toast({
          title: "Chat data removed, login kept",
          description: message.includes("forbidden")
            ? "Deleting the login itself needs owner-level account permissions. Their profile and messages were removed."
            : "Their profile and messages were removed, but the login itself couldn't be deleted from here.",
        });
      }
      await Promise.allSettled([
        db.delete("user_profiles", { user_id: `eq.${userId}` }),
        db.delete("account_credentials", { user_id: `eq.${userId}` }),
        db.delete("messages", { sender_name: `eq.${username}` }),
        db.delete("direct_messages", { sender_username: `eq.${username}` }),
        db.delete("direct_messages", { recipient_username: `eq.${username}` }),
        db.delete("friendships", { user_id: `eq.${username}` }),
        db.delete("friendships", { friend_id: `eq.${username}` }),
        db.delete("online_users", { username: `eq.${username}` }),
        db.delete("typing_status", { username: `eq.${username}` }),
        db.delete("bans", { username: `eq.${username}` }),
      ]);
      toast({ title: `Deleted @${username}` });
    } finally {
      setDeletingAccount(null);
      loadAll();
      if (session?.isPrimaryTeam) {
        loadOwnerData();
      }
    }
  };

  const handleStartDowntime = async () => {
    const hours = Number(downtimeHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      toast({ title: "Enter a valid number of hours", variant: "destructive" });
      return;
    }
    const now = Date.now();
    await db.insert("downtime_schedules", {
      start_time: now,
      end_time: now + hours * 3600000,
      reason: downtimeReason.trim() || null,
      is_active: 1,
    });
    toast({ title: "Downtime enabled", description: `The site will be down for ${hours} hour(s).` });
    setDowntimeReason("");
    loadAll();
  };

  const handleEndDowntime = async () => {
    await db.update("downtime_schedules", { is_active: "eq.1" }, { is_active: 0, end_time: Date.now() });
    toast({ title: "Downtime ended", description: "The site is back up." });
    loadAll();
  };

  const handleSettingChange = async (key: string, value: SettingValue) => {
    try {
      await updateSetting(key, value);
      toast({ title: "Saved", description: "The live site now uses this." });
    } catch {
      toast({ title: "Couldn't save that setting", variant: "destructive" });
      reloadSettings();
    }
  };

  const handleRunPurgeNow = async () => {
    setPurgeBusy(true);
    try {
      const result = await functions.post<{ deletedMessages?: number }>("purge-messages", {});
      toast({
        title: "Cleanup finished",
        description: `${result?.deletedMessages ?? 0} old room message(s) deleted. Private messages were kept.`,
      });
      loadPurgeInfo();
      loadMessages();
    } catch {
      toast({ title: "Cleanup failed", variant: "destructive" });
    } finally {
      setPurgeBusy(false);
    }
  };

  const openResetPassword = (userId: string, username: string) => {
    setPwTarget({ userId, username });
    setPwValue(suggestPassword());
    setPwDone(null);
  };

  const handleResetPassword = async () => {
    if (!pwTarget || pwValue.length < 8) return;
    setPwBusy(true);
    try {
      await functions.post("owner-set-password", {
        userUuid: pwTarget.userId,
        password: pwValue,
        username: pwTarget.username,
      });
      setPwDone(pwValue);
      toast({
        title: "Password reset",
        description: `@${pwTarget.username} can now sign in with the new password.`,
      });
      loadOwnerData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast({
        title: "Couldn't reset that password",
        description: message.includes("forbidden")
          ? "Sign in with the site owner's own account to reset passwords."
          : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPwBusy(false);
    }
  };

  const handleAdminSignOut = () => {
    localStorage.removeItem("isAdmin");
    navigate("/admin");
  };

  if (authorized !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const SignInGate = (
    <Card>
      <CardContent className="py-10 text-center space-y-3">
        <LogIn className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="font-semibold">Sign-in required</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This tab reads live chat data, which only signed-in accounts can see. Sign in with the
          site owner's account, then come back to the admin panel.
        </p>
        <Button onClick={() => navigate("/login")}>
          <LogIn className="w-4 h-4 mr-2" /> Go to sign in
        </Button>
      </CardContent>
    </Card>
  );

  const OwnerGate = (
    <Card>
      <CardContent className="py-10 text-center space-y-2">
        <Shield className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="font-semibold">Site owner only</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Account details, IP addresses, password resets, and site settings are only available
          when you're signed in as the site owner's own login.
        </p>
      </CardContent>
    </Card>
  );

  const withSignIn = (content: ReactNode) =>
    session === undefined ? (
      <p className="text-sm text-muted-foreground py-8 text-center">Checking your sign-in…</p>
    ) : session === null ? (
      SignInGate
    ) : (
      content
    );

  const withOwner = (content: ReactNode) =>
    session === undefined ? (
      <p className="text-sm text-muted-foreground py-8 text-center">Checking your sign-in…</p>
    ) : session === null ? (
      SignInGate
    ) : !session.isPrimaryTeam ? (
      OwnerGate
    ) : (
      content
    );

  const now = Date.now();
  const activeDowntime = downtimes.find(
    (d) => d.is_active === 1 && now >= d.start_time && now < d.end_time
  );
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const filteredMessages =
    messageRoom === "all" ? messages : messages.filter((m) => String(m.room_id) === messageRoom);

  const onlineUsernames = new Set(
    presence.filter((p) => isPresenceOnline(p, now)).map((p) => p.username)
  );

  const accounts = profiles.map((p) => {
    const cred = credentials.find((c) => c.user_id === p.user_id);
    const pres = presence.find((r) => r.username === p.username);
    const name =
      [cred?.first_name ?? p.first_name ?? "", cred?.last_name ?? p.last_name ?? ""]
        .filter(Boolean)
        .join(" ") || p.display_name || "";
    const seenAt = pres ? parseSeen(pres.last_seen) : 0;
    return {
      userId: p.user_id,
      username: p.username,
      name,
      email: cred?.email ?? null,
      joined: Number(p._created_at),
      lastIp: ips.find((i) => i.user_id === p.user_id)?.ip ?? null,
      online: pres ? isPresenceOnline(pres, now) : false,
      lastSeen: seenAt,
      roomId: pres?.room_id != null ? Number(pres.room_id) : null,
    };
  });

  const filteredIps = ips.filter((row) => {
    const q = ipFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      (row.username ?? "").toLowerCase().includes(q) ||
      (row.email ?? "").toLowerCase().includes(q) ||
      row.ip.toLowerCase().includes(q)
    );
  });

  const liveRoomName = liveRoom ? roomName(Number(liveRoom)) : "";
  const suggestUsers = [
    ...new Set([
      ...liveTyping.map((t) => t.username),
      ...liveMessages.slice(0, 20).map((m) => m.sender_name),
    ]),
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="font-bold">Admin Panel</h1>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            {session && (
              <Badge variant={session.isPrimaryTeam ? "default" : "secondary"} className="ml-2">
                {session.isPrimaryTeam ? "owner" : session.email ?? "signed in"}
              </Badge>
            )}
            {onlineUsernames.size > 0 && (
              <Badge variant="outline" className="ml-2 gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {onlineUsernames.size} online
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Site
            </Button>
            <Button variant="ghost" size="sm" onClick={handleAdminSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
            <TabsTrigger value="ips">IP Logs</TabsTrigger>
            <TabsTrigger value="bans">Bans</TabsTrigger>
            <TabsTrigger value="reports">
              Reports {pendingReports > 0 && <Badge className="ml-1 h-4 px-1.5">{pendingReports}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            <TabsTrigger value="downtime">Downtime</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="download">Download</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
              {[
                { label: "Online now", value: onlineUsernames.size, icon: Wifi },
                { label: "Rooms", value: rooms.length, icon: MessageSquare },
                { label: "Accounts", value: profiles.length, icon: UserCog },
                { label: "Messages (last 100)", value: messages.length, icon: MessageSquare },
                { label: "Active bans", value: bans.length, icon: BanIcon },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="py-4 flex items-center gap-3">
                    <stat.icon className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="py-4 space-y-2">
                <p className="font-semibold">Viewing as</p>
                {session === undefined && (
                  <p className="text-sm text-muted-foreground">Checking your sign-in…</p>
                )}
                {session === null && (
                  <p className="text-sm text-muted-foreground">
                    Not signed in — data tabs are locked until you sign in with the site owner's
                    account.
                  </p>
                )}
                {session && (
                  <p className="text-sm text-muted-foreground">
                    {session.isPrimaryTeam ? "Site owner — " : ""}
                    {session.email ?? "unknown email"}
                    {session.username ? ` · chatting as @${session.username}` : " · no chat username yet"}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold">Website code</p>
                  <p className="text-xs text-muted-foreground">
                    Download a ZIP of this site's source code (snapshot from {WEBSITE_SNAPSHOT_DATE}).
                  </p>
                </div>
                <span onClick={downloadWebsiteZip}>
                  <Button>
                    <Download className="w-4 h-4 mr-2" /> Download Website
                  </Button>
                </span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold">Reload data</p>
                  <p className="text-xs text-muted-foreground">Refresh every list on this page.</p>
                </div>
                <Button variant="outline" onClick={loadAll} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ROOMS */}
          <TabsContent value="rooms" className="space-y-4 mt-4">
            {withSignIn(
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Create a room</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <Input
                        placeholder="Room name"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        className="flex-1 min-w-48"
                      />
                      <Select value={newRoomType} onValueChange={setNewRoomType}>
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Public</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleCreateRoom} disabled={!newRoomName.trim()}>
                        <Plus className="w-4 h-4 mr-2" /> Create
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {rooms.map((room) => {
                    const inRoom = presence.filter(
                      (p) => Number(p.room_id) === room._row_id && isPresenceOnline(p, now)
                    ).length;
                    return (
                      <Card key={room._row_id}>
                        <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{room.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                              <span>
                                {room.type === "private" ? "Private" : "Public"} · Room #{room._row_id}
                              </span>
                              {inRoom > 0 && (
                                <span className="inline-flex items-center gap-1 text-emerald-500">
                                  · <Wifi className="w-3 h-3" /> {inRoom} in room
                                </span>
                              )}
                              {room.type === "private" && (
                                <span className="inline-flex items-center gap-1">
                                  · Code:
                                  <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">
                                    {revealed[room._row_id] ? room.code : "••••••"}
                                  </code>
                                  <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground"
                                    aria-label={revealed[room._row_id] ? "Hide room code" : "Show room code"}
                                    onClick={() =>
                                      setRevealed((prev) => ({ ...prev, [room._row_id]: !prev[room._row_id] }))
                                    }
                                  >
                                    {revealed[room._row_id] ? (
                                      <EyeOff className="w-4 h-4" />
                                    ) : (
                                      <Eye className="w-4 h-4" />
                                    )}
                                  </button>
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleOpenRoom(room)}>
                              <DoorOpen className="w-4 h-4 mr-2" /> Open room
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteRoom(room)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {rooms.length === 0 && <p className="text-sm text-muted-foreground">No rooms yet.</p>}
                </div>
              </>
            )}
          </TabsContent>

          {/* LIVE */}
          <TabsContent value="live" className="space-y-4 mt-4">
            {withSignIn(
              <>
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <Label>Watch a room live</Label>
                    <div className="flex gap-2 flex-wrap items-center">
                      <Select value={liveRoom} onValueChange={setLiveRoom}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Pick a room" />
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.map((room) => (
                            <SelectItem key={room._row_id} value={String(room._row_id)}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={loadLive}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh now
                      </Button>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Wifi className="w-3.5 h-3.5" /> auto-refreshes every few seconds
                      </span>
                    </div>
                    {!liveRoom && <p className="text-xs text-muted-foreground">No rooms exist yet.</p>}
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Messages — {liveRoomName}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
                      {liveMessages.map((message) => (
                        <div
                          key={message._row_id}
                          className="flex items-start justify-between gap-2 border-b border-white/5 pb-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">@{message.sender_name}</span>{" "}
                              · {fmtTime(message._created_at)}
                              {message.impersonated_by && (
                                <Badge variant="secondary" className="ml-2 h-4 px-1.5">
                                  sent as
                                </Badge>
                              )}
                            </p>
                            <p className="text-sm break-words">{message.content}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteMessage(message)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {liveMessages.length === 0 && (
                        <p className="text-sm text-muted-foreground">No messages in this room yet.</p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Wifi className="w-4 h-4" /> Typing right now
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {liveTyping.map((t) => (
                          <div key={t._row_id} className="text-sm border-b border-white/5 pb-2">
                            <span className="font-semibold">@{t.username}</span>
                            <span className="text-muted-foreground"> is writing: </span>
                            <span className="italic break-words">"{t.draft}"</span>
                          </div>
                        ))}
                        {liveTyping.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Nobody is typing at the moment.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Send a message as someone else</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="as-user">Send as (username)</Label>
                          <Input
                            id="as-user"
                            placeholder="username"
                            value={asUser}
                            onChange={(e) => setAsUser(e.target.value.toLowerCase())}
                          />
                          {suggestUsers.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {suggestUsers.slice(0, 8).map((u) => (
                                <button
                                  key={u}
                                  type="button"
                                  className="text-xs bg-secondary px-2 py-1 rounded hover:bg-secondary/70"
                                  onClick={() => setAsUser(u)}
                                >
                                  @{u}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="as-text">Their message</Label>
                          <Input
                            id="as-text"
                            placeholder="What they 'say'…"
                            value={asText}
                            onChange={(e) => setAsText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendAs()}
                            maxLength={2000}
                          />
                        </div>
                        <Button onClick={handleSendAs} disabled={asBusy || !asUser.trim() || !asText.trim()}>
                          {asBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Send as @{asUser.trim() || "user"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          The message appears in the room under that person's name, exactly like
                          their own messages.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* MESSAGES */}
          <TabsContent value="messages" className="space-y-4 mt-4">
            {withSignIn(
              <>
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <Label>Filter by room</Label>
                    <div className="flex gap-2 flex-wrap items-center">
                      <Select value={messageRoom} onValueChange={setMessageRoom}>
                        <SelectTrigger className="w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All rooms</SelectItem>
                          {rooms.map((room) => (
                            <SelectItem key={room._row_id} value={String(room._row_id)}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={loadMessages}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {filteredMessages.map((message) => (
                    <Card key={message._row_id}>
                      <CardContent className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{message.sender_name}</span> in{" "}
                            {roomName(message.room_id)} · {fmtTime(message._created_at)}
                            {message.impersonated_by && (
                              <Badge variant="secondary" className="ml-2 h-4 px-1.5">
                                sent as
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm break-words">{message.content}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRoomById(message.room_id)}
                            aria-label={`Open ${roomName(message.room_id)}`}
                          >
                            <DoorOpen className="w-4 h-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteMessage(message)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredMessages.length === 0 && (
                    <p className="text-sm text-muted-foreground">No messages found.</p>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* ACCOUNTS */}
          <TabsContent value="accounts" className="space-y-4 mt-4">
            {withOwner(
              <>
                {ownerDataError && (
                  <Card>
                    <CardContent className="py-3 text-sm text-destructive">{ownerDataError}</CardContent>
                  </Card>
                )}
                <Card>
                  <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
                    Every account created on the site, with live online status. Passwords are stored
                    securely and can never be viewed by anyone — but you can reset any account's
                    password with the key button, which gives you full access to that account.
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {accounts.map((acct) => (
                    <Card key={acct.userId}>
                      <CardContent className="py-3 flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-semibold truncate flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                                acct.online ? "bg-emerald-500" : "bg-muted-foreground/40"
                              }`}
                            />
                            @{acct.username}
                            <Badge
                              className={acct.online ? "bg-emerald-600" : ""}
                              variant={acct.online ? "default" : "secondary"}
                            >
                              {acct.online ? "online" : "offline"}
                            </Badge>
                            {bannedUsernames.has(acct.username) && <Badge variant="destructive">banned</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground break-words">
                            {acct.name || "No name"} · {acct.email ?? "email hidden"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined {fmtTime(acct.joined)}
                            {acct.lastIp ? ` · Last IP ${acct.lastIp}` : ""}
                            {acct.online && acct.roomId ? ` · In ${roomName(acct.roomId)}` : ""}
                            {!acct.online && acct.lastSeen ? ` · Last active ${fmtTime(acct.lastSeen)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/profile/${acct.username}`)}
                          >
                            Profile
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/dm/${acct.username}`)}
                          >
                            Message
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Reset ${acct.username}'s password`}
                            title="Reset password"
                            onClick={() => openResetPassword(acct.userId, acct.username)}
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          {bannedUsernames.has(acct.username) ? (
                            <Button variant="outline" size="sm" onClick={() => handleUnban(acct.username)}>
                              Unban
                            </Button>
                          ) : (
                            <Button variant="destructive" size="sm" onClick={() => handleBanUser(acct.username)}>
                              <BanIcon className="w-4 h-4 mr-2" /> Ban
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deletingAccount === acct.userId}
                            onClick={() => handleDeleteAccount(acct.userId, acct.username)}
                          >
                            {deletingAccount === acct.userId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {accounts.length === 0 && (
                    <p className="text-sm text-muted-foreground">No accounts yet.</p>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* IP LOGS */}
          <TabsContent value="ips" className="space-y-4 mt-4">
            {withOwner(
              <>
                <Card>
                  <CardContent className="py-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      IP address recorded automatically when someone signs in or creates an account
                      (refreshed every few hours while they're active).
                    </p>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by username, email, or IP…"
                        value={ipFilter}
                        onChange={(e) => setIpFilter(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {filteredIps.slice(0, 200).map((row) => (
                    <Card key={row._row_id}>
                      <CardContent className="py-3 space-y-1">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <p className="text-sm">
                            <span className="font-semibold">@{row.username || "unknown"}</span>
                            {row.email ? ` · ${row.email}` : ""}
                          </p>
                          <code className="font-mono text-sm bg-secondary px-2 py-1 rounded">{row.ip}</code>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {fmtTime(Number(row._created_at))} · {row.user_agent?.slice(0, 90) ?? "unknown device"}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredIps.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {ips.length === 0
                        ? "No IP records yet — they appear the next time someone signs in."
                        : "No records match that search."}
                    </p>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* BANS */}
          <TabsContent value="bans" className="space-y-4 mt-4">
            {withSignIn(
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ban a user by username</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="username"
                        value={banInput}
                        onChange={(e) => setBanInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleBanUser(banInput)}
                      />
                      <Button variant="destructive" onClick={() => handleBanUser(banInput)} disabled={!banInput.trim()}>
                        <BanIcon className="w-4 h-4 mr-2" /> Ban
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {bans.map((ban) => (
                    <Card key={ban._row_id}>
                      <CardContent className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">@{ban.username}</p>
                          <p className="text-xs text-muted-foreground">
                            Banned {fmtTime(Number(ban._created_at))}
                            {ban.room_id !== null && typeof ban.room_id === "number"
                              ? ` · Room #${ban.room_id}`
                              : " · Site-wide"}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleUnban(ban.username)}>
                          Unban
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {bans.length === 0 && <p className="text-sm text-muted-foreground">No active bans.</p>}
                </div>
              </>
            )}
          </TabsContent>

          {/* REPORTS */}
          <TabsContent value="reports" className="space-y-4 mt-4">
            {withSignIn(
              <>
                <div className="space-y-2">
                  {reports.map((report) => (
                    <Card key={report._row_id}>
                      <CardContent className="py-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm">
                              <Flag className="w-4 h-4 inline mr-1 text-destructive" />
                              <span className="font-semibold">@{report.reported_username}</span> reported by @
                              {report.reporter_username}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Reason: {report.report_reason}
                              {report.custom_reason ? ` — ${report.custom_reason}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">{fmtTime(report._created_at)}</p>
                          </div>
                          <Badge variant={report.status === "resolved" ? "secondary" : "destructive"}>
                            {report.status}
                          </Badge>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {report.status !== "resolved" && (
                            <Button variant="outline" size="sm" onClick={() => handleResolveReport(report)}>
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Resolve
                            </Button>
                          )}
                          {!bannedUsernames.has(report.reported_username) && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleBanUser(report.reported_username)}
                            >
                              <BanIcon className="w-4 h-4 mr-2" /> Ban @{report.reported_username}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report)}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {reports.length === 0 && <p className="text-sm text-muted-foreground">No reports.</p>}
                </div>
              </>
            )}
          </TabsContent>

          {/* SUGGESTIONS */}
          <TabsContent value="suggestions" className="space-y-4 mt-4">
            {withSignIn(
              <>
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <Card key={suggestion._row_id}>
                      <CardContent className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm break-words">
                            <Lightbulb className="w-4 h-4 inline mr-1 text-yellow-500" />
                            {suggestion.content}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            From @{suggestion.username} · {fmtTime(suggestion._created_at)}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteSuggestion(suggestion)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {suggestions.length === 0 && <p className="text-sm text-muted-foreground">No suggestions.</p>}
                </div>
              </>
            )}
          </TabsContent>

          {/* DOWNTIME */}
          <TabsContent value="downtime" className="space-y-4 mt-4">
            {withSignIn(
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {activeDowntime ? "Downtime is currently ENABLED" : "Schedule downtime"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {activeDowntime && (
                      <p className="text-sm text-muted-foreground">
                        Until {fmtTime(activeDowntime.end_time)}
                        {activeDowntime.reason ? ` — ${activeDowntime.reason}` : ""}
                      </p>
                    )}
                    <div className="flex gap-2 flex-wrap items-end">
                      <div className="space-y-1">
                        <Label htmlFor="dt-hours">Hours</Label>
                        <Input
                          id="dt-hours"
                          type="number"
                          min="0.1"
                          step="0.5"
                          value={downtimeHours}
                          onChange={(e) => setDowntimeHours(e.target.value)}
                          className="w-24"
                        />
                      </div>
                      <div className="space-y-1 flex-1 min-w-48">
                        <Label htmlFor="dt-reason">Reason (optional)</Label>
                        <Input
                          id="dt-reason"
                          placeholder="Scheduled maintenance"
                          value={downtimeReason}
                          onChange={(e) => setDowntimeReason(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleStartDowntime}>Start downtime</Button>
                      {activeDowntime && (
                        <Button variant="destructive" onClick={handleEndDowntime}>
                          End downtime now
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      While downtime is on, every visitor sees a full-screen maintenance page with a
                      countdown until it ends.
                    </p>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {downtimes.slice(0, 10).map((row) => (
                    <Card key={row._row_id}>
                      <CardContent className="py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm">
                            {fmtTime(row.start_time)} → {fmtTime(row.end_time)}
                          </p>
                          <p className="text-xs text-muted-foreground">{row.reason || "No reason given"}</p>
                        </div>
                        <Badge variant={row.is_active === 1 ? "destructive" : "secondary"}>
                          {row.is_active === 1 ? "active" : "ended"}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                  {downtimes.length === 0 && <p className="text-sm text-muted-foreground">No downtime history.</p>}
                </div>
              </>
            )}
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            {withOwner(
              <>
                <Card>
                  <CardContent className="py-3 text-xs text-muted-foreground">
                    These settings control the live site — every change applies instantly to what
                    your users see. {settingsLoaded ? "" : "Loading current values…"}
                  </CardContent>
                </Card>

                {SETTING_GROUPS.map((group) => (
                  <Card key={group}>
                    <CardHeader>
                      <CardTitle className="text-base">{group}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {SETTING_DEFS.filter((def) => def.group === group).map((def) => (
                        <div key={def.key} className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{def.label}</p>
                            <p className="text-xs text-muted-foreground">{def.description}</p>
                          </div>
                          <div className="shrink-0">
                            {def.type === "toggle" ? (
                              <Switch
                                checked={settings[def.key] === true}
                                onCheckedChange={(v) => handleSettingChange(def.key, v)}
                              />
                            ) : def.type === "number" ? (
                              <Input
                                key={`${def.key}-${String(settings[def.key])}`}
                                type="number"
                                className="w-24"
                                min={def.min}
                                max={def.max}
                                defaultValue={String(settings[def.key])}
                                onBlur={(e) => {
                                  const n = Number(e.target.value);
                                  if (Number.isFinite(n) && n !== Number(settings[def.key])) {
                                    handleSettingChange(def.key, n);
                                  }
                                }}
                              />
                            ) : (
                              <Input
                                key={`${def.key}-${String(settings[def.key])}`}
                                className="w-64 max-w-full"
                                maxLength={300}
                                defaultValue={String(settings[def.key])}
                                placeholder={String(def.default)}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v !== String(settings[def.key])) {
                                    handleSettingChange(def.key, v);
                                  }
                                }}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Message auto-clear</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {purgeInfo
                        ? `Last cleanup deleted ${purgeInfo.count} room message(s) at ${fmtTime(purgeInfo.at)}. Runs every hour.`
                        : "The hourly cleanup hasn't run yet. Room messages older than your setting above will be cleared; private messages are never deleted."}
                    </p>
                    <Button variant="outline" onClick={handleRunPurgeNow} disabled={purgeBusy}>
                      {purgeBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eraser className="w-4 h-4 mr-2" />}
                      Run cleanup now
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent owner actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {audit.map((row) => (
                      <div key={row._row_id} className="text-sm border-b border-white/5 pb-2">
                        <span className="font-medium capitalize">{row.action.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {row.target} · by {row.actor_email ?? "owner"}
                        </span>
                        <p className="text-xs text-muted-foreground">{fmtTime(Number(row._created_at))}</p>
                      </div>
                    ))}
                    {audit.length === 0 && (
                      <p className="text-sm text-muted-foreground">No owner actions recorded yet.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* DOWNLOAD */}
          <TabsContent value="download" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Download website code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This downloads a ZIP file with this website's complete source code — every page,
                  component, style, and the database setup.
                </p>
                <span onClick={downloadWebsiteZip}>
                  <Button size="lg">
                    <Download className="w-4 h-4 mr-2" /> Download Website (.zip)
                  </Button>
                </span>
                <p className="text-xs text-muted-foreground">
                  Snapshot generated {WEBSITE_SNAPSHOT_DATE}. If the site changes after that, ask for
                  a fresh snapshot and this button will download the newest code.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* RESET PASSWORD DIALOG */}
      <Dialog open={pwTarget !== null} onOpenChange={(open) => !open && setPwTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset @{pwTarget?.username}'s password</DialogTitle>
            <DialogDescription>
              Sets a brand-new password for this account. Their old password stops working
              immediately. Use this to help someone who forgot theirs, or to take back an account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="flex gap-2">
                <Input
                  id="new-password"
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setPwValue(suggestPassword())}
                >
                  Suggest
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            {pwDone && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 space-y-2">
                <p className="text-sm">
                  New password for <span className="font-semibold">@{pwTarget?.username}</span>:
                </p>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm bg-secondary px-2 py-1 rounded break-all">
                    {pwDone}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(pwDone).then(
                        () => toast({ title: "Copied" }),
                        () => undefined
                      );
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy it somewhere safe — it's shown only once.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwTarget(null)}>
              Close
            </Button>
            <Button onClick={handleResetPassword} disabled={pwBusy || pwValue.length < 8}>
              {pwBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
