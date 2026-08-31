import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UsernameClickMenu from "./UsernameClickMenu";
import { fileKind, formatBytes } from "@/lib/chatFiles";
import { Download, File as FileIcon, FileText, Image as ImageIcon } from "lucide-react";

export interface ChatMessage {
  _row_id: number;
  sender_name: string;
  content: string;
  device_id: string | null;
  _created_at: number;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
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

/** File shared in a chat: image preview, or a named card with a download. */
const FileAttachment = ({ message }: { message: ChatMessage }) => {
  const path = message.file_path ?? "";
  const name = message.file_name || "file";
  const kind = fileKind(message.mime_type || "");
  const size =
    typeof message.file_size === "number" && message.file_size > 0
      ? formatBytes(message.file_size)
      : null;

  if (kind === "image" && path) {
    return (
      <a href={path} target="_blank" rel="noreferrer" className="block">
        <img
          src={`${path}?w=480`}
          alt={name}
          className="rounded-xl max-w-full max-h-72 object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={path}
      download={name}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 min-w-[180px] py-1 pr-2 hover:opacity-80 transition-opacity"
    >
      <span className="w-10 h-10 rounded-xl bg-black/15 flex items-center justify-center shrink-0">
        {kind === "video" ? (
          <ImageIcon className="w-5 h-5" />
        ) : kind === "audio" ? (
          <FileIcon className="w-5 h-5" />
        ) : (
          <FileText className="w-5 h-5" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium truncate">{name}</span>
        {size && <span className="block text-xs opacity-70">{size}</span>}
      </span>
      <Download className="w-4 h-4 ml-auto shrink-0" />
    </a>
  );
};

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
          className={`px-4 py-2.5 rounded-2xl break-words shadow-sm ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-secondary text-secondary-foreground rounded-bl-md"
          } ${message.file_path ? "p-2" : "whitespace-pre-wrap"}`}
        >
          {message.file_path ? <FileAttachment message={message} /> : message.content}
          {message.file_path && message.content ? (
            <p className="whitespace-pre-wrap px-2 pb-1 text-sm">{message.content}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
