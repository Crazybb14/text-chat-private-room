import { Trash2, Ban, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Room {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
}

interface Message {
  _row_id: number;
  room_id: number;
  sender_name: string;
  content: string;
  is_ai: number;
  _created_at: number;
}

interface AdminMessageViewProps {
  room: Room | null;
  messages: Message[];
  onDeleteMessage: (id: number) => void;
  onBanUser: (username: string) => void;
}

const AdminMessageView = ({ room, messages, onDeleteMessage, onBanUser }: AdminMessageViewProps) => {
  if (!room) {
    return (
      <Card className="glass-morphism border-white/10">
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Select a room to view messages</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-morphism border-white/10">
      <CardHeader className="border-b border-white/10">
        <CardTitle className="text-lg">{room.name} - Messages</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          {messages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No messages in this room</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {messages.map((message) => {
                const timestamp = new Date(message._created_at * 1000).toLocaleString();
                const isAI = message.is_ai === 1;

                return (
                  <div
                    key={message._row_id}
                    className="p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isAI && <Bot className="w-4 h-4 text-purple-400" />}
                          <span
                            className={`font-medium ${
                              isAI ? "text-purple-400" : ""
                            }`}
                          >
                            {message.sender_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {timestamp}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground break-words">
                          {message.content}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {!isAI && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onBanUser(message.sender_name)}
                            className="h-8 w-8 text-muted-foreground hover:text-red-400"
                            title="Ban user"
                          >
                            <Ban className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteMessage(message._row_id)}
                          className="h-8 w-8 text-muted-foreground hover:text-red-400"
                          title="Delete message"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AdminMessageView;
