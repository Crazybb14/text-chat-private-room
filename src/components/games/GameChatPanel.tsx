import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listChat, sendChat, type GameChatRow } from "@/lib/gameMatches";

interface Props {
  matchId: number;
  me: string;
  opponent: string;
}

export default function GameChatPanel({ matchId, me, opponent }: Props) {
  const [messages, setMessages] = useState<GameChatRow[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await listChat(matchId);
        if (!cancelled) setMessages(rows);
      } catch {
        /* network hiccup — the next poll retries */
      }
    };
    void load();
    const timer = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await sendChat(matchId, me, text);
      setText("");
      const rows = await listChat(matchId);
      setMessages(rows);
    } catch {
      /* keep the message in the box so nothing is lost */
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="flex flex-col h-full min-h-[420px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Match chat · vs {opponent}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Only the two of you (and admins) can read this chat.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-2 min-h-0">
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[380px]" aria-label="match chat log">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground">Say gg, coordinate, or trash talk — it stays between you two.</p>
          )}
          {messages.map((m) => (
            <div key={m._row_id} className={`text-sm ${m.sender === me ? "text-right" : ""}`}>
              <span className={`font-semibold mr-1.5 ${m.sender === me ? "text-sky-400" : "text-amber-400"}`}>
                {m.sender === me ? "You" : m.sender}:
              </span>
              <span className="text-foreground/90 break-words">{m.text}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="flex gap-2 pt-2 border-t border-border">
          <Input
            aria-label="Game chat message"
            placeholder="Message your opponent…"
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
          />
          <Button size="sm" onClick={() => void send()} disabled={sending || !text.trim()} aria-label="Send game chat">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
