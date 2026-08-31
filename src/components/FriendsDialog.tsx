import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  acceptFriendRequest,
  deleteFriendship,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  getProfile,
  removeFriend,
  sendFriendRequest,
  type FriendshipRow,
  type ProfileRow,
} from "@/lib/friends";
import { Check, MessageSquare, RefreshCw, UserMinus, UserPlus, Users, X } from "lucide-react";

interface FriendsDialogProps {
  open: boolean;
  onClose: () => void;
  username: string;
}

interface FriendEntry {
  username: string;
  profile: ProfileRow | null;
}

const FriendsDialog = ({ open, onClose, username }: FriendsDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendshipRow[]>([]);
  const [outgoing, setOutgoing] = useState<FriendshipRow[]>([]);
  const [addName, setAddName] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [friendNames, incomingRows, outgoingRows] = await Promise.all([
        getFriends(username),
        getIncomingRequests(username),
        getOutgoingRequests(username),
      ]);
      const profiles = await Promise.all(friendNames.map((f) => getProfile(f)));
      setFriends(friendNames.map((f, i) => ({ username: f, profile: profiles[i] })));
      setIncoming(incomingRows);
      setOutgoing(outgoingRows);
    } catch (error) {
      console.error("Failed to load friends:", error);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  const handleAdd = async () => {
    const name = addName.trim().toLowerCase();
    if (!name) return;
    setBusy(true);
    const result = await sendFriendRequest(username, name);
    toast({
      title: result.ok ? "Request sent" : "Couldn't send request",
      description: result.message,
      variant: result.ok ? undefined : "destructive",
    });
    if (result.ok) setAddName("");
    await load();
    setBusy(false);
  };

  const handleAccept = async (row: FriendshipRow) => {
    setBusy(true);
    await acceptFriendRequest(row._row_id);
    toast({ title: "Friend added", description: `You and ${row.requested_by} are now friends.` });
    await load();
    setBusy(false);
  };

  const handleDecline = async (row: FriendshipRow) => {
    setBusy(true);
    await deleteFriendship(row._row_id);
    await load();
    setBusy(false);
  };

  const handleCancel = async (row: FriendshipRow) => {
    setBusy(true);
    await deleteFriendship(row._row_id);
    await load();
    setBusy(false);
  };

  const handleRemove = async (friend: string) => {
    setBusy(true);
    await removeFriend(username, friend);
    toast({ title: "Friend removed", description: `${friend} was removed from your friends.` });
    await load();
    setBusy(false);
  };

  const initialOf = (name: string) => name.charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" /> Friends
          </DialogTitle>
        </DialogHeader>

        {/* Add friend */}
        <div className="flex gap-2">
          <Input
            placeholder="Add friend by username"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" aria-label="Send friend request" onClick={handleAdd} disabled={busy || !addName.trim()}>
            <UserPlus className="w-4 h-4" />
          </Button>
        </div>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Requests ({incoming.length})
            </h4>
            {incoming.map((row) => (
              <div key={row._row_id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/50">
                <span className="text-sm font-medium truncate">{row.requested_by}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="default" aria-label={`Accept ${row.requested_by}`} onClick={() => handleAccept(row)} disabled={busy}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" aria-label={`Decline ${row.requested_by}`} onClick={() => handleDecline(row)} disabled={busy}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Outgoing requests */}
        {outgoing.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Sent</h4>
            {outgoing.map((row) => (
              <div key={row._row_id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/30">
                <span className="text-sm text-muted-foreground truncate">Waiting on {row.friend_id}</span>
                <Button size="sm" variant="ghost" onClick={() => handleCancel(row)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Friends list */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Your friends ({friends.length})
            </h4>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {friends.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground py-2">
              No friends yet. Add someone by their username above.
            </p>
          )}
          {friends.map((friend) => (
            <div key={friend.username} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-secondary/40">
              <div
                className="flex items-center gap-2 min-w-0 cursor-pointer"
                onClick={() => navigate(`/profile/${friend.username}`)}
              >
                <Avatar className="w-8 h-8 border border-white/10">
                  {friend.profile?.avatar_url ? <AvatarImage src={friend.profile.avatar_url} /> : null}
                  <AvatarFallback className="bg-primary/20 text-xs">
                    {initialOf(friend.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {friend.profile?.display_name || friend.username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">@{friend.username}</p>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => navigate(`/dm/${friend.username}`)}>
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleRemove(friend.username)} disabled={busy}>
                  <UserMinus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FriendsDialog;
