import { Clock, Download, Film, Image as ImageIcon, Music, Paperclip } from "lucide-react";
import UsernameClickMenu from "@/components/UsernameClickMenu";

/** kept for existing consumers */
export const usernameHue = nameColor;
import { Avatar, DC, nameColor } from "@/components/DiscordShell";
import { fileKind, formatBytes } from "@/lib/chatFiles";
import { isFileApproved } from "@/lib/dmFiles";
import { toMs } from "@/lib/activity";

export interface ChatMessage {
  _row_id: number;
  room_id: number;
  sender_name: string;
  content: string;
  _created_at: number | string;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  file_status?: string | null;
  is_ai?: number | null;
  [key: string]: unknown;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  currentUsername: string;
  avatarUrl?: string;
  fontSize?: number;
  showTimestamp?: boolean;
  compact?: boolean;
  /** true when this continues the previous message from the same sender */
  grouped?: boolean;
}

function discordTime(ts: number | string): string {
  const at = new Date(toMs(Number(ts) || 0));
  if (Number.isNaN(at.getTime())) return "";
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const time = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(at, now)) return `Today at ${time}`;
  if (sameDay(at, yesterday)) return `Yesterday at ${time}`;
  return `${at.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at ${time}`;
}

const AttachmentIcon = ({ kind }: { kind: string }) => {
  if (kind === "image") return <ImageIcon className="h-6 w-6" aria-hidden />;
  if (kind === "video") return <Film className="h-6 w-6" aria-hidden />;
  if (kind === "audio") return <Music className="h-6 w-6" aria-hidden />;
  return <Paperclip className="h-6 w-6" aria-hidden />;
};

const MessageBubble = ({
  message,
  isOwn,
  currentUsername,
  avatarUrl,
  fontSize = 15,
  showTimestamp = true,
  compact = false,
  grouped = false,
}: MessageBubbleProps) => {
  const hasFile = Boolean(message.file_path);
  const approved = isFileApproved(message.file_status);
  const isSystem = !message.sender_name || message.sender_name === "System";
  const isAi = message.is_ai === 1;

  // Files stay hidden from everyone but the sender until an admin approves them
  if (hasFile && !approved && !isOwn) return null;

  if (isSystem) {
    return (
      <div className={`flex items-center gap-2 py-1 pl-[72px] pr-12 text-[13px] ${DC.muted} hover:bg-[var(--dc-msg-hover)]`}>
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">{message.content}</span>
      </div>
    );
  }

  const kind = hasFile ? fileKind(String(message.mime_type ?? "")) : "other";

  // Discord layout: every row keeps the same 72px gutter so message text
  // lines up in one column. The avatar sits inside that gutter on the first
  // message of a group; follow-ups skip it. This is what stops the text from
  // colliding with the profile picture.
  return (
    <div
      className={`group relative py-0.5 pl-[72px] pr-6 hover:bg-[var(--dc-msg-hover)] sm:pr-12 ${
        grouped ? "" : "mt-3"
      } ${compact ? "text-[13px]" : "text-[15px]"}`}
    >
      {!grouped && (
        <span className="absolute left-4 top-0.5">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <Avatar name={message.sender_name} size={40} />
          )}
        </span>
      )}
      {!grouped && (
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          {isAi ? (
            <span className="flex items-center gap-1 text-[15px] font-semibold text-[var(--dc-accent)]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--dc-accent)] text-[10px] text-white">
                AI
              </span>
              Assistant
            </span>
          ) : (
            <UsernameClickMenu
              target={message.sender_name}
              currentUsername={currentUsername}
              nameClassName="text-[15px]"
              style={{ color: nameColor(message.sender_name) }}
            />
          )}
          {showTimestamp && (
            <span className={`text-[11px] ${DC.muted}`}>{discordTime(message._created_at)}</span>
          )}
        </div>
      )}
      <div
        className={`min-w-0 break-words leading-[1.375rem] text-[#dbdee1] ${grouped ? "" : "mt-0.5"}`}
        style={{ fontSize }}
      >
        {message.content ? <p className="whitespace-pre-wrap">{message.content}</p> : null}

        {hasFile && approved ? (
          message.file_path ? (
            <div className="mt-1 max-w-md overflow-hidden rounded-lg border border-black/30 bg-[var(--dc-side)]">
              {kind === "image" ? (
                <a href={message.file_path} target="_blank" rel="noreferrer">
                  <img
                    src={`${message.file_path}?w=480`}
                    alt={message.file_name ?? "shared image"}
                    className="max-h-72 w-full object-cover"
                    loading="lazy"
                  />
                </a>
              ) : null}
              <div className="flex items-center gap-2.5 px-3 py-2">
                <span className={`shrink-0 ${DC.muted}`}>
                  <AttachmentIcon kind={kind} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-[#dbdee1]">{message.file_name}</span>
                  <span className={`text-xs ${DC.muted}`}>{formatBytes(message.file_size ?? 0)}</span>
                </span>
                <a
                  href={message.file_path}
                  download={message.file_name ?? true}
                  className="shrink-0 rounded p-1.5 text-[#949ba4] hover:bg-[var(--dc-active)] hover:text-white"
                  aria-label={`Download ${message.file_name ?? "file"}`}
                >
                  <Download className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>
          ) : null
        ) : null}

        {hasFile && !approved ? (
          <span className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-md bg-[var(--dc-side)] px-2 py-1 text-xs text-[#faa61a]">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              <span className="font-medium text-[#dbdee1]">{message.file_name}</span> — waiting
              for admin approval. Only you can see this until then.
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default MessageBubble;
