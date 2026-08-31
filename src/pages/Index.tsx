import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban as BanIcon,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Settings as SettingsIcon,
  Shield,
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
import { getDeviceId } from "@/lib/deviceId";
import UserManager from "@/lib/userManagement";
import UsernameSetup from "@/components/UsernameSetup";
import NotificationBell from "@/components/NotificationBell";
import FriendsDialog from "@/components/FriendsDialog";

interface RoomRow {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
  [key: string]: unknown;
}

interface DowntimeInfo {
  start: number;
  end: number;
  reason: string | null;
}

type Phase = "loading" | "banned" | "downtime" | "setup" | "ready";

const generateRoomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const formatTime = (value: number) =>
  new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("loading");
  const [username, setUsername] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("public");
  const [creating, setCreating] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [downtime, setDowntime] = useState<DowntimeInfo | null>(null);
  const [now, setNow] = useState(Date.now());

  const checkDowntime = useCallback(async (): Promise<boolean> => {
    try {
      const rows = await db.query("downtime_schedules", {
        is_active: "eq.1",
        order: "start_time.desc",
      });
      const current = Date.now();
      const active = rows.find((r) => {
        const start = Number(r.start_time);
        const end = Number(r.end_time);
        return current >= start && current < end;
      });
      if (active) {
        setDowntime({
          start: Number(active.start_time),
          end: Number(active.end_time),
          reason: (active.reason as string | null) ?? null,
        });
        return true;
      }
      setDowntime(null);
      return false;
    } catch {
      return false;
    }
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const rows = await db.query<RoomRow>("rooms", { order: "_row_id.asc" });
      setRooms(rows);
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
      try {
        const deviceId = getDeviceId();
        const bans = await db.query("bans", { device_id: `eq.${deviceId}` });
        if (bans.length > 0) {
          setPhase("banned");
          return;
        }
        const isDown = await checkDowntime();
        if (isDown) {
          setPhase("downtime");
          return;
        }
        const user = await UserManager.getUsername();
        if (!user) {
          setPhase("setup");
          return;
        }
        setUsername(user);
        setPhase("ready");
        loadRooms();
      } catch (error) {
        console.error("Init failed:", error);
        setPhase("setup");
      }
    };
    init();
  }, [navigate, checkDowntime, loadRooms]);

  // Poll for downtime while the site is usable
  useEffect(() => {
    if (phase !== "ready") return;
    const interval = setInterval(async () => {
      const isDown = await checkDowntime();
      if (isDown) setPhase("downtime");
    }, 30000);
    return () => clearInterval(interval);
  }, [phase, checkDowntime]);

  // Countdown ticker while downtime screen is up
  useEffect(() => {
    if (phase !== "downtime") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [phase]);

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

  const handleCreateRoom = async () => {
    const name = newRoomName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const type = newRoomType === "private" ? "private" : "public";
      const code = type === "private" ? generateRoomCode() : null;
      const created = await db.insertOne<RoomRow>("rooms", { name, code, type });
      toast({
        title: "Room created",
        description: type === "private" ? `Share this code to let people in: ${code}` : undefined,
      });
      setCreateOpen(false);
      setNewRoomName("");
      setNewRoomType("public");
      if (type === "private") {
        sessionStorage.setItem(`room_unlocked_${created._row_id}`, "1");
      }
      await loadRooms();
      navigate(`/chat/${created._row_id}`);
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
            This device has been banned from ChatRooms. If you believe this is a mistake, you can
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
    const remaining = Math.max(0, downtime.end - now);
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-lg text-center space-y-6">
          <h1 className="text-4xl font-black tracking-widest text-red-500">
            DOWNTIME HAS BEEN ENABLED
          </h1>
          {downtime.reason && <p className="text-white/80 text-lg">{downtime.reason}</p>}
          <div className="text-white/70 space-y-1">
            <p>From: {formatTime(downtime.start)}</p>
            <p>To: {formatTime(downtime.end)}</p>
          </div>
          <div className="font-mono text-5xl font-bold tabular-nums">
            {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </div>
          <p className="text-white/50 text-sm">
            The site will come back automatically when downtime ends. This page will update on its
            own.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <UsernameSetup
        onUsernameSet={(user) => {
          setUsername(user);
          setPhase("ready");
          loadRooms();
        }}
      />
    );
  }

  const publicRooms = rooms.filter((r) => r.type !== "private");
  const privateRooms = rooms.filter((r) => r.type === "private");

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />

      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-lg">ChatRooms</span>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell username={username || ""} />
            <Button variant="ghost" size="icon" title="Friends" onClick={() => setFriendsOpen(true)}>
              <Users className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" title="Settings" onClick={() => navigate("/settings")}>
              <SettingsIcon className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" title="Admin" onClick={() => navigate("/admin")}>
              <Shield className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Hey, {username}</h1>
            <p className="text-muted-foreground text-sm">Pick a room and start chatting.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> New room
          </Button>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Public rooms
          </h2>
          {publicRooms.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                No public rooms yet — create the first one!
              </CardContent>
            </Card>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {publicRooms.map((room) => (
              <Card
                key={room._row_id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/chat/${room._row_id}`)}
              >
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{room.name}</p>
                    <p className="text-xs text-muted-foreground">Public room</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="py-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4" /> Join a private room
              </h3>
              <p className="text-xs text-muted-foreground">
                {privateRooms.length > 0
                  ? "Enter the code the room owner shared with you."
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

          <Card>
            <CardContent className="py-5 space-y-3">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Users className="w-4 h-4" /> Your own room
              </h3>
              <p className="text-xs text-muted-foreground">
                Make a public room anyone can join, or a private room that needs a code.
              </p>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Create a room
              </Button>
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

      <FriendsDialog open={friendsOpen} onClose={() => setFriendsOpen(false)} username={username || ""} />

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
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label>Room type</Label>
              <Select value={newRoomType} onValueChange={setNewRoomType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public — anyone can join</SelectItem>
                  <SelectItem value="private">Private — join code required</SelectItem>
                </SelectContent>
              </Select>
              {newRoomType === "private" && (
                <p className="text-xs text-muted-foreground">
                  A 6-character code will be generated — share it with the people you want in the
                  room.
                </p>
              )}
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
