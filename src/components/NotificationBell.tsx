import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  acceptFriendRequest,
  deleteFriendship,
  getIncomingRequests,
  getUnreadDirectMessages,
  getProfile,
  type DirectMessageRow,
  type FriendshipRow,
  type ProfileRow,
} from "@/lib/friends";
import { Bell, Check, MessageSquare, UserPlus, X } from "lucide-react";

interface NotificationBellProps {
  username: string;
}


const NotificationBell = ({ username }: NotificationBellProps) => {
  const navigate = useNavigate();
  const [unread, setUnread] = useState<DirectMessageRow[]>([]);
  const [requests, setRequests] = useState<FriendshipRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow | null>>({});
  const [open, setOpen] = useState(false);

  const poll = useCallback(async () => {
    try {
      const [messages, reqs] = await Promise.all([
        getUnreadDirectMessages(username),
        getIncomingRequests(username),
      ]);
      setUnread(messages);
      setRequests(reqs);

      const senders = [...new Set(messages.map((m) => m.sender_username))];
      const results = await Promise.all(senders.map((s) => getProfile(s)));
      const map: Record<string, ProfileRow | null> = {};
      senders.forEach((s, i) => {
        map[s] = results[i];
      });
      setProfiles(map);
    } catch (error) {
      console.error("Notification poll failed:", error);
    }
  }, [username]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [poll]);

  const total = unread.length + requests.length;

  const handleAccept = async (row: FriendshipRow) => {
    await acceptFriendRequest(row._row_id);
    poll();
  };

  const handleDecline = async (row: FriendshipRow) => {
    await deleteFriendship(row._row_id);
    poll();
  };

  const senders = [...new Set(unread.map((m) => m.sender_username))];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-h-96 overflow-y-auto">
        {total === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">You're all caught up.</p>
        )}

        {senders.length > 0 && (
          <div className="space-y-1 mb-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground px-1">New messages</h4>
            {senders.map((sender) => {
              const count = unread.filter((m) => m.sender_username === sender).length;
              const profile = profiles[sender];
              return (
                <button
                  key={sender}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/60 text-left"
                  onClick={() => {
                    setOpen(false);
                    navigate(`/dm/${sender}`);
                  }}
                >
                  <Avatar className="w-8 h-8 border border-white/10">
                    {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} /> : null}
                    <AvatarFallback className="bg-primary/20 text-xs">
                      {sender.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium flex-1 truncate">{sender}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {count} <MessageSquare className="w-3 h-3" />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {requests.length > 0 && (
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground px-1">Friend requests</h4>
            {requests.map((row) => (
              <div key={row._row_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/60">
                <UserPlus className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium flex-1 truncate">{row.requested_by}</span>
                <Button size="sm" variant="default" className="h-7 px-2" onClick={() => handleAccept(row)}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleDecline(row)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
