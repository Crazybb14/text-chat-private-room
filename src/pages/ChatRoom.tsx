import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Copy,
  Hash,
  Loader2,
  Lock,
  Megaphone,
  MessageSquareOff,
  Mic,
  Paperclip,
  Phone,
  Radio,
  Send,
  Users,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";
import UserManager from "@/lib/userManagement";
import { useKickWatch } from "@/lib/kickWatch";
import MessageBubble, { type ChatMessage } from "@/components/MessageBubble";
import NotificationBell from "@/components/NotificationBell";
import FriendsDialog from "@/components/FriendsDialog";
import { getProfile, saveProfile } from "@/lib/friends";
import {
  filterMessage,
  RateLimiter,
  settingBool,
  settingNumber,
  settingText,
  slowModeRemaining,
  useAppSettings,
} from "@/lib/appSettings";
import {
  getRoomPresence,
  isPresenceOnline,
  usePresenceHeartbeat,
  type PresenceRow,
} from "@/lib/presence";
import CallStage from "@/components/CallStage";
import {
  getActiveCallForRoom,
  getCallParticipants,
  participantPresent,
  startCall,
  type CallSessionRow,
} from "@/lib/calls";
import { isOwnerSession } from "@/lib/owner";
import { isVoiceRoom } from "@/lib/roomTypes";
import { useUserPrefs } from "@/lib/userSettings";
import { playMessageChime } from "@/lib/sound";
import { uploadRoomFile, validateChatFile } from "@/lib/chatFiles";
import { notifyFriendsOfCall } from "@/lib/autoJoin";
import { ShellRoom, RoomSidebar, MobileSidebar, MenuButton, DC, Avatar } from "@/components/DiscordShell";
import BanScreen from "@/components/BanScreen";
import { checkBanStatus, moderateMessage, type BanStatus } from "@/lib/moderation";

interface RoomRow {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
  is_voice?: number | null;
  [key: string]: unknown;
}

type Phase = "loading" | "banned" | "gate" | "ready" | "notfound";

const TYPING_WINDOW_MS = 8 * 1000;

const ChatRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const navVoice = (useLocation().state as { voice?: boolean } | null)?.voice === true;
  const { toast } = useToast();
  const { settings } = useAppSettings();

  const [phase, setPhase] = useState<Phase>("loading");
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [allRooms, setAllRooms] = useState<RoomRow[]>([]);
  const [roomsDrawer, setRoomsDrawer] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  // If an admin kicks this account, sign out and go back to the login page.
  useKickWatch(username);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeChecking, setCodeChecking] = useState(false);
  const [presenceRows, setPresenceRows] = useState<PresenceRow[]>([]);
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
  const [activeCall, setActiveCall] = useState<CallSessionRow | null>(null);
  const [callCount, setCallCount] = useState(0);
  const [call, setCall] = useState<{ callId: number; label: string } | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [banInfo, setBanInfo] = useState<BanStatus | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCountRef = useRef(0);
  const typingRowRef = useRef<number | null>(null);
  const typingSentAtRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const lastSentTextRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxMessageLength = Math.max(50, settingNumber(settings, "max_message_length") || 2000);
  const slowModeSeconds = settingNumber(settings, "slow_mode_seconds");
  const typingOn = settingBool(settings, "typing_indicators");
  const showOnline = settingBool(settings, "show_online_status");
  const announcement = settingText(settings, "announcement");
  const autoDeleteHours = settingNumber(settings, "auto_delete_hours");

  // Personal preferences (text size, sounds, timestamps, enter-to-send)
  const { prefs } = useUserPrefs(username);

  const rateLimiter = useMemo(
    () => new RateLimiter(settingNumber(settings, "message_rate_per_minute") || 30),
    [settings]
  );

  // Fresh heartbeat the whole time the user is in the room
  usePresenceHeartbeat(username, roomId ? Number(roomId) : null);

  // Re-render once a second so slow-mode countdowns stay accurate
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const loadPresence = useCallback(async () => {
    if (!roomId) return;
    setPresenceRows(await getRoomPresence(Number(roomId)));
  }, [roomId]);

  const onlineNames = useMemo(() => {
    const now = Date.now();
    const names: string[] = [];
    for (const row of presenceRows) {
      if (isPresenceOnline(row, now) && !names.includes(row.username)) names.push(row.username);
    }
    return names;
  }, [presenceRows, tick]);

  const loadTyping = useCallback(async () => {
    if (!roomId || !username || !typingOn) return;
    try {
      const rows = await db.query<{ username: string; draft: string; updated_at: number }>(
        "typing_status",
        { room_id: `eq.${roomId}` }
      );
      const cutoff = Date.now() - TYPING_WINDOW_MS;
      setTypingNames(
        rows
          .filter((r) => r.username !== username && r.draft && Number(r.updated_at) >= cutoff)
          .map((r) => r.username)
      );
    } catch {
      // best-effort
    }
  }, [roomId, username, typingOn]);

  /** Shares what the user is currently typing (throttled) so admins can watch live. */
  const syncTyping = useCallback(
    async (draft: string, force = false) => {
      if (!roomId || !username || !typingOn) return;
      const now = Date.now();
      if (!force && now - typingSentAtRef.current < 1500) return;
      typingSentAtRef.current = now;
      try {
        const payload = { draft: draft.slice(0, 300), updated_at: Date.now() };
        if (typingRowRef.current !== null) {
          await db.update("typing_status", { _row_id: `eq.${typingRowRef.current}` }, payload);
        } else {
          const existing = await db.query<{ _row_id: number }>("typing_status", {
            room_id: `eq.${roomId}`,
            username: `eq.${username}`,
          });
          if (existing.length > 0) {
            typingRowRef.current = existing[0]._row_id;
            await db.update("typing_status", { _row_id: `eq.${existing[0]._row_id}` }, payload);
          } else {
            const row = await db.insert<{ _row_id: number }>("typing_status", {
              room_id: Number(roomId),
              username,
              ...payload,
            });
            typingRowRef.current = row._row_id;
          }
        }
      } catch {
        // best-effort
      }
    },
    [roomId, username, typingOn]
  );

  // Initial load
  useEffect(() => {
    const init = async () => {
      if (!roomId) {
        setPhase("notfound");
        return;
      }
      try {
        const currentSession = await UserManager.getSession();
        if (!currentSession) {
          navigate("/login", { replace: true });
          return;
        }
        if (!currentSession.username) {
          navigate("/", { replace: true });
          return;
        }
        setUsername(currentSession.username);
        setSessionEmail(currentSession.email ?? null);
        setIsOwner(isOwnerSession(currentSession));

        const banStatus = await checkBanStatus(currentSession.username, currentSession.email);
        if (banStatus.banned) {
          setBanInfo(banStatus);
          setPhase("banned");
          return;
        }

        const roomRows = await db.query<RoomRow>("rooms", { order: "_row_id.asc" });
        const found = roomRows.find((r) => String(r._row_id) === String(roomId)) ?? null;
        if (!found) {
          setPhase("notfound");
          return;
        }
        setRoom(found);
        setAllRooms(roomRows);
        saveProfile(currentSession.username, { status: "online" }).catch(() => undefined);

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

  // Polling: messages + presence + typing
  useEffect(() => {
    if (phase !== "ready") return;
    loadMessages();
    loadPresence();
    loadTyping();
    const messageTimer = setInterval(loadMessages, 2000);
    const typingTimer = setInterval(loadTyping, 2000);
    const presenceTimer = setInterval(loadPresence, 20000);
    return () => {
      clearInterval(messageTimer);
      clearInterval(typingTimer);
      clearInterval(presenceTimer);
      syncTyping("", true);
    };
  }, [phase, loadMessages, loadPresence, loadTyping, syncTyping]);

  // Auto-scroll + chime when new messages arrive
  useEffect(() => {
    if (messages.length !== messageCountRef.current) {
      const previous = messageCountRef.current;
      messageCountRef.current = messages.length;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      const newest = messages[messages.length - 1];
      if (previous > 0 && prefs.sound && newest && newest.sender_name !== username) {
        playMessageChime();
      }
    }
  }, [messages, prefs.sound, username]);

  // Live call status for this room
  useEffect(() => {
    if (phase !== "ready" || !roomId) return;
    let stopped = false;
    const check = async () => {
      try {
        const found = await getActiveCallForRoom(Number(roomId));
        if (stopped) return;
        if (!found) {
          setActiveCall(null);
          return;
        }
        const parts = await getCallParticipants(found._row_id);
        const present = parts.filter((p) => participantPresent(p));
        setActiveCall(present.length > 0 ? found : null);
        setCallCount(present.length);
      } catch {
        // best-effort
      }
    };
    void check();
    const timer = setInterval(check, 5000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [phase, roomId]);

  const handleGateSubmit = async (e: SyntheticEvent) => {
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

  const handleSend = async (e?: SyntheticEvent) => {
    e?.preventDefault();
    const content = input.trim();
    if (!content || !roomId || !username) return;

    const slowLeft = slowModeRemaining(lastSentAtRef.current, slowModeSeconds);
    if (slowLeft > 0) {
      toast({
        title: "Slow mode is on",
        description: `Wait ${Math.ceil(slowLeft / 1000)}s before sending again.`,
        variant: "destructive",
      });
      return;
    }
    if (!rateLimiter.allow()) {
      toast({
        title: "You're sending too fast",
        description: "Give it a few seconds.",
        variant: "destructive",
      });
      return;
    }

    // Local rule checks from the admin's site settings
    const capsLimit = settingNumber(settings, "caps_ratio_percent");
    const letters = content.replace(/[^a-zA-Z]/g, "");
    if (capsLimit > 0 && letters.length >= 10) {
      const capsRatio = (letters.replace(/[^A-Z]/g, "").length / letters.length) * 100;
      if (capsRatio > capsLimit) {
        toast({
          title: "Too much shouting",
          description: `Keep it under ${capsLimit}% capital letters.`,
          variant: "destructive",
        });
        return;
      }
    }
    const emojiLimit = settingNumber(settings, "max_emoji_per_message");
    if (emojiLimit > 0) {
      const emojiCount = (content.match(/\p{Extended_Pictographic}/gu) ?? []).length;
      if (emojiCount > emojiLimit) {
        toast({
          title: "That's a lot of emoji",
          description: `Max ${emojiLimit} per message.`,
          variant: "destructive",
        });
        return;
      }
    }
    if (settingBool(settings, "block_links") && /\b(?:https?:\/\/|www\.)\S+/i.test(content)) {
      toast({
        title: "Links are turned off",
        description: "Posting links isn't allowed here.",
        variant: "destructive",
      });
      return;
    }
    if (settingBool(settings, "block_duplicate_messages") && content === lastSentTextRef.current) {
      toast({
        title: "You already sent that",
        description: "Try saying something new.",
        variant: "destructive",
      });
      return;
    }

    // Server-side moderation: severity tiers, escalating bans, device bans
    const verdict = await moderateMessage({
      username,
      email: sessionEmail,
      roomId: Number(roomId),
      text: content,
    });
    if (verdict.action === "banned") {
      setBanInfo({
        banned: true,
        permanent: verdict.permanent === true,
        untilMs: verdict.untilMs ?? null,
        reason: verdict.reason ?? null,
        evasion: false,
      });
      setPhase("banned");
      return;
    }
    if (verdict.action === "warned") {
      toast({
        title: "Watch your language",
        description: verdict.message ?? "That word isn't allowed.",
        variant: "destructive",
      });
      setInput("");
      syncTyping("", true);
      return;
    }

    setSending(true);
    try {
      await db.insert("messages", {
        room_id: Number(roomId),
        sender_name: username,
        content: filterMessage(content.slice(0, maxMessageLength), settings),
        device_id: getDeviceId(),
        is_ai: 0,
      });
      lastSentAtRef.current = Date.now();
      lastSentTextRef.current = content;
      rateLimiter.record();
      setInput("");
      syncTyping("", true);
      await loadMessages();
    } catch {
      toast({ title: "Message failed to send", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  /** Shares a file straight into the room's message feed. */
  const handleFilePicked = async (file: File | undefined) => {
    if (!file || !roomId || !username) return;
    const check = validateChatFile(file);
    if (!check.ok) {
      toast({ title: "Can't send that file", description: check.reason, variant: "destructive" });
      return;
    }
    setUploadPct(0);
    try {
      await uploadRoomFile(Number(roomId), file, username, (pct) => setUploadPct(pct));
      syncTyping("", true);
      await loadMessages();
      toast({
        title: "File sent for review",
        description: `${file.name} becomes visible to everyone once an admin approves it.`,
      });
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploadPct(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleStartCall = async () => {
    if (!roomId) return;
    const type = room?.type === "private" ? "private-room" : "public-room";
    try {
      const result = await startCall({ type, roomId: Number(roomId) });
      if (result.ok && result.callId) {
        setCall({ callId: result.callId, label: `${room?.name ?? "Room"} — call` });
        // Friends who opted into call alerts hear about it right away
        if (username) {
          void notifyFriendsOfCall(username, room?.name ?? "a room", Number(roomId));
        }
      } else {
        toast({ title: "Couldn't start the call", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Couldn't start the call", variant: "destructive" });
    }
  };

  const handleJoinCall = () => {
    if (!activeCall) return;
    setCall({ callId: activeCall._row_id, label: `${room?.name ?? "Room"} — call` });
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
      />
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

  const slowLeft = slowModeRemaining(lastSentAtRef.current, slowModeSeconds);
  const charsLeft = maxMessageLength - input.length;
  // Voice rooms are call-first. The flag comes from the room row, but the
  // lobby also passes it through navigation (and remembers it) so a lookup
  // that drops the column still renders the room correctly.
  const knownVoiceIds = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("voice_room_ids") ?? "[]") as number[];
    } catch {
      return [];
    }
  })();
  const isVoice =
    isVoiceRoom(room) ||
    navVoice ||
    (room !== null && knownVoiceIds.includes(Number(room._row_id)));

  const sidebarRooms = allRooms.map((r) => ({
    id: Number(r._row_id),
    name: r.name,
    is_private: r.type === "private" ? 1 : 0,
    is_voice: isVoiceRoom(r) ? 1 : 0,
  }));
  const sidebarProps = {
    siteName: settingText(settings, "site_name") || "ChatRooms",
    rooms: sidebarRooms,
    activeRoomId: roomId ? Number(roomId) : null,
    username,
    canCreateRooms: isOwner || settingBool(settings, "allow_room_creation"),
    isStaff: true,
    onOpenRoom: (r: ShellRoom) =>
      navigate(`/chat/${r.id}`, { state: { voice: Boolean(r.is_voice) } }),
    onHome: () => navigate("/"),
    onCreateRoom: () => navigate("/", { state: { openCreate: true } }),
    onDirectMessages: () => setFriendsOpen(true),
    onFriends: () => setFriendsOpen(true),
    onSettings: () => navigate("/settings"),
    onLogout: () => {
      void UserManager.signOut().then(() => navigate("/login"));
    },
    onAdmin: () => navigate("/admin"),
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#313338] text-[#dbdee1]">
      <aside className="hidden w-60 shrink-0 md:flex">
        <RoomSidebar {...sidebarProps} />
      </aside>
      <MobileSidebar open={roomsDrawer} onClose={() => setRoomsDrawer(false)}>
        <RoomSidebar
          {...sidebarProps}
          onOpenRoom={(r) => {
            setRoomsDrawer(false);
            navigate(`/chat/${r.id}`, { state: { voice: Boolean(r.is_voice) } });
          }}
        />
      </MobileSidebar>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 px-3 shadow-[0_1px_0_rgba(0,0,0,0.25)] md:px-4">
          <MenuButton onClick={() => setRoomsDrawer(true)} />
          {isVoice ? (
            <Volume2 className="h-6 w-6 shrink-0 text-[#80848e]" aria-hidden />
          ) : (
            <Hash className="h-6 w-6 shrink-0 text-[#80848e]" aria-hidden />
          )}
          <h1 className="truncate text-[15px] font-bold text-[#f2f3f5]">{room.name}</h1>
          {room.type === "private" ? (
            <Badge variant="outline" className="ml-1 hidden gap-1 border-white/10 bg-white/5 text-[#b5bac1] sm:inline-flex">
              <Lock className="h-3 w-3" aria-hidden /> Private
            </Badge>
          ) : null}
          {room.type === "private" && room.code ? (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(room.code ?? "");
                toast({ title: "Room code copied" });
              }}
              className="hidden items-center gap-1.5 rounded-md bg-black/30 px-2 py-1 font-mono text-xs text-[#b5bac1] hover:bg-black/40 sm:flex"
              title="Copy room code"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {room.code}
            </button>
          ) : null}
          <span className="mx-2 hidden h-6 w-px shrink-0 bg-white/10 sm:block" aria-hidden />
          {typingNames.length > 0 ? (
            <span className="hidden min-w-0 items-center gap-1.5 text-sm text-[#b5bac1] sm:flex">
              <Clock className="h-4 w-4 shrink-0 text-[#80848e]" aria-hidden />
              <span className="truncate italic">
                {typingNames.slice(0, 2).join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
              </span>
            </span>
          ) : showOnline ? (
            <span className="hidden items-center gap-1.5 text-sm text-[#b5bac1] sm:flex">
              <Users className="h-4 w-4 shrink-0 text-[#80848e]" aria-hidden />
              {onlineNames.length} {onlineNames.length === 1 ? "person" : "people"} here
            </span>
          ) : null}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {!isVoice ? (
              <button
                type="button"
                onClick={activeCall ? handleJoinCall : () => void handleStartCall()}
                className="hidden items-center gap-1.5 rounded bg-transparent px-2 py-1.5 text-sm font-medium text-[#b5bac1] hover:bg-[#35373c] hover:text-white sm:flex"
              >
                <Phone className="h-4 w-4" aria-hidden />
                {call ? "Leave call" : activeCall ? `Join call (${callCount})` : "Start call"}
              </button>
            ) : null}
            <NotificationBell username={username ?? ""} />
            <button
              type="button"
              onClick={() => setFriendsOpen(true)}
              className="rounded p-2 text-[#b5bac1] hover:bg-[#35373c] hover:text-white"
              aria-label="Friends and direct messages"
              title="Friends & DMs"
            >
              <Users className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </header>

        {announcement ? (
          <div className="shrink-0 border-b border-black/30 bg-[#5865f2]/15 px-4 py-2 text-center text-sm text-[#dbdee1]">
            <span className="inline-flex items-center gap-2">
              <Megaphone className="h-4 w-4 shrink-0 text-[#7983f5]" aria-hidden />
              {announcement}
            </span>
          </div>
        ) : null}

        {isVoice ? (
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-4xl space-y-5">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-6 text-center">
                <Radio className="mx-auto h-8 w-8 text-emerald-400" aria-hidden />
                <h2 className="mt-2 text-lg font-semibold text-emerald-300">{room.name}</h2>
                {call ? (
                  <p className="mt-1 text-sm text-emerald-200/80">You're connected. Talk away!</p>
                ) : activeCall ? (
                  <>
                    <p className="mt-1 text-sm text-emerald-200/80">
                      {callCount} {callCount === 1 ? "person is" : "people are"} talking right now.
                    </p>
                    <button
                      type="button"
                      onClick={handleJoinCall}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
                    >
                      <Phone className="h-4 w-4" aria-hidden /> Join the call
                    </button>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-emerald-200/80">Nobody is talking yet — start the call and say hi.</p>
                    <button
                      type="button"
                      onClick={() => void handleStartCall()}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
                    >
                      <Mic className="h-4 w-4" aria-hidden /> Start talking
                    </button>
                  </>
                )}
              </div>

              <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#949ba4]">
                <Users className="h-4 w-4" aria-hidden /> In this room
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {onlineNames.length === 0 ? (
                  <p className="col-span-full text-sm text-[#949ba4]">Nobody else is here yet.</p>
                ) : (
                  onlineNames.map((name) => (
                    <div key={name} className="flex items-center gap-2.5 rounded-lg bg-[#2b2d31] px-3 py-2">
                      <Avatar name={name} size={32} />
                      <span className="truncate text-sm font-medium text-[#dbdee1]">{name}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-[#2b2d31] px-5 py-6 text-center">
                <MessageSquareOff className="mx-auto h-7 w-7 text-[#80848e]" aria-hidden />
                <p className="mt-2 text-sm font-semibold text-[#f2f3f5]">Voice-only room — no text chat</p>
                <p className="mt-1 text-sm text-[#949ba4]">
                  This room is for talking. Use a text room or a direct message to type.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-4xl px-4 pb-4 pt-2">
                {messages.length === 0 ? (
                  <div className="py-12 text-center">
                    <Hash className="mx-auto h-12 w-12 text-[#4e5058]" aria-hidden />
                    <h2 className="mt-4 text-2xl font-bold text-[#f2f3f5]">Welcome to #{room.name}</h2>
                    <p className="mt-1 text-sm text-[#949ba4]">This is the very beginning of this room. Say something!</p>
                    {autoDeleteHours > 0 ? (
                      <p className="mt-2 text-xs text-[#80848e]">
                        Messages here are cleared automatically every {autoDeleteHours} hours.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  messages.map((message, i) => {
                    const prev = messages[i - 1];
                    const grouped = Boolean(
                      prev &&
                        prev.sender_name === message.sender_name &&
                        !prev.file_path &&
                        !message.file_path &&
                        Math.abs(Number(message._created_at) - Number(prev._created_at)) < 300,
                    );
                    return (
                      <MessageBubble
                        key={String(message._row_id)}
                        message={message}
                        isOwn={message.sender_name === username}
                        currentUsername={username ?? ""}
                        avatarUrl={avatars[message.sender_name]}
                        fontSize={prefs.font_size}
                        showTimestamp={prefs.timestamps}
                        compact={prefs.compact}
                        grouped={grouped}
                      />
                    );
                  })
                )}
              </div>
            </div>

            <div className="shrink-0 px-4 pb-5">
              <form
                onSubmit={(e) => {
                  void handleSend(e);
                }}
                className="flex items-end gap-3 rounded-xl bg-[#383a40] px-4 py-2.5"
              >
                {settingBool(settings, "public_room_file_sharing") && slowLeft <= 0 ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    title="Attach a file (an admin approves it before others can see it)"
                    aria-label="Attach a file"
                    className="shrink-0 rounded-full p-1.5 text-[#b5bac1] hover:bg-[#4e5058] hover:text-white disabled:opacity-40"
                  >
                    <Paperclip className="h-5 w-5" aria-hidden />
                  </button>
                ) : null}
                <input
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    syncTyping(e.target.value);
                  }}
                  onBlur={() => syncTyping("", true)}
                  placeholder={slowLeft > 0 ? `Slow mode — wait ${slowLeft}s` : `Message #${room.name}`}
                  className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] text-[#dbdee1] outline-none placeholder:text-[#6d6f78]"
                  maxLength={2000}
                  disabled={sending}
                  aria-label="Message"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="shrink-0 rounded-full p-1.5 text-[#b5bac1] hover:bg-[#4e5058] hover:text-white disabled:opacity-30"
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-5 w-5" aria-hidden />
                  )}
                </button>
              </form>
              <div className="mt-1.5 flex items-center gap-3 px-1 text-[11px] text-[#949ba4]">
                {charsLeft !== null && charsLeft < 100 ? <span>{charsLeft} characters left</span> : null}
                {slowLeft > 0 ? <span className="text-[#faa61a]">Slow mode: {slowLeft}s</span> : null}
                {typingNames.length > 0 ? (
                  <span className="sm:hidden">
                    {typingNames.slice(0, 2).join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
                  </span>
                ) : null}
                <span className="ml-auto hidden sm:block">Press Enter to send</span>
              </div>
              {uploadPct !== null ? (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/30">
                  <div className="h-full rounded-full bg-[#5865f2] transition-all" style={{ width: `${uploadPct}%` }} />
                </div>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFilePicked(file);
              }}
              aria-hidden
              tabIndex={-1}
            />
          </>
        )}
      </main>

      {showOnline && !isVoice ? (
        <aside className="hidden w-60 shrink-0 flex-col bg-[#2b2d31] lg:flex">
          <h2 className="px-4 pb-2 pt-4 text-[11px] font-bold uppercase tracking-wide text-[#949ba4]">
            In this room — {onlineNames.length}
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {onlineNames.map((name) => (
              <div key={name} className={`flex items-center gap-2.5 rounded px-2 py-1.5 ${DC.hover}`}>
                <Avatar name={name} size={32} />
                <span className="truncate text-[15px] font-medium text-[#949ba4]">{name}</span>
                {name === username ? (
                  <span className="ml-auto shrink-0 text-[10px] font-bold uppercase text-[#23a559]">you</span>
                ) : null}
              </div>
            ))}
          </div>
        </aside>
      ) : null}

      {call && username ? (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setCall(null);
          }}
        >
          <DialogContent className="max-w-3xl border-white/10 bg-[#2b2d31] text-[#dbdee1]">
            <CallStage
              callId={call.callId}
              me={username}
              label={call.label}
              onLeave={() => setCall(null)}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={friendsOpen} onOpenChange={setFriendsOpen}>
        <DialogContent className="max-w-md">
          <FriendsDialog
            currentUsername={username}
            onOpenDirectMessage={(targetUsername) => navigate(`/dm/${targetUsername}`)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatRoom;
