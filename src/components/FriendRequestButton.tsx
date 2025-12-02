import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Search, CheckCircle, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/shared/kliv-database";
import { auth } from "@/lib/shared/kliv-auth";

interface FriendRequestButtonProps {
  username?: string;
  onFriendRequestSent?: () => void;
}

interface User {
  user_id: string;
  username: string;
  display_name?: string;
  status?: string;
}

interface FriendRequest {
  _row_id: number;
  from_user_id: string;
  to_user_id: string;
  status: string;
  message: string;
}

export const FriendRequestButton: React.FC<FriendRequestButtonProps> = ({ 
  username, 
  onFriendRequestSent 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const { toast } = useToast();

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      // Get current user
      const user = await auth.getUser();
      if (!user) return;

      // Search user_profiles by username (simulated - would need endpoint or different query)
      const { data: profiles } = await db.query('user_profiles', {
        username: `ilike.*${searchQuery}*`,
        user_id: `neq.${user.user_id}`,
        limit: 10
      });

      setSearchResults(profiles || []);
    } catch (error) {
      console.error("Error searching users:", error);
      toast({
        title: "Search Error",
        description: "Failed to search for users",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendFriendRequest = async (targetUserId: string, targetUsername: string) => {
    try {
      setLoadingRequests(true);
      const user = await auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if request already exists
      const { data: existing } = await db.query('friend_requests', {
        or: `(and(from_user_id.eq.${user.user_id},to_user_id.eq.${targetUserId}),and(from_user_id.eq.${targetUserId},to_user_id.eq.${user.user_id}))`
      });

      if (existing && existing.length > 0) {
        toast({
          title: "Request Already Exists",
          description: "A friend request already exists between you and this user",
          variant: "destructive"
        });
        return;
      }

      // Send the friend request
      await db.insert('friend_requests', {
        from_user_id: user.user_id,
        to_user_id: targetUserId,
        status: 'pending',
        message: `Hello! I'd like to be friends.`
      });

      toast({
        title: "Friend Request Sent",
        description: `Your friend request has been sent to ${targetUsername}`,
      });

      // Remove from search results
      setSearchResults(prev => prev.filter(u => u.user_id !== targetUserId));
      onFriendRequestSent?.();
      
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive"
      });
    } finally {
      setLoadingRequests(false);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const user = await auth.getUser();
      if (!user) return;

      const { data: requests } = await db.query('friend_requests', {
        or: `(to_user_id.eq.${user.user_id},from_user_id.eq.${user.user_id})`,
        status: 'eq.pending'
      });

      setPendingRequests(requests || []);
    } catch (error) {
      console.error("Error loading pending requests:", error);
    }
  };

  const handleAcceptRequest = async (requestId: number, fromUserId: string) => {
    try {
      const user = await auth.getUser();
      if (!user) return;

      // Update request status
      await db.update('friend_requests', { _row_id: `eq.${requestId}` }, {
        status: 'accepted'
      });

      // Create friendship records (both directions)
      await db.insert('friendships', {
        user_id: user.user_id,
        friend_id: fromUserId,
        status: 'accepted',
        requested_by: fromUserId
      });

      await db.insert('friendships', {
        user_id: fromUserId,
        friend_id: user.user_id,
        status: 'accepted',
        requested_by: fromUserId
      });

      toast({
        title: "Friend Request Accepted",
        description: "You are now friends!",
      });

      setPendingRequests(prev => prev.filter(r => r._row_id !== requestId));
    } catch (error) {
      console.error("Error accepting request:", error);
      toast({
        title: "Error",
        description: "Failed to accept friend request",
        variant: "destructive"
      });
    }
  };

  const handleDeclineRequest = async (requestId: number) => {
    try {
      await db.update('friend_requests', { _row_id: `eq.${requestId}` }, {
        status: 'declined'
      });

      toast({
        title: "Friend Request Declined",
        description: "The friend request has been declined",
      });

      setPendingRequests(prev => prev.filter(r => r._row_id !== requestId));
    } catch (error) {
      console.error("Error declining request:", error);
      toast({
        title: "Error",
        description: "Failed to decline friend request",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'away': return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
      case 'busy': return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      default: return <div className="w-2 h-2 bg-gray-500 rounded-full" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
          onClick={loadPendingRequests}
        >
          <UserPlus className="w-4 h-4" />
          Friends
          {pendingRequests.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {pendingRequests.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Friend Management</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Pending Requests</h3>
              <div className="space-y-2">
                {pendingRequests.map((request) => (
                  <Card key={request._row_id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium">Friend Request</p>
                        <p className="text-sm text-muted-foreground">ID: {request.from_user_id.slice(0, 8)}...</p>
                        {request.message && (
                          <p className="text-sm text-muted-foreground mt-1">{request.message}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcceptRequest(request._row_id, request.from_user_id)}
                          disabled={loadingRequests}
                        >
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeclineRequest(request._row_id)}
                          disabled={loadingRequests}
                        >
                          <XCircle className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Search Users */}
          <div>
            <h3 className="font-semibold mb-2">Find Friends</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                className="flex-1"
              />
              <Button 
                onClick={searchUsers} 
                disabled={isLoading || !searchQuery.trim()}
                size="sm"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Search Results</h3>
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <Card key={user.user_id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(user.status || 'offline')}
                          <p className="font-medium">{user.username}</p>
                          {user.display_name && (
                            <span className="text-sm text-muted-foreground">({user.display_name})</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">ID: {user.user_id.slice(0, 8)}...</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => sendFriendRequest(user.user_id, user.username)}
                        disabled={loadingRequests}
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {pendingRequests.length === 0 && searchResults.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Search for users to send friend requests</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};