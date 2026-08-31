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
}

const MessageBubble = ({ message, isOwn, currentUsername, avatarUrl }: MessageBubbleProps) => {
  const time = new Date(message._created_at || Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const initial = (message.sender_name || "?").charAt(0).toUpperCase();

  return (
    <div className={`flex items-end gap-2 mb-3 ${isOwn ? "flex-row-reverse" : ""}`}>
      {!isOwn && (
        <Avatar className="w-8 h-8 border border-white/10 shrink-0">
          {avatarUrl ? <AvatarImage src={avatarUrl} /> : null}
          <AvatarFallback className="bg-primary/20 text-xs">{initial}</AvatarFallback>
        </Avatar>
      )}
      <div className={`flex flex-col max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 mb-1">
          {isOwn ? (
            <span className="text-xs font-semibold text-primary">You</span>
          ) : (
            <UsernameClickMenu target={message.sender_name} currentUsername={currentUsername} />
          )}
          <span className="text-[10px] text-muted-foreground">{time}</span>
        </div>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-secondary text-secondary-foreground rounded-bl-sm"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
