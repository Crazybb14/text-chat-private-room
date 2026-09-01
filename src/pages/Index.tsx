import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Clock,
  Copy,
  History,
  Lightbulb,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Megaphone,
  MessageSquare,
  Phone,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings as SettingsIcon,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import UserManager, { type SessionInfo } from "@/lib/userManagement";
import { useKickWatch } from "@/lib/kickWatch";
import NotificationBell from "@/components/NotificationBell";
import FriendsDialog from "@/components/FriendsDialog";
import PermissionPrompt from "@/components/PermissionPrompt";
import DowntimeScreen, { getActiveDowntime, type DowntimeInfo } from "@/components/DowntimeScreen";
import {
  settingBool,
  settingNumber,
  settingText,
  useAppSettings,
} from "@/lib/appSettings";
import {
  isPresenceOnline,
  usePresenceHeartbeat,
  type PresenceRow,
} from "@/lib/presence";
import { isOwnerSession } from "@/lib/owner";
import { splitLobbyRooms, type RoomKindRow } from "@/lib/roomTypes";
import { getActiveCalls, getCallParticipants, participantPresent } from "@/lib/calls";
import { useUserPrefs } from "@/lib/userSettings";
import { functions } from "@/lib/shared/kliv-functions.js";
import BanScreen from "@/components/BanScreen";
import { checkBanStatus, type BanStatus } from "@/lib/moderation";
import { allPermissions, getAdminSession, saveAdminSession } from "@/lib/adminAccounts";
import {
  getActiveLockFor,
  getNotices,
  getReloadState,
  getSiteStats,
  shouldShowReload,
  type AccountLockRow,
  type ReloadState,
  type SiteStats,
  type VersionNotice,
} from "@/lib/siteNotices";

interface RoomRow extends RoomKindRow {
  code: string | null;
  type: string;
  [key: string]: unknown;
}

type Phase = "loading" | "banned" | "locked" | "downtime" | "finish" | "ready";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useAppSettings();
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<SessionInfo | null>(null);

  // If an admin kicks this account, sign out and go back to the login page.
  useKickWatch(session?.username ?? null);
  const [isOwner, setIsOwner] = useState(false);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [presence, setPresence] = useState<PresenceRow[]>([]);
  const [roomSearch, setRoomSearch] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("public");
  const [newRoomVoice, setNewRoomVoice] = useState(false);
  const [creating, setCreating] = useState(false);
  const [voiceCallCounts, setVoiceCallCounts] = useState<Record<number, number>>({});
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [downtime, setDowntime] = useState<DowntimeInfo | null>(null);
  const [banInfo, setBanInfo] = useState<BanStatus | null>(null);
  const [lockInfo, setLockInfo] = useState<AccountLockRow | null>(null);

  // Version notices, the owner's "reload" flag, and live site stats
  const [notices, setNotices] = useState<VersionNotice[]>([]);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [reloadFlag, setReloadFlag] = useState<ReloadState>({ at: 0, message: "" });
  const [reloadDismissedAt, setReloadDismissedAt] = useState(0);
  const [stats, setStats] = useState<SiteStats>({ members: 0, messages: 0, rooms: 0, feedback: 0 });
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const pageLoadedAt = useRef(Date.now());

  // One-time profile completion
  const [profileUsername, setProfileUsername] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const username = session?.username ?? null;

  // Personal preferences (online visibility is honored here)
  const { prefs } = useUserPrefs(username);

  // Site accent color picked by the admin (Site → Accent color)
  useEffect(() => {
    const accent = settingText(settings, "theme_accent");
    if (/^[a-z]{3,10}$/.test(accent)) {
      document.documentElement.dataset.accent = accent;
    } else {
      delete document.documentElement.dataset.accent;
    }
  }, [settings]);

  // Keep this user's online status fresh everywhere, not just inside rooms
  usePresenceHeartbeat(prefs.show_online ? username : null);

  const allowRoomCreation = settingBool(settings, "allow_room_creation");
  const allowPrivateRooms = settingBool(settings, "allow_private_rooms");
  const siteName = settingText(settings, "site_name") || "ChatRooms";
  const welcomeMessage = settingText(settings, "welcome_message");
  const announcement = settingText(settings, "announcement");
  const autoDeleteHours = settingNumber(settings, "auto_delete_hours");
  const roomNameMax = settingNumber(settings, "room_name_max_length") || 60;
  const showOnline = settingBool(settings, "show_online_status");

  const loadRooms = useCallback(async () => {
    try {
      const [roomRows, presenceRows] = await Promise.all([
        db.query<RoomRow>("rooms", { order: "_row_id.asc" }),
        db.query<PresenceRow>("online_users", { order: "last_seen.desc" }),
      ]);
      setRooms(roomRows);
      setPresence(presenceRows);

      // Live head-count for voice rooms: how many people are in each call.
      const publicVoiceIds = roomRows
        .filter((r) => r.type !== "private" && Number(r.is_voice) === 1)
        .map((r) => r._row_id);
      // Remember which rooms are voice rooms so room pages can trust it even
      // if a single-row lookup drops the flag.
      try {
        sessionStorage.setItem("voice_room_ids", JSON.stringify(publicVoiceIds));
      } catch {
        // storage unavailable — the room lookup still works
      }
      if (publicVoiceIds.length > 0) {
        const activeCalls = await getActiveCalls();
        const counts: Record<number, number> = {};
        await Promise.all(
          activeCalls
            .filter((c) => c.room_id !== null && publicVoiceIds.includes(Number(c.room_id)))
            .map(async (c) => {
              const parts = await getCallParticipants(c._row_id);
              const present = parts.filter((p) => participantPresent(p)).length;
              const rid = Number(c.room_id);
              counts[rid] = Math.max(counts[rid] ?? 0, present);
            })
        );
        setVoiceCallCounts(counts);
      } else {
        setVoiceCallCounts({});
      }
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
  }, []);

  const loadStatsAndNotices = useCallback(async () => {
    const [nextStats, nextNotices] = await Promise.all([getSiteStats(), getNotices()]);
    setStats(nextStats);
    setNotices(nextNotices);
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!localStorage.getItem("terms_accepted")) {
        navigate("/terms");
        return;
      }
      const currentSession = await UserManager.getSession();
      if (!currentSession) {
        navigate("/login", { replace: true });
        return;
      }
      setSession(currentSession);
      setIsOwner(isOwnerSession(currentSession));

      // Refresh the visitor's IP record for the admin panel (self-throttled)
      void UserManager.logLoginIp(currentSession.username);

      const down = await getActiveDowntime();
      if (down) {
        setDowntime(down);
        setPhase("downtime");
        return;
      }

      if (!currentSession.username) {
        setPhase("finish");
        return;
      }

      const banStatus = await checkBanStatus(currentSession.username, currentSession.email);
      if (banStatus.banned) {
        setBanInfo(banStatus);
        setPhase("banned");
        return;
      }

      // The owner can lock an account while fixing something on it
      const activeLock = await getActiveLockFor(currentSession.username);
      if (activeLock) {
        setLockInfo(activeLock);
        setPhase("locked");
        return;
      }

      setPhase("ready");
      loadRooms();
      loadStatsAndNotices();
      setReloadFlag(await getReloadState());
    };
    init();
  }, [navigate, loadRooms, loadStatsAndNotices]);

  // Poll for downtime + refresh rooms/presence while the site is usable
  useEffect(() => {
    if (phase !== "ready") return;
    const interval = setInterval(async () => {
      const down = await getActiveDowntime();
      if (down) {
        setDowntime(down);
        setPhase("downtime");
        return;
      }
      loadRooms();
      loadStatsAndNotices();
      setReloadFlag(await getReloadState());
    }, 30000);
    return () => clearInterval(interval);
  }, [phase, loadRooms, loadStatsAndNotices]);

  const handleSaveUsername = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    const chosen = profileUsername.trim().toLowerCase();
    if (chosen.length < 3 || chosen.length > 20 || !/^[a-z0-9_]+$/.test(chosen)) {
      setProfileError("Usernames are 3–20 characters: letters, numbers, and underscores.");
      return;
    }
    setProfileBusy(true);
    setProfileError(null);
    try {
      if (!(await UserManager.isUsernameAvailable(chosen))) {
        setProfileError("That username is already taken.");
        return;
      }
      await UserManager.createProfile({
        userUuid: session.userUuid,
        email: session.email,
        username: chosen,
        firstName: session.firstName ?? "",
        lastName: session.lastName ?? "",
      });
      setSession({ ...session, username: chosen });
      setProfileUsername("");
      setPhase("ready");
      loadRooms();
      toast({ title: "You're all set!", description: `Your username is @${chosen}.` });
    } catch {
      setProfileError("Couldn't save that username. Try another one.");
    } finally {
      setProfileBusy(false);
    }
  };

  const handleAdminClick = () => {
    if (isOwner) {
      saveAdminSession({ username: session?.email ?? "owner", permissions: allPermissions() });
      localStorage.setItem("isAdmin", "true");
      navigate("/admin/panel");
      return;
    }
    const staffSession = getAdminSession();
    if (staffSession) {
      localStorage.setItem("isAdmin", "true");
      navigate("/admin/panel");
      return;
    }
    toast({
      title: "You are not admin",
      description: "Only the site owner and invited admins can open the admin panel.",
    });
  };

  const handleSignOut = async () => {
    if (username) {
      const { markOffline } = await import("@/lib/presence");
      await markOffline(username);
    }
    await UserManager.signOut();
    navigate("/login", { replace: true });
  };

  const handleSendFeedback = async () => {
    const content = feedbackText.trim();
    if (!content || !username) return;
    setFeedbackBusy(true);
    try {
      await db.insertOne("suggestions", { content, username });
      setFeedbackText("");
      toast({ title: "Thanks!", description: "Your suggestion went straight to the site owner." });
      loadStatsAndNotices();
    } catch {
      toast({ title: "Couldn't send that", description: "Please try again.", variant: "destructive" });
    } finally {
      setFeedbackBusy(false);
    }
  };

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    try {
      const rows = await db.query<RoomRow>("rooms", { code: `eq.${code}` });
      if (rows.length === 0) {
        toast({ title: "Room not found", description: "No room exists with that code.", variant: "destructive" });
      } else {
        sessionStorage.setItem(`room_unlocked_${rows[0]._row_id}`, "1");
        navigate(`/chat/${rows[0]._row_id}`);
      }
    } finally {
      setJoining(false);
    }
  };

  const openCreate = () => {
    setNewRoomType(isOwner ? "public" : "private");
    setNewRoomVoice(false);
    setCreateOpen(true);
  };

  const handleCreateRoom = async () => {
    const name = newRoomName.trim();
    if (!name) return;
    if (name.length > roomNameMax) {
      toast({
        title: "Room name too long",
        description: `Keep it under ${roomNameMax} characters.`,
        variant: "destructive",
      });
      return;
    }
    const wantsPublic = isOwner && newRoomType === "public";
    setCreating(true);
    try {
      // The server decides who can create what — public rooms need the owner.
      const result = await functions.post<{
        ok?: boolean;
        roomId?: number;
        code?: string | null;
        type?: string;
        voice?: boolean;
        error?: string;
      }>("create-room", { name, type: wantsPublic ? "public" : "private", username, voice: newRoomVoice });
      if (!result?.ok || !result.roomId) {
        toast({
          title: "Couldn't create room",
          description: result?.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      const type = result.type === "public" ? "public" : "private";
      toast({
        title: newRoomVoice ? "Voice room created" : "Room created",
        description:
          type === "private" ? `Share this code to let people in: ${result.code}` : undefined,
      });
      setCreateOpen(false);
      setNewRoomName("");
      setNewRoomVoice(false);
      setNewRoomType(isOwner ? "public" : "private");
      if (type === "private") {
        sessionStorage.setItem(`room_unlocked_${result.roomId}`, "1");
      }
      await loadRooms();
      navigate(`/chat/${result.roomId}`);
    } catch {
      toast({ title: "Couldn't create room", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (phase === "banned") {
    return (
      <BanScreen
        reason={banInfo?.reason}
        untilMs={banInfo?.untilMs}
        permanent={banInfo?.permanent}
        evasion={banInfo?.evasion}
        siteName={siteName}
      />
    );
  }

  if (phase === "downtime" && downtime) {
    return <DowntimeScreen endTime={downtime.endTime} message={downtime.message} onBypass={() => setDowntime(null)} />;
  }

  if (phase === "locked" && lockInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-background to-background pointer-events-none" />
        <Card className="relative z-10 w-full max-w-md">
          <CardContent className="py-8 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold">Your account is temporarily locked</h1>
            <p className="text-sm text-muted-foreground break-words">
              {lockInfo.reason
                ? lockInfo.reason
                : "The site owner is working on your account right now — it'll be back shortly."}
            </p>
            <p className="text-xs text-muted-foreground">
              This isn't a ban. Check back in a little while.
            </p>
            <Button variant="outline" className="w-full" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "finish") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />
        <Card className="relative z-10 w-full max-w-md">
          <CardContent className="py-8 space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold">One last thing</h1>
              <p className="text-sm text-muted-foreground">
                {session?.firstName ? `Welcome, ${session.firstName}! ` : "Welcome! "}
                Pick the username you'll chat under.
              </p>
            </div>
            <form onSubmit={handleSaveUsername} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="profile-username">Username</Label>
                <Input
                  id="profile-username"
                  placeholder="3–20 letters, numbers, underscores"
                  value={profileUsername}
                  onChange={(e) => setProfileUsername(e.target.value.toLowerCase())}
                  maxLength={20}
                  autoFocus
                />
              </div>
              {profileError && <p className="text-sm text-destructive">{profileError}</p>}
              <Button type="submit" className="w-full" disabled={profileBusy || !profileUsername.trim()}>
                {profileBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save username
              </Button>
            </form>
            <Button variant="ghost" className="w-full" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> Use a different account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const now = Date.now();
  const { textPublic: publicRooms, voicePublic: voiceRooms, privateRooms } = splitLobbyRooms(rooms);
  const onlineCount = new Set(
    presence.filter((p) => isPresenceOnline(p, now)).map((p) => p.username)
  ).size;
  const roomOnline = (roomId: number) =>
    presence.filter((p) => Number(p.room_id) === roomId && isPresenceOnline(p, now)).length;

  // The visitor's own private rooms, so they can always find the join code
  const myPrivateRooms = username
    ? privateRooms.filter((r) => String(r.created_by ?? "").toLowerCase() === username)
    : [];

  const search = roomSearch.trim().toLowerCase();
  const visiblePublicRooms = search
    ? publicRooms.filter((r) => r.name.toLowerCase().includes(search))
    : publicRooms;

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      <header className="relative z-10 border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-lg">{siteName}</span>
          </div>
          <div className="flex items-center gap-1">
            {showOnline && onlineCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground mr-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {onlineCount} online
              </span>
            )}
            <NotificationBell username={username || ""} />
            <Button variant="ghost" size="icon" aria-label="Friends" title="Friends" onClick={() => setFriendsOpen(true)}>
              <Users className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Settings" title="Settings" onClick={() => navigate("/settings")}>
              <SettingsIcon className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Admin" title="Admin" onClick={handleAdminClick}>
              <Shield className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-8 space-y-8">
        {announcement && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-3.5 flex items-start gap-3">
              <Megaphone className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-sm break-words">{announcement}</p>
            </CardContent>
          </Card>
        )}

        {shouldShowReload(reloadFlag.at, pageLoadedAt.current, reloadDismissedAt) && (
          <Card className="border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="py-3.5 flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <RefreshCw className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">A new version of {siteName} was just released</p>
                <p className="text-xs text-muted-foreground break-words">
                  {reloadFlag.message || "Reload the page to pick up the newest version."}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={() => window.location.reload()}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload now
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReloadDismissedAt(Date.now())}>
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Hey, <span className="bg-gradient-to-r from-primary to-indigo-400 bg-clip-text text-transparent">{username}</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {welcomeMessage || "Pick a room and start chatting."}
            </p>
            {autoDeleteHours > 0 && (
              <p className="text-muted-foreground text-xs mt-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Room messages auto-clear after {autoDeleteHours}h — private messages stay forever.
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="text-xs px-2.5 py-1 rounded-full bg-secondary/70">
                {publicRooms.length} public room{publicRooms.length === 1 ? "" : "s"}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-secondary/70">
                {voiceRooms.length} voice room{voiceRooms.length === 1 ? "" : "s"}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-secondary/70">
                {privateRooms.length} private room{privateRooms.length === 1 ? "" : "s"}
              </span>
              {showOnline && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineCount} online now
                </span>
              )}
            </div>
          </div>
          {allowRoomCreation && (
            <Button onClick={openCreate} size="lg">
              <Plus className="w-4 h-4 mr-2" /> New room
            </Button>
          )}
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Public rooms
            </h2>
            {publicRooms.length > 6 && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search rooms…"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="pl-9 w-48 h-8"
                />
              </div>
            )}
          </div>
          {visiblePublicRooms.length === 0 && publicRooms.length > 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No rooms match that search.
              </CardContent>
            </Card>
          )}
          {publicRooms.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                {isOwner && allowRoomCreation
                  ? "No public rooms yet — create the first one!"
                  : "No public rooms yet — the site owner creates public rooms."}
              </CardContent>
            </Card>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePublicRooms.map((room) => {
              const online = showOnline ? roomOnline(room._row_id) : 0;
              let hue = 0;
              for (let i = 0; i < room.name.length; i++) hue = (hue * 31 + room.name.charCodeAt(i)) % 360;
              return (
                <Card
                  key={room._row_id}
                  className="cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 transition-all group"
                  onClick={() => navigate(`/chat/${room._row_id}`)}
                >
                  <CardContent className="flex items-center gap-3 py-4">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white font-bold"
                      style={{
                        background: `linear-gradient(135deg, hsl(${hue} 60% 42%), hsl(${(hue + 45) % 360} 60% 34%))`,
                      }}
                    >
                      {room.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{room.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {showOnline && online > 0 ? (
                          <span className="text-emerald-500 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {online} online
                          </span>
                        ) : (
                          "Public room"
                        )}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-2">
              <Radio className="w-4 h-4" /> Voice rooms
            </h2>
          </div>
          {(voiceRooms.length > 0 || (isOwner && allowRoomCreation)) && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {voiceRooms.map((room) => {
                const inCall = voiceCallCounts[room._row_id] ?? 0;
                let hue = 140;
                for (let i = 0; i < room.name.length; i++) hue = (hue * 31 + room.name.charCodeAt(i)) % 360;
                return (
                  <Card
                    key={room._row_id}
                    className="cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10 transition-all group"
                    onClick={() => navigate(`/chat/${room._row_id}`, { state: { voice: true } })}
                  >
                    <CardContent className="flex items-center gap-3 py-4">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white"
                        style={{
                          background: `linear-gradient(135deg, hsl(${hue} 60% 42%), hsl(${(hue + 45) % 360} 60% 34%))`,
                        }}
                      >
                        <Radio className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{room.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {inCall > 0 ? (
                            <span className="text-emerald-500 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {inCall} in the call
                            </span>
                          ) : (
                            "Voice room — join to talk"
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/chat/${room._row_id}`, { state: { voice: true } });
                        }}
                      >
                        <Phone className="w-3.5 h-3.5" /> Join
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {voiceRooms.length === 0 && isOwner && allowRoomCreation && (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    No voice rooms yet — hit “New room” and tick “Voice room” to make a public
                    call room that shows up right here.
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </section>

        {allowPrivateRooms && (
          <section className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="py-5 space-y-3">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <Lock className="w-4 h-4" /> Join a private room
                </h3>
                <p className="text-xs text-muted-foreground">
                  {privateRooms.length > 0
                    ? `${privateRooms.length} private room${privateRooms.length === 1 ? "" : "s"} exist — enter the code the owner shared with you.`
                    : "Enter a code the room owner shared with you."}
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Room code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                    maxLength={12}
                    className="uppercase font-mono tracking-widest"
                  />
                  <Button onClick={handleJoinByCode} disabled={joining || !joinCode.trim()}>
                    {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {allowRoomCreation && (
              <Card>
                <CardContent className="py-5 space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <UserPlus className="w-4 h-4" /> Your own room
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isOwner
                      ? "Make a public room anyone can join, or a private room that needs a code."
                      : "Your rooms are private — share the code with the people you invite."}
                  </p>
                  <Button variant="outline" onClick={openCreate}>
                    <Plus className="w-4 h-4 mr-2" /> Create a room
                  </Button>
                  {myPrivateRooms.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs font-medium">Your private room codes</p>
                      {myPrivateRooms.slice(0, 6).map((r) => (
                        <div key={r._row_id} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground truncate">{r.name}</span>
                          <button
                            type="button"
                            className="text-xs font-mono px-2 py-0.5 rounded bg-secondary/70 hover:bg-secondary flex items-center gap-1 shrink-0"
                            title="Click to copy this code"
                            onClick={() => {
                              void navigator.clipboard
                                .writeText(r.code ?? "")
                                .then(() => toast({ title: "Copied", description: r.code ?? "" }))
                                .catch(() => toast({ title: "Room code", description: r.code ?? "" }));
                            }}
                          >
                            {r.code} <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {!allowRoomCreation && (
          <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
            <LogIn className="w-3.5 h-3.5" /> Room creation is currently turned off by the site admin.
          </p>
        )}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-2">
            <Activity className="w-4 h-4" /> Site activity
          </h2>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{onlineCount}</p>
                <p className="text-xs text-muted-foreground">online right now</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{stats.members}</p>
                <p className="text-xs text-muted-foreground">members</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{stats.messages.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">messages sent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 text-center">
                <p className="text-2xl font-bold">{stats.rooms}</p>
                <p className="text-xs text-muted-foreground">rooms</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="py-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Lightbulb className="w-4 h-4 text-yellow-500" /> Feedback &amp; suggestions
              </h3>
              <p className="text-xs text-muted-foreground">
                {stats.feedback > 0
                  ? `${stats.feedback} suggestion${stats.feedback === 1 ? "" : "s"} sent in so far — add yours below.`
                  : "Tell the site owner what to add or fix — yours would be the first."}
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="What should be added or improved?"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendFeedback()}
                  maxLength={500}
                />
                <Button onClick={handleSendFeedback} disabled={!feedbackText.trim() || feedbackBusy}>
                  {feedbackBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span className="hidden sm:inline ml-1.5">Send</span>
                </Button>
              </div>
              <button
                type="button"
                className="text-xs text-primary/80 hover:underline"
                onClick={() => navigate("/suggestions")}
              >
                See your suggestions →
              </button>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-4">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Signed in as @{username}</span>
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => navigate("/suggestions")}
          >
            <Lightbulb className="w-3.5 h-3.5" /> Suggestions
          </button>
        </div>
      </footer>

      <Dialog open={friendsOpen} onOpenChange={setFriendsOpen}>
        <DialogContent className="max-w-md">
          <FriendsDialog currentUsername={username || null} onOpenDirectMessage={(targetUsername) => navigate(`/dm/${targetUsername}`)} />
        </DialogContent>
      </Dialog>
      <PermissionPrompt />

      {notices.length > 0 && (
        <Button
          size="sm"
          className="fixed bottom-5 right-5 z-40 rounded-full shadow-lg shadow-primary/20 gap-2"
          onClick={() => setWhatsNewOpen(true)}
          aria-label="What's new"
        >
          <History className="w-4 h-4" /> What&apos;s new · v{notices[0].version}
        </Button>
      )}

      <Dialog open={whatsNewOpen} onOpenChange={setWhatsNewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>What&apos;s new on {siteName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {notices.map((notice) => (
              <div
                key={notice._row_id}
                className="space-y-1.5 border-b border-white/5 pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="font-mono">v{notice.version}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date((notice.posted_at || 0) * 1000).toLocaleDateString()}
                  </span>
                </div>
                {notice.title && <p className="font-semibold">{notice.title}</p>}
                <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{notice.body}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="room-name">Room name</Label>
              <Input
                id="room-name"
                placeholder="e.g. Late Night Chat"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                maxLength={roomNameMax}
              />
              <p className="text-xs text-muted-foreground">
                {newRoomName.length}/{roomNameMax}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Room type</Label>
              <Select value={newRoomType} onValueChange={setNewRoomType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isOwner && <SelectItem value="public">Public — anyone can join</SelectItem>}
                  {(allowPrivateRooms || !isOwner) && (
                    <SelectItem value="private">Private — join code required</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {!isOwner ? (
                <p className="text-xs text-muted-foreground">
                  Public rooms can only be created by the site owner. Yours will be private with a
                  share code.
                </p>
              ) : newRoomType === "private" ? (
                <p className="text-xs text-muted-foreground">
                  A 6-character code will be generated — share it with the people you want in the
                  room.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="room-voice" className="flex items-center gap-2.5 font-normal cursor-pointer">
                <Checkbox
                  id="room-voice"
                  checked={newRoomVoice}
                  onCheckedChange={(checked) => setNewRoomVoice(checked === true)}
                />
                Make this a voice room
              </Label>
              <p className="text-xs text-muted-foreground">
                Voice rooms are call-first rooms — they get their own “Voice rooms” list on the main
                page instead of mixing into the text rooms, and anyone in them can start or join
                the call.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRoom} disabled={creating || !newRoomName.trim()}>
              {creating ? "Creating..." : "Create room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
