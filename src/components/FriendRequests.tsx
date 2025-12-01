import React, { useState, useEffect } from "react";
import { Users, UserPlus, Clock, Check, X, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface FriendRequest {
  _row_id: number;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message: string;
  created_at: number;
  updated_at: number;
  profile?: {
    username: string;
    display_name: string;
    avatar_url: string;
    status: string;
    last_seen: number;
  };
}

interface FriendRequestsProps {
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onProfileClick: (userId: string, username: string) => void;
}

const FriendRequests = ({ currentUserId, isOpen, onClose, onProfileClick }: FriendRequestsProps) => {
  const { toast } = useToast();
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && currentUserId) {
      loadFriendRequests();
    }
  }, [isOpen, currentUserId]);

  const loadFriendRequests = async () => {
    try {
      // Load incoming requests
      const incoming = await db.query("friend_requests", {
        to_user_id: `eq.${currentUserId}`,
        status: `eq.pending`
      });

      // Load outgoing requests
      const outgoing = await db.query("friend_requests", {
        from_user_id: `eq.${currentUserId}`,
        status: `eq.pending`
      });

      // Enrich with profile data
      const enrichedIncoming = await Promise.all(
        incoming.map(async (request: FriendRequest) => {
          try {
            const profiles = await db.query("user_profiles", { user_id: `eq.${request.from_user_id}` });
            return {
              ...request,
              profile: profiles.length > 0 ? profiles[0] : null
            };
          } catch (error) {
            return { ...request, profile: null };
          }
        })
      );

      const enrichedOutgoing = await Promise.all(
        outgoing.map(async (request: FriendRequest) => {
          try {
            const profiles = await db.query("user_profiles", { user_id: `eq.${request.to_user_id}` });
            return {
              ...request,
              profile: profiles.length > 0 ? profiles[0] : null
            };
          } catch (error) {
            return { ...request, profile: null };
          }
        })
      );

      setIncomingRequests(enrichedIncoming);
      setOutgoingRequests(enrichedOutgoing);
    } catch (error) {
      console.error('Error loading friend requests:', error);
      toast({
        title: "Error",
        description: "Failed to load friend requests.",
        variant: "destructive"
      });
    }
  };

  const acceptFriendRequest = async (request: FriendRequest) => {
    setIsLoading(true);
    try {
      // Update friendship status
      await db.update("friendships", 
        { user_id: `eq.${request.from_user_id}`, friend_id: `eq.${currentUserId}` }, 
        { status: 'accepted' }
      );

      await db.update("friendships", 
        { user_id: `eq.${currentUserId}`, friend_id: `eq.${request.from_user_id}` }, 
        { status: 'accepted' }
      );

      // Update friend request status
      await db.update("friend_requests", { _row_id: `eq.${request._row_id}` }, { status: 'accepted' });

      // Remove from incoming requests
      setIncomingRequests(prev => prev.filter(req => req._row_id !== request._row_id));
      
      toast({
        title: "Friend Request Accepted",
        description: `You are now friends with ${request.profile?.display_name || request.profile?.username || 'User'}!`
      });
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast({
        title: "Error",
        description: "Failed to accept friend request.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const declineFriendRequest = async (request: FriendRequest) => {
    setIsLoading(true);
    try {
      // Update friendship status
      await db.update("friendships", 
        { user_id: `eq.${request.from_user_id}`, friend_id: `eq.${currentUserId}` }, 
        { status: 'declined' }
      );

      await db.update("friendships", 
        { user_id: `eq.${currentUserId}`, friend_id: `eq.${request.from_user_id}` }, 
        { status: 'declined' }
      );

      // Update friend request status
      await db.update("friend_requests", { _row_id: `eq.${request._row_id}` }, { status: 'declined' });

      // Remove from incoming requests
      setIncomingRequests(prev => prev.filter(req => req._row_id !== request._row_id));
      
      toast({
        title: "Friend Request Declined",
        description: "The friend request has been declined."
      });
    } catch (error) {
      console.error('Error declining friend request:', error);
      toast({
        title: "Error",
        description: "Failed to decline friend request.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const cancelFriendRequest = async (request: FriendRequest) => {
    setIsLoading(true);
    try {
      // Delete friendship entries
      await db.delete("friendships", { user_id: `eq.${currentUserId}`, friend_id: `eq.${request.to_user_id}` });
      await db.delete("friendships", { user_id: `eq.${request.to_user_id}`, friend_id: `eq.${currentUserId}` });

      // Update friend request status
      await db.update("friend_requests", { _row_id: `eq.${request._row_id}` }, { status: 'cancelled' });

      // Remove from outgoing requests
      setOutgoingRequests(prev => prev.filter(req => req._row_id !== request._row_id));
      
      toast({
        title: "Friend Request Cancelled",
        description: "Your friend request has been cancelled."
      });
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      toast({
        title: "Error",
        description: "Failed to cancel friend request.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string, lastSeen: number) => {
    if (status === 'online') return 'bg-green-500';
    if (status === 'away') return 'bg-yellow-500';
    if (status === 'busy') return 'bg-red-500';
    
    const lastSeenMinutes = (Date.now() - lastSeen) / (1000 * 60);
    if (lastSeenMinutes < 5) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Friend Requests
              </h2>
              <Badge variant="secondary">
                {incomingRequests.length + outgoingRequests.length}
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Incoming Requests */}
          {incomingRequests.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-green-500" />
                <span>Incoming Requests ({incomingRequests.length})</span>
              </h3>
              <div className="space-y-3">
                {incomingRequests.map((request) => (
                  <Card key={request._row_id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={request.profile?.avatar_url} />
                              <AvatarFallback>
                                {request.profile?.display_name?.[0]?.toUpperCase() || 
                                 request.profile?.username?.[0]?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor(
                              request.profile?.status || 'offline',
                              request.profile?.last_seen || 0
                            )} rounded-full border-2 border-white dark:border-gray-900`} />
                          </div>
                          <div className="flex-1">
                            <button
                              onClick={() => onProfileClick(request.from_user_id, request.profile?.username || 'Unknown')}
                              className="text-left hover:underline"
                            >
                              <p className="font-semibold">
                                {request.profile?.display_name || request.profile?.username || 'Unknown User'}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                @{request.profile?.username || 'unknown'}
                              </p>
                            </button>
                            {request.message && (
                              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">
                                "{request.message}"
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              {formatRelativeTime(request.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            onClick={() => acceptFriendRequest(request)}
                            disabled={isLoading}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => declineFriendRequest(request)}
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Outgoing Requests */}
          {outgoingRequests.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                <Clock className="w-5 h-5 text-yellow-500" />
                <span>Sent Requests ({outgoingRequests.length})</span>
              </h3>
              <div className="space-y-3">
                {outgoingRequests.map((request) => (
                  <Card key={request._row_id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="relative">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={request.profile?.avatar_url} />
                              <AvatarFallback>
                                {request.profile?.display_name?.[0]?.toUpperCase() || 
                                 request.profile?.username?.[0]?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor(
                              request.profile?.status || 'offline',
                              request.profile?.last_seen || 0
                            )} rounded-full border-2 border-white dark:border-gray-900`} />
                          </div>
                          <div className="flex-1">
                            <button
                              onClick={() => onProfileClick(request.to_user_id, request.profile?.username || 'Unknown')}
                              className="text-left hover:underline"
                            >
                              <p className="font-semibold">
                                {request.profile?.display_name || request.profile?.username || 'Unknown User'}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                @{request.profile?.username || 'unknown'}
                              </p>
                            </button>
                            {request.message && (
                              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 italic">
                                "{request.message}"
                              </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              Sent {formatRelativeTime(request.created_at)}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelFriendRequest(request)}
                          disabled={isLoading}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* No Requests */}
          {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
            <div className="text-center py-8">
              <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Friend Requests
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You don't have any pending friend requests at the moment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendRequests;