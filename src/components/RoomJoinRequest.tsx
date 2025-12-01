import React, { useState, useEffect } from "react";
import { Lock, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";
import UserManager from "@/lib/userManagement";

interface RoomJoinRequestProps {
  roomId: number;
  roomCode: string;
  onRequestSubmitted: () => void;
}

const RoomJoinRequest = ({ roomId, roomCode, onRequestSubmitted }: RoomJoinRequestProps) => {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    checkExistingRequest();
  }, [roomId]);

  const checkExistingRequest = async () => {
    try {
      const username = await UserManager.getUsername();
      const deviceId = getDeviceId();
      
      const existing = await db.query("private_room_requests", {
        room_id: `eq.${roomId}`,
        requester_device_id: `eq.${deviceId}`,
        status: "eq.pending"
      });

      if (existing.length > 0) {
        setExistingRequest(existing[0]);
      }
    } catch (error) {
      console.error("Error checking existing request:", error);
    }
  };

  const handleSubmitRequest = async () => {
    if (!message.trim()) {
      toast({
        title: "❌ Message Required",
        description: "Please provide a message to the room creator",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const username = await UserManager.getUsername();
      const deviceId = getDeviceId();

      // Get room details to find creator
      const roomData = await db.query("rooms", { _row_id: `eq.${roomId}` });
      if (roomData.length === 0) {
        throw new Error("Room not found");
      }

      const room = roomData[0];
      const creatorDeviceId = room.created_by || deviceId; // Fallback if not set

      await db.insert("private_room_requests", {
        room_id: roomId,
        requester_username: username,
        requester_device_id: deviceId,
        creator_device_id: creatorDeviceId,
        status: "pending",
        message: message.trim()
      });

      // Log IP activity
      try {
        await db.insert("ip_activity_logs", {
          device_id: deviceId,
          username: username,
          action: "room_join_request",
          room_id: roomId,
          message_preview: message.substring(0, 50),
        });
      } catch (logErr) {
        console.log("IP log failed:", logErr);
      }

      setExistingRequest({ status: "pending" });
      onRequestSubmitted();
      toast({
        title: "📤 Request Sent",
        description: "Your request has been sent to the room creator. Please wait for approval.",
      });
    } catch (error) {
      console.error("Error submitting request:", error);
      toast({
        title: "❌ Error",
        description: "Failed to submit join request",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (existingRequest) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 mx-auto text-yellow-600 mb-2" />
            <CardTitle className="text-xl">Request Pending</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Your request to join this private room is currently pending approval from the room creator.
            </p>
            {existingRequest._created_at && (
              <p className="text-sm text-muted-foreground">
                Requested at: {formatTime(existingRequest._created_at)}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              You'll be notified once the request is approved or rejected.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Lock className="w-12 h-12 mx-auto text-yellow-600 mb-2" />
          <CardTitle className="text-xl">Request to Join Private Room</CardTitle>
          <p className="text-sm text-muted-foreground">
            Room Code: {roomCode}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Message to Room Creator
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Introduce yourself and explain why you'd like to join this private room..."
                className="min-h-[100px]"
              />
            </div>
            <Button
              onClick={handleSubmitRequest}
              disabled={isSubmitting || !message.trim()}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Sending Request...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Join Request
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              The room creator will review your request and approve or deny access.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoomJoinRequest;