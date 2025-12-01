import React from "react";
import { Bot, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import ClickableUsername from "./ClickableUsername";
import { getDeviceId } from "@/lib/deviceId";

interface Message {
  _row_id: number;
  room_id: number;
  sender_name: string;
  content: string;
  is_ai: number;
  device_id: string | null;
  _created_at: number;
}

interface MessageBubbleWithMentionsProps {
  message: Message;
  isOwn: boolean;
  onUsernameClick?: (userId: string, username: string) => void;
  showTime?: boolean;
}

const MessageBubbleWithMentions = ({ 
  message, 
  isOwn, 
  onUsernameClick,
  showTime = true 
}: MessageBubbleWithMentionsProps) => {
  const { toast } = useToast();

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard",
      });
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const processMessageContent = (content: string) => {
    // Regular expression to match @username mentions
    const mentionRegex = /@(\w+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex, match.index)
        });
      }

      // Add the mention
      parts.push({
        type: 'mention',
        username: match[1]
      });

      lastIndex = mentionRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex)
      });
    }

    return parts;
  };

  const messageParts = processMessageContent(message.content);

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group mb-4`}>
      <div
        className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${
          isOwn
            ? 'bg-blue-600 text-white rounded-br-none'
            : message.is_ai
            ? 'bg-purple-600 text-white rounded-bl-none'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none'
        }`}
      >
        {/* Sender info */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-2">
            {message.is_ai && <Bot className="w-4 h-4" />}
            <span className={`text-xs font-semibold ${
              isOwn 
                ? 'text-blue-100' 
                : message.is_ai 
                ? 'text-purple-100' 
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {message.is_ai ? 'AI Assistant' : message.sender_name}
            </span>
          </div>
          {showTime && (
            <span className={`text-xs ${
              isOwn 
                ? 'text-blue-100' 
                : message.is_ai 
                ? 'text-purple-100' 
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {formatTime(message._created_at)}
            </span>
          )}
        </div>

        {/* Message content with mentions */}
        <div className="break-words">
          {messageParts.map((part, index) => {
            if (part.type === 'text') {
              return (
                <span key={index} className="text-sm">
                  {part.content}
                </span>
              );
            } else if (part.type === 'mention') {
              return (
                <span key={index}>
                  <ClickableUsername
                    username={part.username}
                    onClick={() => {
                      if (onUsernameClick) {
                        // Find the user ID for this username
                        // For now, we'll use the username as a placeholder
                        // In a real implementation, you'd look up the user ID
                        onUsernameClick(`user_${part.username}`, part.username);
                      }
                    }}
                    variant={isOwn ? 'muted' : 'highlight'}
                    className="inline-block mx-1"
                  />
                </span>
              );
            }
            return null;
          })}
        </div>

        {/* Copy button */}
        <div className={`mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
          isOwn 
            ? 'flex justify-end' 
            : 'flex justify-start'
        }`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyMessage}
            className={`h-6 w-6 p-0 ${
              isOwn 
                ? 'text-blue-100 hover:bg-blue-500 hover:text-white' 
                : message.is_ai 
                ? 'text-purple-100 hover:bg-purple-500 hover:text-white' 
                : 'text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MessageBubbleWithMentions;