import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UsernameClickMenu from "./UsernameClickMenu";

export interface ChatMessage {
  _row_id: number;
  sender_name: string;
  content: string;
  device_id: string | null;
  _created_at: number;
  [key: string]: unknown;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  currentUsername: string;
  avatarUrl?: string;
  /** Text size from the reader's personal settings. */
  fontSize?: number;
  showTimestamp?: boolean;
  compact?: boolean;
}

/** Stable hue per username so everyone's name reads consistently. */
export function usernameHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

const MessageBubble = ({
  message,
  isOwn,
  currentUsername,
  avatarUrl,
  fontSize = 15,
  showTimestamp = true,
  compact = false,
}: MessageBubbleProps) => {
  const time = new Date(message._created_at || Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const initial = (message.sender_name || "?").charAt(0).toUpperCase();
  const hue = usernameHue(message.sender_name || "x");

  return (
    <div className={`flex items-end gap-2 ${compact ? "mb-1.5" : "mb-3"} ${isOwn ? "flex-row-reverse" : ""}`}>
      {!isOwn && (
        <Avatar className="w-8 h-8 border border-white/10 shrink-0">
          {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
          <AvatarFallback
            className="text-xs font-semibold text-white"
            style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 45%), hsl(${(hue + 40) % 360} 65% 40%))` }}
          >
            {initial}
          </AvatarFallback>
        </Avatar>
      )}
      <div className={`flex flex-col max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 mb-1">
          {isOwn ? (
            <span className="text-xs font-semibold text-primary">You</span>
          ) : (
            <UsernameClickMenu target={message.sender_name} currentUsername={currentUsername} />
          )}
          {showTimestamp && <span className="text-[10px] text-muted-foreground">{time}</span>}
        </div>
        <div
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.45 }}
          className={`px-4 py-2.5 rounded-2xl whitespace-pre-wrap break-words shadow-sm ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-secondary text-secondary-foreground rounded-bl-md"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
