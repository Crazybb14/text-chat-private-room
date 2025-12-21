import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { UserPlus, UserMinus, Users, Search, X, Shield, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { FriendManager } from "@/lib/friendSystem";

interface User {
  username: string;
  device_id: string;
  status: string;
  last_seen: number;
}

interface EnhancedFriendRequestProps {
  currentUsername: string;
  targetUsername: string;
  onToggleFriend?: () => void;
}

const EnhancedFriendRequest = ({ currentUsername, targetUsername, onToggleFriend }: EnhancedFriendRequestProps) => {
  const { toast } = useToast();
  const [isFriend, setIsFriend] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkFriendStatus();
  }, [currentUsername, targetUsername]);

  const checkFriendStatus = async () => {
    try {
      // Check if friends
      const existingFriend = await db.query("friends", {
        username: `eq.${targetUsername}`,
        friend_username: `eq.${currentUsername}`
      });
      
      // Check if blocked
      const blocked = await db.query("blocked_users", {
        blocker_username: `eq.${currentUsername}`,
        blocked_username: `eq.${targetUsername}`
      });

      setIsFriend(existingFriend.length > 0);
      setIsBlocked(blocked.length > 0);
    } catch (error) {
      console.log("Error checking friend status:", error);
    }
  };

  const handleFriendRequest = async () => {
    if (isFriend) {
      // Unfriend
      setLoading(true);
      try {
        await db.delete("friends", {
          username: `eq.${currentUsername}`,
          friend_username: `eq.${targetUsername}`
        });
        
        setIsFriend(false);
        toast({
          title: "Unfriended",
          description: `You are no longer friends with ${targetUsername}`
        });
        
        onToggleFriend?.();
      } catch (error) {
        console.log("Error unfriending:", error);
        toast({
          title: "Error",
          description: "Failed to unfriend",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    } else {
      // Send friend request
      const currentDeviceId = localStorage.getItem('deviceId') || '';
      
      setLoading(true);
      try {
        // Check if request already sent
        const existingRequest = await db.query("friend_requests", {
          from_username: `eq.${currentUsername}`,
          to_username: `eq.${targetUsername}`,
          status: `eq.pending`
        });

        if (existingRequest.length > 0) {
          toast({
            title: "Request already sent",
            description: "You've already sent a friend request to this user",
            variant: "destructive"
          });
          return;
        }

        // Send friend request
        await db.insert("friend_requests", {
          from_username: currentUsername,
          to_username: targetUsername,
          from_device_id: currentDeviceId,
          status: 'pending',
          created_at: Date.now()
        });

        toast({
          title: "Friend request sent",
          description: `Request sent to ${targetUsername}`
        });
      } catch (error) {
        console.log("Error sending friend request:", error);
        toast({
          title: "Error",
          description: "Failed to send friend request",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBlockUser = async () => {
    setLoading(true);
    try {
      if (isBlocked) {
        // Unblock
        await db.delete("blocked_users", {
          blocker_username: `eq.${currentUsername}`,
          blocked_username: `eq.${targetUsername}`
        });
        
        setIsBlocked(false);
        toast({
          title: "User unblocked",
          description: `${targetUsername} is no longer blocked`
        });
      } else {
        // Block
        await db.insert("blocked_users", {
          blocker_username: currentUsername,
          blocked_username: targetUsername,
          blocked_at: Date.now()
        });
        
        // Remove from friends if they were friends
        if (isFriend) {
          await db.delete("friends", {
            username: `eq.${currentUsername}`,
            friend_username: `eq.${targetUsername}`
          });
          setIsFriend(false);
        }
        
        setIsBlocked(true);
        toast({
          title: "User blocked",
          description: `${targetUsername} has been blocked`
        });
      }
    } catch (error) {
      console.log("Error blocking/unblocking:", error);
      toast({
        title: "Error",
        description: "Failed to update block status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant={isFriend ? "outline" : "default"}
        onClick={handleFriendRequest}
        disabled={loading || isBlocked}
        className={`${isFriend ? "border-green-500/50 text-green-400" : "bg-blue-600 hover:bg-blue-700"}`}
      >
        {isFriend ? (
          <>
            <UserMinus className="w-3 h-3 mr-1" />
            Unfriend
          </>
        ) : (
          <>
            <UserPlus className="w-3 h-3 mr-1" />
            Add Friend
          </>
        )}
      </Button>
      
      <Button
        size="sm"
        variant={isBlocked ? "destructive" : "outline"}
        onClick={handleBlockUser}
        disabled={loading}
      >
        {isBlocked ? "Unblock" : "Block"}
      </Button>
    </div>
  );
};

export default EnhancedFriendRequest;