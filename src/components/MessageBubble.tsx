import { Bot } from "lucide-react";

interface Message {
  _row_id: number;
  room_id: number;
  sender_name: string;
  content: string;
  is_ai: number;
  _created_at: number;
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

const MessageBubble = ({ message, isOwn }: MessageBubbleProps) => {
  const isAI = message.is_ai === 1;
  const timestamp = new Date(message._created_at * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex animate-fade-in ${
        isOwn ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[80%] ${
          isOwn ? "items-end" : "items-start"
        } flex flex-col gap-1`}
      >
        {/* Sender name */}
        <div
          className={`flex items-center gap-2 text-xs text-muted-foreground ${
            isOwn ? "flex-row-reverse" : ""
          }`}
        >
          {isAI && <Bot className="w-3 h-3 text-purple-400" />}
          <span className={isAI ? "text-purple-400 font-medium" : ""}>
            {message.sender_name}
          </span>
          <span>{timestamp}</span>
        </div>

        {/* Message bubble */}
        <div
          className={`message-bubble ${
            isAI
              ? "bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-500/30"
              : isOwn
              ? "bg-purple-600"
              : "bg-secondary"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
