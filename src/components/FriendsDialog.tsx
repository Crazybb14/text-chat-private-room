import { useState, useEffect } from "react";
import { Search, Loader2, X, UserPlus, MessageCircle, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import type { FriendshipRow, ProfileRow } from "@/lib/friends";
import { sendFriendRequest, acceptFriendRequest, deleteFriendship } from "@/lib/friends";

interface FriendsDialogProps {
  currentUsername: string | null;
  onOpenDirectMessage?: (username: string) => void;
}

const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const FriendsDialog = ({ currentUsername, onOpenDirectMessage }: FriendsDialogProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [receivedRequests, setReceivedRequests] = useState<FriendshipRow[]>([]);
  const [friends, setFriends] = useState<FriendshipRow[]>([]);
  const [tab, setTab] = useState<"search" | "requests" | "friends">("search");

  useEffect(() => {
    const loadFriendData = async () => {
      if (!currentUsername) return;

      try {
        const [sentReq, receivedReq, friendList] = await Promise.all([
          db.query<FriendshipRow>("friendships", { user_id: `eq.${currentUsername}` }),
          db.query<FriendshipRow>("friendships", { friend_id: `eq.${currentUsername}` }),
          db.query<FriendshipRow>("friendships", { status: "eq.accepted" }),
        ]);

        setSentRequests(new Set(sentReq.filter((r) => r.status === "pending").map((r) => r.friend_id)));
        setReceivedRequests(
          receivedReq.filter((r) => r.status === "pending" && r.requested_by !== currentUsername)
        );
        setFriends(friendList.filter((r) => r.user_id === currentUsername || r.friend_id === currentUsername));
      } catch (error) {
        console.log("Error loading friend data:", error);
      }
    };

    loadFriendData();
  }, [currentUsername]);

  useEffect(() => {
    const performSearch = async () => {
      if (!search.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        // Prefix search on both username and display_name
        const results = await db.query<ProfileRow>("user_profiles", {
          or: `(${encodeURIComponent(`username.ilike.*${search}*`)},${encodeURIComponent(`display_name.ilike.*${search}*`)})`,
          limit: 20,
        });
        setSearchResults(results);
      } catch (error) {
        console.log("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(performSearch, 200);
    return () => clearTimeout(debounce);
  }, [search]);

  const sendRequest = async (targetUsername: string) => {
    if (!currentUsername) return;
    if (currentUsername === targetUsername) {
      toast({ title: "Can't add yourself", variant: "destructive" });
      return;
    }

    const result = await sendFriendRequest(currentUsername, targetUsername);
    if (result.ok) {
      setSentRequests((prev) => new Set(prev).add(targetUsername));
      toast({ title: "Request sent", description: result.message });
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const handleAccept = async (row: FriendshipRow) => {
    if (!currentUsername) return;

    try {
      await acceptFriendRequest(row._row_id);
      setReceivedRequests((prev) => prev.filter((r) => r._row_id !== row._row_id));
      setFriends((prev) => [
        ...prev,
        { ...row, status: "accepted" },
      ]);
      toast({ title: "Friend added", description: `You are now friends with @${row.user_id}` });
    } catch (error) {
      console.log("Error accepting request:", error);
      toast({ title: "Error", description: "Failed to accept request. Try again.", variant: "destructive" });
    }
  };

  const handleReject = async (row: FriendshipRow) => {
    if (!currentUsername) return;

    try {
      await deleteFriendship(row._row_id);
      setReceivedRequests((prev) => prev.filter((r) => r._row_id !== row._row_id));
      toast({ title: "Request rejected", description: `Friend request from @${row.user_id} rejected` });
    } catch (error) {
      console.log("Error rejecting request:", error);
      toast({ title: "Error", description: "Failed to reject request. Try again.", variant: "destructive" });
    }
  };

  const removeFriend = async (row: FriendshipRow) => {
    if (!currentUsername) return;

    try {
      await deleteFriendship(row._row_id);
      setFriends((prev) => prev.filter((r) => r._row_id !== row._row_id));
      toast({ title: "Friend removed", description: `Removed @${row.user_id} from friends` });
    } catch (error) {
      console.log("Error removing friend:", error);
      toast({ title: "Error", description: "Failed to remove friend. Try again.", variant: "destructive" });
    }
  };

  const getFriendUsername = (row: FriendshipRow): string => {
    return row.user_id === currentUsername ? row.friend_id : row.user_id;
  };

  return (
    <div className="flex flex-col h-[600px]">
      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setTab("search")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === "search"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="w-4 h-4 inline mr-1" />
          Find friends
        </button>
        <button
          onClick={() => setTab("requests")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === "requests"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserPlus className="w-4 h-4 inline mr-1" />
          Requests {receivedRequests.length > 0 && `(${receivedRequests.length})`}
        </button>
        <button
          onClick={() => setTab("friends")}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            tab === "friends"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="w-4 h-4 inline mr-1" />
          Friends {friends.length > 0 && `(${friends.length})`}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "search" && (
          <div className="h-full flex flex-col p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-secondary/50"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {isSearching ? (
              <div className="flex items-center justify-center flex-1">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : searchResults.length === 0 && search ? (
              <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
                No results found
              </div>
            ) : searchResults.length === 0 && !search ? (
              <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
                Type to search for users
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-2">
                  {searchResults.map((profile) => {
                    const isFriend = friends.some(
                      (f) => (f.user_id === profile.username || f.friend_id === profile.username) && f.status === "accepted"
                    );
                    const requestSent = sentRequests.has(profile.username);

                    return (
                      <div
                        key={profile._row_id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                      >
                        <Avatar className="w-10 h-10">
                          {profile.avatar_url ? (
                            <AvatarImage src={profile.avatar_url} />
                          ) : (
                            <AvatarFallback>{getInitials(profile.display_name || profile.username)}</AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{profile.display_name || profile.username}</p>
                          <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
                        </div>
                        {isFriend ? (
                          <Button size="sm" variant="ghost" disabled>
                            <Shield className="w-4 h-4" />
                          </Button>
                        ) : requestSent ? (
                          <Button size="sm" variant="ghost" disabled>
                            Request sent
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => sendRequest(profile.username)}>
                            <UserPlus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {tab === "requests" && (
          <ScrollArea className="h-full p-4">
            {receivedRequests.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No pending requests
              </div>
            ) : (
              <div className="space-y-2 pr-2">
                {receivedRequests.map((request) => (
                  <div
                    key={request._row_id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>{getInitials(request.user_id)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">@{request.user_id}</p>
                      <p className="text-xs text-muted-foreground">Wants to be your friend</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAccept(request)}>
                        Accept
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleReject(request)}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}

        {tab === "friends" && (
          <ScrollArea className="h-full p-4">
            {friends.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No friends yet
              </div>
            ) : (
              <div className="space-y-2 pr-2">
                {friends.map((friendship) => {
                  const friendUsername = getFriendUsername(friendship);

                  return (
                    <div
                      key={friendship._row_id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarFallback>{getInitials(friendUsername)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">@{friendUsername}</p>
                        <p className="text-xs text-muted-foreground">Friend</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => onOpenDirectMessage?.(friendUsername)}>
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeFriend(friendship)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default FriendsDialog;
