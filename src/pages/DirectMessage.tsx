import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Download,
  FileText,
  Loader2,
  Lock,
  MessageSquareOff,
  Paperclip,
  Send,
  User,
  Video as VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import UserManager from "@/lib/userManagement";
import { useKickWatch } from "@/lib/kickWatch";
import CallStage from "@/components/CallStage";
import {
  filterMessage,
  settingBool,
  settingNumber,
  useAppSettings,
} from "@/lib/appSettings";
import { isPresenceOnline } from "@/lib/presence";
import { useUserPrefs } from "@/lib/userSettings";
import { playMessageChime } from "@/lib/sound";
import {
  dmPairKey,
  getActiveCallForDm,
  getCallParticipants,
  participantPresent,
  startCall,
  type CallSessionRow,
} from "@/lib/calls";
import {
  fileKind,
  formatBytes,
  getDmFiles,
  isFileApproved,
  uploadDmFile,
  validateDmFile,
  type DmFileRow,
} from "@/lib/dmFiles";
import {
  getDirectMessages,
  getProfile,
  getRelationship,
  markDirectMessagesRead,
  sendDirectMessage,
  type DirectMessageRow,
  type ProfileRow,
} from "@/lib/friends";

type TimelineItem =
  | { kind: "text"; row: DirectMessageRow }
  | { kind: "file"; row: DmFileRow };

const FileCard = ({ row, isOwn }: { row: DmFileRow; isOwn: boolean }) => {
  const kind = fileKind(row.mime_type);
  const meta = `${row.file_name} · ${formatBytes(row.file_size)}`;

  if (kind === "image") {
    return (
      <a href={row.file_path} target="_blank" rel="noreferrer" className="block max-w-[280px]">
        <img
          src={row.file_path}
          alt={row.file_name}
          className="w-full rounded-2xl border border-white/10"
          loading="lazy"
        />
        <span className={`text-[10px] text-muted-foreground mt-1 block ${isOwn ? "text-right" : ""}`}>{meta}</span>
      </a>
    );
  }

  if (kind === "video") {
    return (
      <div className="max-w-[320px]">
        <video
          src={row.file_path}
          controls
          preload="metadata"
          className="w-full rounded-2xl border border-white/10"
        />
        <a
          href={row.file_path}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 hover:underline"
        >
          <Download className="w-3 h-3" /> {meta}
        </a>
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="max-w-[320px]">
        <audio src={row.file_path} controls className="w-full" />
        <a
          href={row.file_path}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1 hover:underline"
        >
          <Download className="w-3 h-3" /> {meta}
        </a>
      </div>
    );
  }

  return (
    <a
      href={row.file_path}
      download={row.file_name}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-secondary/60 hover:bg-secondary transition-colors max-w-[320px] ${
        isOwn ? "ml-auto" : ""
      }`}
    >
      <FileText className="w-8 h-8 text-primary shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-medium truncate">{row.file_name}</span>
        <span className="block text-xs text-muted-foreground">{formatBytes(row.file_size)} · tap to open</span>
      </span>
    </a>
  );
};

/** A file still waiting on an admin — only the sender sees this. */
const PendingFileChip = ({ row }: { row: DmFileRow }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 max-w-[320px]">
    <Clock className="w-5 h-5 text-amber-400 shrink-0" />
    <span className="min-w-0">
      <span className="block text-sm font-medium truncate">{row.file_name}</span>
      <span className="block text-xs text-muted-foreground">Waiting for admin approval</span>
    </span>
  </div>
);

const DirectMessage = () => {
  const { username: rawUsername } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const target = (rawUsername || "").toLowerCase();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessageRow[]>([]);
  const [files, setFiles] = useState<DmFileRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [activeCall, setActiveCall] = useState<CallSessionRow | null>(null);
  const [call, setCall] = useState<{ callId: number; label: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { settings } = useAppSettings();
  const maxMessageLength = Math.max(50, settingNumber(settings, "max_message_length") || 2000);
  const dmsAllowed = settingBool(settings, "allow_direct_messages");
  const [targetOnline, setTargetOnline] = useState(false);
  const { prefs } = useUserPrefs(me);

  // If an admin kicks this account, sign out and go back to the login page.
  useKickWatch(me);
  const displayName = (profile?.display_name as string) || target;

  // Live online dot for the other person
  useEffect(() => {
    if (!target) return;
    const check = async () => {
      try {
        const rows = await db.query<{ last_seen: string }>("online_users", {
          username: `eq.${target}`,
        });
        setTargetOnline(rows.length > 0 && isPresenceOnline(rows[0]));
      } catch {
        // best-effort
      }
    };
    check();
    const timer = setInterval(check, 20000);
    return () => clearInterval(timer);
  }, [target]);

  // Live call status for this conversation
  useEffect(() => {
    if (!me || !target) return;
    let stopped = false;
    const check = async () => {
      try {
        const found = await getActiveCallForDm(dmPairKey(me, target));
        if (stopped) return;
        if (!found) {
          setActiveCall(null);
          return;
        }
        const parts = await getCallParticipants(found._row_id);
        setActiveCall(parts.some((p) => participantPresent(p)) ? found : null);
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
  }, [me, target]);

  const load = useCallback(async () => {
    if (!me || !target) return;
    try {
      const [rows, fileRows] = await Promise.all([
        getDirectMessages(me, target),
        getDmFiles(me, target),
      ]);
      setMessages(rows);
      setFiles(fileRows);
      await markDirectMessagesRead(me, target);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, [me, target]);

  useEffect(() => {
    const init = async () => {
      const user = await UserManager.getUsername();
      if (!user) {
        navigate("/");
        return;
      }
      if (user === target) {
        navigate("/");
        return;
      }
      setMe(user);
      const [p, rel] = await Promise.all([getProfile(target), getRelationship(user, target)]);
      setProfile(p);
      setIsFriend(rel === "friends");
      setLoading(false);
    };
    init();
  }, [target, navigate]);

  useEffect(() => {
    if (loading) return;
    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [loading, load]);

  // Auto-scroll + chime when anything new arrives
  useEffect(() => {
    const total = messages.length + files.length;
    if (total !== countRef.current) {
      const previous = countRef.current;
      countRef.current = total;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      const newest = messages[messages.length - 1];
      if (previous > 0 && prefs.sound && newest && newest.sender_username !== me) {
        playMessageChime();
      }
    }
  }, [messages, files, prefs.sound, me]);

  const handleSend = async (e?: SyntheticEvent) => {
    e?.preventDefault();
    const content = input.trim();
    if (!content || !me) return;
    setSending(true);
    try {
      await sendDirectMessage(me, target, filterMessage(content.slice(0, maxMessageLength), settings));
      setInput("");
      await load();
    } catch {
      toast({ title: "Message failed to send", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Private chats are the one place files can be shared — any type, under 500 MB.
  const handleAttach = async (file: File | undefined) => {
    if (!file || !me) return;
    const check = validateDmFile(file);
    if (!check.ok) {
      toast({ title: "Can't share that file", description: check.reason, variant: "destructive" });
      return;
    }
    setUploading({ name: file.name, pct: 0 });
    try {
      await uploadDmFile(file, me, target, (pct) => setUploading({ name: file.name, pct }));
      await load();
      toast({
        title: "File sent for review",
        description: `${file.name} shows up for ${target} once an admin approves it.`,
      });
    } catch {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleStartCall = async () => {
    if (!me) return;
    try {
      const result = await startCall({ type: "dm", target });
      if (result.ok && result.callId) {
        setCall({ callId: result.callId, label: `${displayName} — call` });
      } else {
        toast({ title: "Couldn't start the call", description: result.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Couldn't start the call", variant: "destructive" });
    }
  };

  const handleJoinCall = () => {
    if (activeCall) setCall({ callId: activeCall._row_id, label: `${displayName} — call` });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const avatarUrl = (profile?.avatar_url as string) || "";

  const timeline: TimelineItem[] = [
    ...messages.map((row) => ({ kind: "text" as const, row })),
    ...files.map((row) => ({ kind: "file" as const, row })),
  ].sort((a, b) => (a.row._created_at || 0) - (b.row._created_at || 0));

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b border-white/5 shrink-0">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <button
            className="flex items-center gap-2 min-w-0 text-left"
            onClick={() => navigate(`/profile/${target}`)}
          >
            <div className="relative">
              <Avatar className="w-8 h-8 border border-white/10">
                {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
                <AvatarFallback className="bg-primary/20 text-xs">
                  {target.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {targetOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-bold truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground">@{target}</p>
            </div>
          </button>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {isFriend && dmsAllowed && (
              <Button
                size="sm"
                variant={activeCall ? "default" : "outline"}
                className={activeCall ? "gap-1.5 bg-emerald-600 hover:bg-emerald-700" : "gap-1.5"}
                onClick={activeCall ? handleJoinCall : () => void handleStartCall()}
              >
                <VideoIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{activeCall ? "Join call" : "Call"}</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {!dmsAllowed && (
            <Card className="mb-4">
              <CardContent className="py-3 flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquareOff className="w-4 h-4 shrink-0" />
                Direct messages are turned off by the site admin right now.
              </CardContent>
            </Card>
          )}

          {!isFriend && (
            <Card className="mb-4">
              <CardContent className="py-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="w-4 h-4 shrink-0" />
                Only friends can message each other. Send a friend request from{" "}
                <button
                  className="text-primary hover:underline inline-flex items-center gap-1"
                  onClick={() => navigate(`/profile/${target}`)}
                >
                  <User className="w-3.5 h-3.5" /> {target}'s profile
                </button>
                .
              </CardContent>
            </Card>
          )}

          <div className="text-center py-6 text-muted-foreground text-xs">
            <Lock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Private conversation — every file shared here is checked by a moderator before
            the other person can see it. Any file type up to 500 MB.
          </div>

          {timeline.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No messages yet with {target}.
              {isFriend ? " Say hi!" : ""}
            </div>
          )}

          {timeline.map((item) => {
            const isOwn =
              item.kind === "text"
                ? item.row.sender_username === me
                : item.row.sender_username === me;
            return (
              <div
                key={`${item.kind}-${item.row._row_id}`}
                className={`flex ${prefs.compact ? "mb-1.5" : "mb-3"} ${isOwn ? "justify-end" : "justify-start"}`}
              >
                {item.kind === "file" ? (
                  isFileApproved(item.row.status) ? (
                    <FileCard row={item.row} isOwn={isOwn} />
                  ) : isOwn ? (
                    <PendingFileChip row={item.row} />
                  ) : null
                ) : (
                  <div className="max-w-[75%] flex flex-col">
                    <div
                      style={{ fontSize: `${prefs.font_size}px`, lineHeight: 1.45 }}
                      className={`px-4 py-2.5 rounded-2xl whitespace-pre-wrap break-words shadow-sm ${
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-secondary text-secondary-foreground rounded-bl-md"
                      }`}
                    >
                      {item.row.content}
                    </div>
                    {prefs.timestamps && (
                      <span className={`text-[10px] text-muted-foreground mt-1 ${isOwn ? "text-right" : ""}`}>
                        {new Date(item.row._created_at || Date.now()).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/5 shrink-0">
        {uploading && (
          <div className="max-w-2xl mx-auto px-4 pt-3 space-y-1.5">
            <p className="text-xs text-muted-foreground truncate">Uploading {uploading.name}…</p>
            <Progress value={uploading.pct} className="h-1.5" />
          </div>
        )}
        <form onSubmit={handleSend} className="max-w-2xl mx-auto px-4 py-3 flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => void handleAttach(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Share a file"
            title="Share a file (private chats only)"
            className="shrink-0"
            disabled={!isFriend || !dmsAllowed || Boolean(uploading)}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && prefs.enter_to_send) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              !dmsAllowed
                ? "Direct messages are off"
                : isFriend
                  ? `Message ${target}...`
                  : "Friends only can message"
            }
            disabled={!isFriend || !dmsAllowed}
            maxLength={maxMessageLength}
          />
          <Button
            type="submit"
            className="h-10 px-5 shrink-0"
            disabled={!isFriend || !dmsAllowed || sending || !input.trim()}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
            Send
          </Button>
        </form>
      </div>

      {call && me && (
        <CallStage
          callId={call.callId}
          me={me}
          label={call.label}
          onLeave={(reason) => {
            setCall(null);
            if (reason) toast({ title: reason });
          }}
        />
      )}
    </div>
  );
};

export default DirectMessage;
