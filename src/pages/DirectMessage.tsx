import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Lock, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import UserManager from "@/lib/userManagement";
import {
  getDirectMessages,
  getProfile,
  getRelationship,
  markDirectMessagesRead,
  sendDirectMessage,
  type DirectMessageRow,
  type ProfileRow,
} from "@/lib/friends";

const DirectMessage = () => {
  const { username: rawUsername } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const target = (rawUsername || "").toLowerCase();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessageRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(0);

  const load = useCallback(async () => {
    if (!me || !target) return;
    try {
      const rows = await getDirectMessages(me, target);
      setMessages(rows);
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

  useEffect(() => {
    if (messages.length !== countRef.current) {
      countRef.current = messages.length;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !me) return;
    setSending(true);
    try {
      await sendDirectMessage(me, target, content.slice(0, 2000));
      setInput("");
      await load();
    } catch {
      toast({ title: "Message failed to send", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayName = (profile?.display_name as string) || target;
  const avatarUrl = (profile?.avatar_url as string) || "";

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
            <Avatar className="w-8 h-8 border border-white/10">
              {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
              <AvatarFallback className="bg-primary/20 text-xs">
                {target.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-bold truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground">@{target}</p>
            </div>
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4">
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

          {messages.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No messages yet with {target}.
              {isFriend ? " Say hi!" : ""}
            </div>
          )}

          {messages.map((message) => {
            const isOwn = message.sender_username === me;
            const time = new Date(message._created_at || Date.now()).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div key={message._row_id} className={`flex mb-3 ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[75%] flex flex-col">
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary text-secondary-foreground rounded-bl-sm"
                    }`}
                  >
                    {message.content}
                  </div>
                  <span className={`text-[10px] text-muted-foreground mt-1 ${isOwn ? "text-right" : ""}`}>
                    {time}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/5 shrink-0">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto px-4 py-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isFriend ? `Message ${target}...` : "Friends only can message"}
            disabled={!isFriend}
            maxLength={2000}
          />
          <Button type="submit" size="icon" disabled={!isFriend || sending || !input.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default DirectMessage;
