import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, X, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface DirectMessageProps {
  currentUser: string;
  recipientUser: string;
  onClose: () => void;
}

interface Message {
  _row_id: number;
  sender_username: string;
  recipient_username: string;
  content: string;
  _created_at: number;
  is_read: number;
}

const DirectMessage = ({ currentUser, recipientUser, onClose }: DirectMessageProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 2 seconds
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [currentUser, recipientUser]);

  const loadMessages = async () => {
    try {
      const msgs = await db.query("direct_messages", {
        or: `(sender_username.eq.${currentUser},recipient_username.eq.${recipientUser}),(sender_username.eq.${recipientUser},recipient_username.eq.${currentUser})`,
        order: "_created_at.asc"
      });
      setMessages(msgs);
      
      // Mark messages as read
      const unread = msgs.filter(m => m.recipient_username === currentUser && m.is_read === 0);
      for (const msg of unread) {
        await db.update("direct_messages", { _row_id: `eq.${msg._row_id}` }, { is_read: 1 });
      }
    } catch (error) {
      console.log("Error loading messages:", error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setLoading(true);
    try {
      await db.insert("direct_messages", {
        sender_username: currentUser,
        recipient_username: recipientUser,
        content: newMessage.trim(),
        is_read: 0,
        _created_at: Date.now()
      });

      setNewMessage("");
      await loadMessages();
    } catch (error) {
      console.log("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="fixed inset-4 z-50 flex flex-col bg-background border-white/10">
      <CardContent className="flex-1 p-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold">{recipientUser}</h3>
              <p className="text-xs text-green-400">Online</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message._row_id}
                  className={`flex ${message.sender_username === currentUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-lg ${
                      message.sender_username === currentUser
                        ? "bg-purple-600 text-white"
                        : "bg-secondary text-white"
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message._created_at * 1000).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <form onSubmit={sendMessage} className="p-4 border-t border-white/10">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${recipientUser}...`}
              className="flex-1 bg-secondary/50 border-white/10"
            />
            <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default DirectMessage;