import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Copy,
  Loader2,
  Lock,
  Megaphone,
  Mic,
  Paperclip,
  Phone,
  Radio,
  Send,
  Users,
  Video as VideoIcon,
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
  const [username, setUsername] = useState<string | null>(null);
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
  let roomHue = 0;
  for (let i = 0; i < room.name.length; i++) roomHue = (roomHue * 31 + room.name.charCodeAt(i)) % 360;

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b border-white/5 shrink-0">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" aria-label="Back to rooms" onClick={() => navigate("/")} title="Back to rooms">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white font-bold"
              style={{
                background: `linear-gradient(135deg, hsl(${roomHue} 60% 42%), hsl(${(roomHue + 45) % 360} 60% 34%))`,
              }}
            >
              {isVoice ? <Radio className="w-5 h-5" /> : room.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold truncate">{room.name}</h1>
                {room.type === "private" && (
                  <Badge variant="secondary" className="gap-1 shrink-0">
                    <Lock className="w-3 h-3" /> Private
                  </Badge>
                )}
                {room.type === "private" && room.code && (
                  <button
                    type="button"
                    className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary/70 hover:bg-secondary flex items-center gap-1 shrink-0"
                    title="Click to copy this room's join code"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(room.code ?? "")
                        .then(() =>
                          toast({
                            title: "Room code copied",
                            description: `${room.code} — share it to let people into ${room.name}.`,
                          })
                        )
                        .catch(() => toast({ title: "Room code", description: room.code ?? "" }));
                    }}
                  >
                    <Copy className="w-3 h-3" /> {room.code}
                  </button>
                )}
                {isVoice && (
                  <Badge variant="secondary" className="gap-1 shrink-0">
                    <Radio className="w-3 h-3" /> Voice
                  </Badge>
                )}
              </div>
              {showOnline && (
                <p className="text-xs text-muted-foreground truncate">
                  {onlineNames.length} online
                  {onlineNames.length > 0 && username ? ` — ${onlineNames.join(", ")}` : ""}
                </p>
              )}
              {typingOn && typingNames.length > 0 && (
                <p className="text-xs text-primary/80 truncate flex items-center gap-1">
                  <span className="inline-flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:0.3s]" />
                  </span>
                  {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(room.type === "private" || isOwner || activeCall || isVoice) && (
              <Button
                size="sm"
                variant={activeCall ? "default" : "outline"}
                className={activeCall ? "gap-1.5 bg-emerald-600 hover:bg-emerald-700" : "gap-1.5"}
                onClick={activeCall ? handleJoinCall : () => void handleStartCall()}
              >
                <VideoIcon className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {activeCall ? `Join call (${callCount})` : isVoice ? "Join voice" : "Start call"}
                </span>
              </Button>
            )}
            <NotificationBell username={username || ""} />
            <Button variant="ghost" size="icon" aria-label="Friends" title="Friends" onClick={() => setFriendsOpen(true)}>
              <Users className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {announcement && (
        <div className="shrink-0 border-b border-primary/20 bg-primary/5">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-start gap-2">
            <Megaphone className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs break-words">{announcement}</p>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {isVoice && !call && (
            <Card className="mb-4 border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="py-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <Mic className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold">This is a voice room</p>
                    <p className="text-xs text-muted-foreground">
                      {activeCall
                        ? `${callCount} in the call right now — jump in and talk.`
                        : "Nobody is talking yet — start the call and say hi. Text chat works here too."}
                    </p>
                  </div>
                </div>
                <Button
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 shrink-0"
                  onClick={activeCall ? handleJoinCall : () => void handleStartCall()}
                >
                  <Phone className="w-4 h-4" />
                  {activeCall ? `Join the call (${callCount})` : "Start the call"}
                </Button>
              </CardContent>
            </Card>
          )}
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
              fontSize={prefs.font_size}
              showTimestamp={prefs.timestamps}
              compact={prefs.compact}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-white/5 shrink-0">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto px-4 pt-3 pb-2 flex gap-2">
          <div className="flex-1 min-w-0 space-y-1">
            <Input
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                syncTyping(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && prefs.enter_to_send) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={slowLeft > 0 ? `Slow mode — wait ${Math.ceil(slowLeft / 1000)}s…` : `Message ${room.name}...`}
              maxLength={maxMessageLength}
              disabled={slowLeft > 0}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {charsLeft <= 100 && `${charsLeft} characters left`}
                {autoDeleteHours > 0 && (
                  <span className="inline-flex items-center gap-1">
                    {charsLeft <= 100 && " · "}
                    <Clock className="w-3 h-3" /> auto-clears after {autoDeleteHours}h
                  </span>
                )}
              </span>
              <span>{prefs.enter_to_send ? "Enter to send" : "Send with the button"}</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => void handleFilePicked(e.target.files?.[0])}
          />
          {settingBool(settings, "public_room_file_sharing") && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 self-start mt-0.5"
              aria-label="Send a file"
              title="Send a file"
              disabled={uploadPct !== null}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadPct !== null ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            type="submit"
            className="h-10 self-start mt-0.5 px-5"
            disabled={sending || !input.trim() || slowLeft > 0}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
            Send
          </Button>
        </form>
        {uploadPct !== null && (
          <div className="max-w-4xl mx-auto px-4 pb-3">
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.max(2, uploadPct))}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Uploading… {Math.round(uploadPct)}%</p>
          </div>
        )}
      </div>

      {call && username && (
        <CallStage
          callId={call.callId}
          me={username}
          label={call.label}
          onLeave={(reason) => {
            setCall(null);
            if (reason) toast({ title: reason });
          }}
        />
      )}

      <Dialog open={friendsOpen} onOpenChange={setFriendsOpen}>
        <DialogContent className="max-w-md">
          <FriendsDialog currentUsername={username || null} onOpenDirectMessage={(targetUsername) => navigate(`/dm/${targetUsername}`)} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatRoom;
