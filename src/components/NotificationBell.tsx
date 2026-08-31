import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import {
  getUnreadNotifications,
  markNotificationRead,
  showBrowserNotification,
  type SiteNotification,
} from "@/lib/notifications";
import { Bell, Check, CheckCheck, MessageSquare, Megaphone, PhoneCall, UserPlus, X } from "lucide-react";

interface NotificationBellProps {
  username: string;
}

const NotificationBell = ({ username }: NotificationBellProps) => {
  const navigate = useNavigate();
  const [unread, setUnread] = useState<DirectMessageRow[]>([]);
  const [requests, setRequests] = useState<FriendshipRow[]>([]);
  const [alerts, setAlerts] = useState<SiteNotification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow | null>>({});
  const [open, setOpen] = useState(false);
  const knownAlertIds = useRef<Set<number> | null>(null);

  const poll = useCallback(async () => {
    if (!username) return;
    try {
      const [messages, reqs, notes] = await Promise.all([
        getUnreadDirectMessages(username),
        getIncomingRequests(username),
        getUnreadNotifications(username),
      ]);
      setUnread(messages);
      setRequests(reqs);
      setAlerts(notes);

      // Fire one browser pop-up per newly arrived alert (skip the first load)
      if (knownAlertIds.current !== null) {
        for (const note of notes) {
          if (!knownAlertIds.current.has(note._row_id)) {
            showBrowserNotification(
              note.title || "New notification",
              note.message || ""
            );
          }
        }
      }
      knownAlertIds.current = new Set(notes.map((n) => n._row_id));

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

  const handleAccept = async (row: FriendshipRow) => {
    await acceptFriendRequest(row._row_id);
    poll();
  };

  const handleDecline = async (row: FriendshipRow) => {
    await deleteFriendship(row._row_id);
    poll();
  };

  const handleAlertClick = async (note: SiteNotification) => {
    setOpen(false);
    try {
      await markNotificationRead(note._row_id);
    } catch {
      // best-effort
    }
    poll();
    if (note.link) navigate(note.link);
  };

  const handleMarkAllRead = async () => {
    const ids = alerts.map((a) => a._row_id);
    await Promise.all(ids.map((id) => markNotificationRead(id).catch(() => undefined)));
    poll();
  };

  const senders = [...new Set(unread.map((m) => m.sender_username))];
  const total = unread.length + requests.length + alerts.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
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

        {alerts.length > 0 && (
          <div className="space-y-1 mb-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                <Megaphone className="w-3 h-3" /> Announcements
              </h4>
              <button
                type="button"
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
            </div>
            {alerts.map((note) => (
              <button
                key={note._row_id}
                className="w-full text-left p-2 rounded-lg hover:bg-secondary/60"
                onClick={() => handleAlertClick(note)}
              >
                <p className="text-sm font-medium flex items-center gap-1.5">
                  {note.type === "auto_call" ? (
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Megaphone className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                  {note.title || "Notification"}
                </p>
                <p className="text-xs text-muted-foreground break-words">{note.message}</p>
                {note.link && (
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    tap to open
                  </Badge>
                )}
              </button>
            ))}
          </div>
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
