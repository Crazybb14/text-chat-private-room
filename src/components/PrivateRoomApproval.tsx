import React, { useState, useEffect } from "react";
import { User, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";

interface RoomRequest {
  _row_id: number;
  room_id: number;
  requester_username: string;
  requester_device_id: string;
  creator_device_id: string;
  status: string;
  created_at: number;
  processed_at: number | null;
  message: string | null;
}

interface PrivateRoomApprovalProps {
  roomId: number;
  roomCreatorId: string;
}

const PrivateRoomApproval = ({ roomId, roomCreatorId }: PrivateRoomApprovalProps) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<RoomRequest[]>([]);
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    const loadRequests = async () => {
      try {
        const data = await db.query("private_room_requests", {
          room_id: `eq.${roomId}`,
          creator_device_id: `eq.${roomCreatorId}`,
          status: "eq.pending",
          order: "_created_at.desc"
        });
        setRequests(data);
      } catch (error) {
        console.error("Error loading requests:", error);
      }
    };

    loadRequests();
    const interval = setInterval(loadRequests, 3000);
    return () => clearInterval(interval);
  }, [roomId, roomCreatorId]);

  const handleApprove = async (requestId: number) => {
    setProcessing(requestId);
    try {
      const request = requests.find(r => r._row_id === requestId);
      if (!request) return;

      await db.update("private_room_requests", { _row_id: `eq.${requestId}` }, {
        status: "approved",
        processed_at: Date.now(),
        message: "Approved by room creator"
      });

      // Add the user to the room's allowed users list
      await db.insert("room_allowed_users", {
        room_id: roomId,
        username: request.requester_username,
        device_id: request.requester_device_id,
        added_by: roomCreatorId
      });

      setRequests(requests.filter(r => r._row_id !== requestId));
      toast({
        title: "✅ Request Approved",
        description: `${request.requester_username} can now join the room`,
      });
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: "❌ Error",
        description: "Failed to approve request",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: number) => {
    setProcessing(requestId);
    try {
      const request = requests.find(r => r._row_id === requestId);
      if (!request) return;

      await db.update("private_room_requests", { _row_id: `eq.${requestId}` }, {
        status: "rejected",
        processed_at: Date.now(),
        message: "Rejected by room creator"
      });

      setRequests(requests.filter(r => r._row_id !== requestId));
      toast({
        title: "❌ Request Rejected",
        description: `${request.requester_username} was denied access`,
      });
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: "❌ Error",
        description: "Failed to reject request",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm space-y-2">
      {requests.map((request) => (
        <Card key={request._row_id} className="bg-yellow-50 border-yellow-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4" />
              {request.requester_username}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(request._created_at)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">
              Wants to join this private room
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(request._row_id)}
                disabled={processing === request._row_id}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleReject(request._row_id)}
                disabled={processing === request._row_id}
              >
                <X className="w-4 h-4 mr-1" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PrivateRoomApproval;