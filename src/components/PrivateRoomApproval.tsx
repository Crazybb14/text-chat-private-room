import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, UserX, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/shared/kliv-database";
import { auth } from "@/lib/shared/kliv-auth";

interface PrivateRoomApprovalProps {
  roomId: number;
  roomName: string;
  onClose: () => void;
}

interface JoinRequest {
  _row_id: number;
  room_id: number;
  requester_username: string;
  requester_device_id: string;
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
  processed_at?: string;
}

export const PrivateRoomApproval: React.FC<PrivateRoomApprovalProps> = ({
  roomId,
  roomName,
  onClose
}) => {
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [roomOwner, setRoomOwner] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkRoomOwner();
    loadJoinRequests();
    const interval = setInterval(loadJoinRequests, 3000);
    return () => clearInterval(interval);
  }, [roomId]);

  const checkRoomOwner = async () => {
    try {
      const user = await auth.getUser();
      if (!user) return;

      const rooms = await db.query("rooms", { _row_id: `eq.${roomId}` });
      if (rooms.length > 0) {
        const room = rooms[0];
        setRoomOwner(room.created_by === user.user_id);
      }
    } catch (error) {
      console.error("Error checking room ownership:", error);
    }
  };

  const loadJoinRequests = async () => {
    try {
      const { data: requests } = await db.query('private_room_requests', {
        room_id: `eq.${roomId}`,
        status: 'eq.pending'
      });

      setJoinRequests(requests || []);
    } catch (error) {
      console.error("Error loading join requests:", error);
    }
  };

  const handleApprove = async (requestId: number) => {
    try {
      setIsLoading(true);
      
      await db.update('private_room_requests', { _row_id: `eq.${requestId}` }, {
        status: 'approved',
        processed_at: new Date().toISOString(),
        message: 'Request approved by room owner'
      });

      toast({
        title: "Request Approved",
        description: "User has been granted access to the room",
      });

      loadJoinRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      setIsLoading(true);
      
      await db.update('private_room_requests', { _row_id: `eq.${requestId}` }, {
        status: 'rejected',
        processed_at: new Date().toISOString(),
        message: 'Request denied by room owner'
      });

      toast({
        title: "Request Rejected",
        description: "User has been denied access to the room",
      });

      loadJoinRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!roomOwner) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Room Access Requests - {roomName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {joinRequests.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No pending requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {joinRequests.map((request) => (
                <Card key={request._row_id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{request.requester_username}</p>
                        <Badge variant="secondary" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          Waiting
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Device ID: {request.requester_device_id.slice(0, 8)}...
                      </p>
                      {request.message && (
                        <p className="text-sm text-muted-foreground mt-1">{request.message}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(request._row_id)}
                        disabled={isLoading}
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(request._row_id)}
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <UserX className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};