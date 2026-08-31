import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Ban as BanIcon,
  Loader2,
  Lock,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";
import UserManager from "@/lib/userManagement";
import MessageBubble, { type ChatMessage } from "@/components/MessageBubble";
import NotificationBell from "@/components/NotificationBell";
import FriendsDialog from "@/components/FriendsDialog";
import { getProfile, saveProfile } from "@/lib/friends";

interface RoomRow {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
  [key: string]: unknown;
}

interface OnlineUserRow {
  _row_id: number;
  username: string;
  device_id: string;
  room_id: number | null;
  last_seen: string;
  [key: string]: unknown;
}

type Phase = "loading" | "banned" | "gate" | "ready" | "notfound";

const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

const ChatRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("loading");
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeChecking, setCodeChecking] = useState(false);
  const [onlineNames, setOnlineNames] = useState<string[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [friendsOpen, setFriendsOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);

  const loadMessages = useCallback(async () => {
    if (!roomId) return;
    try {
      const rows = await db.query<ChatMessage>("messages", {
        room_id: `eq.${roomId}`,
        order: "_created_at.desc",
      });
      const latest = rows.slice(0, 200).reverse();
      setMessages(latest);

      const senders = [...new Set(latest.map((m) => m.sender_name))];
      if (senders.length > 0) {
        const profiles = await Promise.all(senders.map((s) => getProfile(s)));
        const map: Record<string, string> = {};
        senders.forEach((s, i) => {
          if (profiles[i]?.avatar_url) map[s] = profiles[i]!.avatar_url as string;
        });
        setAvatars(map);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, [roomId]);

  const updatePresence = useCallback(async () => {
    if (!roomId || !username) return;
    try {
      const deviceId = getDeviceId();
      const rows = await db.query<OnlineUserRow>("online_users", {
        device_id: `eq.${deviceId}`,
      });
      if (rows.length > 0) {
        await db.update(
          "online_users",
          { device_id: `eq.${deviceId}` },
          { username, room_id: Number(roomId), last_seen: new Date().toISOString() }
        );
      } else {
        await db.insert("online_users", {
          username,
          device_id: deviceId,
          room_id: Number(roomId),
          last_seen: new Date().toISOString(),
        });
      }
    } catch {
      // presence is best-effort
    }
  }, [roomId, username]);

  const loadOnline = useCallback(async () => {
    if (!roomId) return;
    try {
      const rows = await db.query<OnlineUserRow>("online_users", {
        room_id: `eq.${roomId}`,
      });
      const cutoff = Date.now() - PRESENCE_WINDOW_MS;
      const names: string[] = [];
      for (const row of rows) {
        const seen = new Date(row.last_seen.replace(" ", "T")).getTime();
        if (!Number.isNaN(seen) && seen >= cutoff && !names.includes(row.username)) {
          names.push(row.username);
        }
      }
      setOnlineNames(names);
    } catch {
      // best-effort
    }
  }, [roomId]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      if (!roomId) {
        setPhase("notfound");
        return;
      }
      const deviceId = getDeviceId();
      try {
        const bans = await db.query("bans", { device_id: `eq.${deviceId}` });
        if (bans.length > 0) {
          setPhase("banned");
          return;
        }
        const found = await db.get<RoomRow>("rooms", roomId);
        if (!found) {
          setPhase("notfound");
          return;
        }
        setRoom(found);
        const user = await UserManager.getUsername();
        if (!user) {
          navigate("/");
          return;
        }
        setUsername(user);
        saveProfile(user, { status: "online" }).catch(() => undefined);

        if (found.type === "private" && sessionStorage.getItem(`room_unlocked_${roomId}`) !== "1") {
          setPhase("gate");
          return;
        }
        setPhase("ready");
      } catch (error) {
        console.error("Room load failed:", error);
        setPhase("notfound");
      }
    };
    init();
  }, [roomId, navigate]);

  // Polling: messages + presence
  useEffect(() => {
    if (phase !== "ready") return;
    loadMessages();
    loadOnline();
    updatePresence();
    const messageTimer = setInterval(loadMessages, 2000);
    const presenceTimer = setInterval(updatePresence, 15000);
    const onlineTimer = setInterval(loadOnline, 20000);
    return () => {
      clearInterval(messageTimer);
      clearInterval(presenceTimer);
      clearInterval(onlineTimer);
    };
  }, [phase, loadMessages, loadOnline, updatePresence]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (messages.length !== messageCountRef.current) {
      messageCountRef.current = messages.length;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleGateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!roomId || !codeInput.trim()) return;
    setCodeChecking(true);
    try {
      const rows = await db.query<RoomRow>("rooms", {
        _row_id: `eq.${roomId}`,
        code: `eq.${codeInput.trim().toUpperCase()}`,
      });
      if (rows.length > 0) {
        sessionStorage.setItem(`room_unlocked_${roomId}`, "1");
        setPhase("ready");
      } else {
        toast({ title: "Wrong code", description: "That code doesn't match this room.", variant: "destructive" });
      }
    } finally {
      setCodeChecking(false);
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !roomId || !username) return;
    setSending(true);
    try {
      await db.insert("messages", {
        room_id: Number(roomId),
        sender_name: username,
        content: content.slice(0, 2000),
        device_id: getDeviceId(),
        is_ai: 0,
      });
      setInput("");
      await loadMessages();
    } catch {
      toast({ title: "Message failed to send", variant: "destructive" });
    } finally {
      setSending(false);
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
          <p className="text-white/70">This device has been banned from ChatRooms.</p>
          <Button variant="destructive" onClick={() => navigate("/appeal")}>
            Submit an appeal
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "notfound" || !room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Room not found</h1>
          <p className="text-muted-foreground">This room may have been deleted.</p>
          <Button onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to rooms
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "gate") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="py-8 space-y-5 text-center">
            <Lock className="w-12 h-12 text-primary mx-auto" />
            <div>
              <h1 className="text-xl font-bold">{room.name}</h1>
              <p className="text-sm text-muted-foreground">This is a private room. Enter the code to join.</p>
            </div>
            <form onSubmit={handleGateSubmit} className="space-y-3">
              <div className="space-y-2 text-left">
                <Label htmlFor="room-code">Room code</Label>
                <Input
                  id="room-code"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="6-character code"
                  className="text-center font-mono tracking-widest uppercase"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={codeChecking || !codeInput.trim()}>
                {codeChecking ? "Checking..." : "Join room"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b border-white/5 shrink-0">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} title="Back to rooms">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold truncate">{room.name}</h1>
                {room.type === "private" && (
                  <Badge variant="secondary" className="gap-1 shrink-0">
                    <Lock className="w-3 h-3" /> Private
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {onlineNames.length} online
                {onlineNames.length > 0 && username ? ` — ${onlineNames.join(", ")}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell username={username || ""} />
            <Button variant="ghost" size="icon" title="Friends" onClick={() => setFriendsOpen(true)}>
              <Users className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              No messages yet. Say hi!
            </div>
          )}
          {messages.map((message) => (
            <MessageBubble
              key={message._row_id}
              message={message}
              isOwn={message.sender_name === username}
              currentUsername={username || ""}
              avatarUrl={avatars[message.sender_name]}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-white/5 shrink-0">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto px-4 py-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${room.name}...`}
            maxLength={2000}
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>

      <FriendsDialog open={friendsOpen} onClose={() => setFriendsOpen(false)} username={username || ""} />
    </div>
  );
};

export default ChatRoom;
