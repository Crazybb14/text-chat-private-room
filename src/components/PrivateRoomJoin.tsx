import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Lock, Users, X, Check, Clock, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/shared/kliv-database";
import { auth } from "@/lib/shared/kliv-auth";
import { FriendManager } from "@/lib/friendSystem";

interface Friend {
  user_id: string;
  username: string;
  display_name?: string;
  status?: string;
  last_seen?: number;
}

interface PrivateRoomJoinProps {
  roomCode: string;
  onSuccess: (roomId: number) => void;
  onCancel: () => void;
}

interface Room {
  _row_id: number;
  name: string;
  code: string;
  type: string;
  created_by: string;
}

export const PrivateRoomJoin: React.FC<PrivateRoomJoinProps> = ({
  roomCode,
  onSuccess,
  onCancel
}) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [checkingRequest, setCheckingRequest] = useState(false);
  const [showFriendJoin, setShowFriendJoin] = useState(false);
  const [userFriends, setUserFriends] = useState<Friend[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    findRoom();
    loadFriends();
    
    // Check for existing request status
    const interval = setInterval(checkRequestStatus, 3000);
    return () => clearInterval(interval);
  }, [roomCode]);

  const findRoom = async () => {
    try {
      const rooms = await db.query("rooms", { code: `eq.${roomCode}` });
      if (rooms.length > 0) {
        setRoom(rooms[0]);
      }
    } catch (error) {
      console.error("Error finding room:", error);
    }
  };

  const loadFriends = async () => {
    try {
      const friends = await FriendManager.getFriends();
      setUserFriends(friends);
    } catch (error) {
      console.error("Error loading friends:", error);
    }
  };

  const checkRequestStatus = async () => {
    if (!requestSent || !room) return;
    
    try {
      const user = await auth.getUser();
      if (!user) return;

      const { data: requests } = await db.query('private_room_requests', {
        room_id: `eq.${room._row_id}`,
        requester_device_id: `eq.${user.user_id}`,
        status: 'eq.approved'
      });

      if (requests && requests.length > 0) {
        setRequestStatus('approved');
        setTimeout(() => {
          onSuccess(room!._row_id);
        }, 1500);
      }
    } catch (error) {
      console.error("Error checking request status:", error);
    }
  };

  const sendJoinRequest = async () => {
    if (!room) return;

    setIsLoading(true);
    try {
      const user = await auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if user is already a member
      const { data: existingMembers } = await db.query('room_members', {
        room_id: `eq.${room._row_id}`,
        user_id: `eq.${user.user_id}`
      });

      if (existingMembers && existingMembers.length > 0) {
        onSuccess(room._row_id);
        return;
      }

      // Check if request already exists
      const { data: existingRequests } = await db.query('private_room_requests', {
        room_id: `eq.${room._row_id}`,
        requester_device_id: `eq.${user.user_id}`,
        status: 'eq.pending'
      });

      if (existingRequests && existingRequests.length > 0) {
        setRequestSent(true);
        toast({
          title: "Request Already Sent",
          description: "Your join request is pending approval",
        });
        return;
      }
// Send join request
      await db.insert('private_room_requests', {
        room_id: room._row_id,
        requester_username: user.email || 'Unknown User',
        requester_device_id: user.user_id,
        status: 'pending',
        message: `Request to join private room: ${room.name}`
      });

      setRequestSent(true);
      toast({
        title: "Request Sent",
        description: "Your join request has been sent to the room owner",
      });
    } catch (error) {
      console.error("Error sending join request:", error);
      toast({
        title: "Error",
        description: "Failed to send join request",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const tryDirectJoin = async () => {
    if (!room) return;

    setIsLoading(true);
    try {
      const user = await auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if user is friends with room owner
      const isFriend = await FriendManager.areFriends(user.user_id, room.created_by);
      
      if (isFriend) {
        // Friends can join directly without approval
        await db.insert('room_members', {
          room_id: room._row_id,
          user_id: user.user_id,
          username: user.email || 'Unknown User',
          is_private_room: 1
        });

        toast({
          title: "Welcome!",
          description: "Joined as friend of room owner",
        });
        
        onSuccess(room._row_id);
      } else {
        toast({
          title: "Not a Friend",
          description: "You can only join directly if you're friends with the room owner",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error joining room:", error);
      toast({
        title: "Error",
        description: "Failed to join room",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!room) {
    return (
      <Dialog open={true} onOpenChange={onCancel}>
        <DialogContent className="max-w-md">
          <div className="text-center py-6">
            <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Room Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The room code "{roomCode}" is not valid or the room doesn't exist.
            </p>
            <Button onClick={onCancel} variant="outline">
              Go Back
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Private Room - {room.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Room Info */}
          <Card className="bg-purple-500/10 border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Room Code</span>
                <Badge variant="secondary">{room.code}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                Private room - Owner approval required
              </div>
            </CardContent>
          </Card>

          {/* Request Status */}
          {requestStatus === 'approved' && (
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="p-4 text-center">
                <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <h4 className="font-semibold text-green-600">Request Approved!</h4>
                <p className="text-sm text-muted-foreground">Entering room...</p>
              </CardContent>
            </Card>
          )}

          {requestSent && requestStatus !== 'approved' && (
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="font-medium text-yellow-600">Request Pending</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your join request has been sent to the room owner. Waiting for approval...
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This will automatically update when the owner responds.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {!requestSent && requestStatus !== 'approved' && (
            <div className="space-y-3">
              {/* Check if user is friend of owner */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm font-medium text-blue-600 mb-1">
                  Friends of the room owner can join instantly
                </p>
                <Button
                  onClick={tryDirectJoin}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  variant="outline"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Try Direct Join (Friend Access)
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={sendJoinRequest}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Sending..." : "Request Access"}
                </Button>
                <Button
                  onClick={onCancel}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Room owner will be notified of your request</p>
            <p>• Approval is required to join this private room</p>
            <p>• This window will automatically update when approved</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};