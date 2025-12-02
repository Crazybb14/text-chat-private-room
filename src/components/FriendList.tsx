import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, 
  User, 
  UserX, 
  MessageSquare, 
  Circle, 
  Clock,
  Settings,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/shared/kliv-database";
import { auth } from "@/lib/shared/kliv-auth";

interface Friend {
  user_id: string;
  username: string;
  display_name?: string;
  status?: string;
  last_seen?: number;
  avatar_url?: string;
  friendship_id?: number;
}

interface FriendListProps {
  onChatWithFriend?: (friend: Friend) => void;
  showOffline?: boolean;
  compact?: boolean;
}

export const FriendList: React.FC<FriendListProps> = ({ 
  onChatWithFriend,
  showOffline = true,
  compact = false 
}) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const { toast } = useToast();

  const loadFriends = async () => {
    try {
      setIsLoading(true);
      const user = await auth.getUser();
      if (!user) return;

      // Get accepted friendships
      const { data: friendships } = await db.query('friendships', {
        user_id: `eq.${user.user_id}`,
        status: 'eq.accepted'
      });

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        return;
      }

      // Get friend IDs
      const friendIds = friendships.map(f => f.friend_id);
      
      // Get friend profiles
      const friendsData: Friend[] = [];
      for (const friendId of friendIds) {
        const { data: profile } = await db.query('user_profiles', {
          user_id: `eq.${friendId}`
        });

        if (profile && profile.length > 0) {
          friendsData.push({
            ...profile[0],
            friendship_id: (friendships.find(f => f.friend_id === friendId)?._row_id) ?? undefined
          });
        } else {
          // Friend without profile - create basic friend entry
          friendsData.push({
            user_id: friendId,
            username: `User_${friendId.slice(0, 8)}`,
            status: 'offline',
            friendship_id: (friendships.find(f => f.friend_id === friendId)?._row_id) ?? undefined
          });
        }
      }

      setFriends(friendsData);
    } catch (error) {
      console.error("Error loading friends:", error);
      toast({
        title: "Error",
        description: "Failed to load friends list",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeFriend = async (friend: Friend) => {
    try {
      const user = await auth.getUser();
      if (!user) return;

      // Delete friendship records (both directions)
      await db.delete('friendships', {
        user_id: `eq.${user.user_id}`,
        friend_id: `eq.${friend.user_id}`
      });

      await db.delete('friendships', {
        user_id: `eq.${friend.user_id}`,
        friend_id: `eq.${user.user_id}`
      });

      toast({
        title: "Friend Removed",
        description: `${friend.username} has been removed from your friends list`,
      });

      setFriends(prev => prev.filter(f => f.user_id !== friend.user_id));
    } catch (error) {
      console.error("Error removing friend:", error);
      toast({
        title: "Error",
        description: "Failed to remove friend",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string, lastSeen?: number) => {
    const now = Date.now();
    const isRecentlyActive = lastSeen && (now - lastSeen) < (24 * 60 * 60 * 1000); // 24 hours

    switch (status) {
      case 'online': 
        return <Circle className="w-3 h-3 text-green-500 fill-current" />;
      case 'away': 
        return <Circle className="w-3 h-3 text-yellow-500 fill-current" />;
      case 'busy': 
        return <Circle className="w-3 h-3 text-red-500 fill-current" />;
      case 'offline':
        if (isRecentlyActive) {
          return <Circle className="w-3 h-3 text-blue-500" />;
        }
        return <Circle className="w-3 h-3 text-gray-400" />;
      default: 
        return <Circle className="w-3 h-3 text-gray-400" />;
    }
  };

  const getStatusText = (status: string, lastSeen?: number) => {
    const now = Date.now();
    const isRecentlyActive = lastSeen && (now - lastSeen) < (24 * 60 * 60 * 1000); // 24 hours

    switch (status) {
      case 'online': return 'Online';
      case 'away': return 'Away';
      case 'busy': return 'Busy';
      case 'offline':
        if (isRecentlyActive) {
          const hours = Math.floor((now - (lastSeen || 0)) / (60 * 60 * 1000));
          return `Last seen ${hours}h ago`;
        }
        return 'Offline';
      default: return 'Offline';
    }
  };

  const filteredFriends = friends.filter(friend => {
    if (filter === 'online' && friend.status === 'offline') return false;
    if (filter === 'offline' && friend.status !== 'offline') return false;
    return true;
  });

  useEffect(() => {
    loadFriends();
  }, []);

  if (isLoading) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""}>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 animate-pulse" />
            Loading friends...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1">
        {filteredFriends.slice(0, 5).map((friend) => (
          <div 
            key={friend.user_id}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer"
            onClick={() => onChatWithFriend?.(friend)}
          >
            <div className="flex items-center gap-2">
              {getStatusIcon(friend.status || 'offline', friend.last_seen)}
              <div>
                <p className="text-sm font-medium">{friend.username}</p>
                <p className="text-xs text-muted-foreground">
                  {getStatusText(friend.status || 'offline', friend.last_seen)}
                </p>
              </div>
            </div>
          </div>
        ))}
        {friends.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            +{friends.length - 5} more friends
          </p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            Friends ({friends.length})
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'online' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('online')}
            >
              Online
            </Button>
            {showOffline && (
              <Button
                variant={filter === 'offline' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilter('offline')}
              >
                Offline
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-2">
        {filteredFriends.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No friends found</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => window.dispatchEvent(new CustomEvent('open-friend-requests'))}
            >
              Find Friends
            </Button>
          </div>
        ) : (
          filteredFriends.map((friend) => (
            <div 
              key={friend.user_id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={friend.avatar_url} />
                  <AvatarFallback>
                    {friend.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{friend.username}</p>
                    {friend.display_name && (
                      <span className="text-sm text-muted-foreground">({friend.display_name})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {getStatusIcon(friend.status || 'offline', friend.last_seen)}
                    <span>{getStatusText(friend.status || 'offline', friend.last_seen)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onChatWithFriend?.(friend)}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFriend(friend)}
                >
                  <UserX className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};