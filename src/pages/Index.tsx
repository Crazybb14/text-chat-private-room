import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban as BanIcon,
  Clock,
  Lightbulb,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Megaphone,
  MessageSquare,
  Plus,
  Search,
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
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import UserManager, { type SessionInfo } from "@/lib/userManagement";
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
import { useUserPrefs } from "@/lib/userSettings";
import { functions } from "@/lib/shared/kliv-functions.js";

interface RoomRow {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
  [key: string]: unknown;
}

type Phase = "loading" | "banned" | "downtime" | "finish" | "ready";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useAppSettings();
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [presence, setPresence] = useState<PresenceRow[]>([]);
  const [roomSearch, setRoomSearch] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("public");
  const [creating, setCreating] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [downtime, setDowntime] = useState<DowntimeInfo | null>(null);

  // One-time profile completion
  const [profileUsername, setProfileUsername] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const username = session?.username ?? null;

  // Personal preferences (online visibility is honored here)
  const { prefs } = useUserPrefs(username);

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
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
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

      try {
        const bans = await db.query("bans", { username: `eq.${currentSession.username}` });
        if (bans.length > 0) {
          setPhase("banned");
          return;
        }
      } catch {
        // ban check is best-effort
      }

      setPhase("ready");
      loadRooms();
    };
    init();
  }, [navigate, loadRooms]);

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
    }, 30000);
    return () => clearInterval(interval);
  }, [phase, loadRooms]);

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

  const handleSignOut = async () => {
    if (username) {
      const { markOffline } = await import("@/lib/presence");
      await markOffline(username);
    }
    await UserManager.signOut();
    navigate("/login", { replace: true });
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
        error?: string;
      }>("create-room", { name, type: wantsPublic ? "public" : "private", username });
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
        title: "Room created",
        description:
          type === "private" ? `Share this code to let people in: ${result.code}` : undefined,
      });
      setCreateOpen(false);
      setNewRoomName("");
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
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-6">
          <BanIcon className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-3xl font-bold">You're banned</h1>
          <p className="text-white/70">
            Your account has been banned from {siteName}. If you believe this is a mistake, you can
            submit an appeal.
          </p>
          <Button variant="destructive" onClick={() => navigate("/appeal")}>
            Submit an appeal
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "downtime" && downtime) {
    return <DowntimeScreen endTime={downtime.endTime} message={downtime.message} onBypass={() => setDowntime(null)} />;
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
  const publicRooms = rooms.filter((r) => r.type !== "private");
  const privateRooms = rooms.filter((r) => r.type === "private");
  const onlineCount = new Set(
    presence.filter((p) => isPresenceOnline(p, now)).map((p) => p.username)
  ).size;
  const roomOnline = (roomId: number) =>
    presence.filter((p) => Number(p.room_id) === roomId && isPresenceOnline(p, now)).length;

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
            <Button variant="ghost" size="icon" aria-label="Admin" title="Admin" onClick={() => navigate("/admin")}>
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

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Hey, <span className="text-primary">{username}</span>
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
          {visiblePublicRooms.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                {publicRooms.length === 0
                  ? isOwner && allowRoomCreation
                    ? "No public rooms yet — create the first one!"
                    : "No public rooms yet — the site owner creates public rooms."
                  : "No rooms match that search."}
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
          <FriendsDialog currentUsername={username || null} onOpenDirectMessage={(targetUsername) => navigate(`/direct-message/${targetUsername}`)} />
        </DialogContent>
      </Dialog>
      <PermissionPrompt />

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
