import React, { useState } from "react";
import { Bell, Users, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface Ban {
  _row_id: number;
  username: string;
  device_id: string | null;
  _created_at: number;
}

interface AdminNotificationSystemProps {
  bans: Ban[];
  onBanUserClick: (username: string) => void;
}

const AdminNotificationSystem = ({ bans, onBanUserClick }: AdminNotificationSystemProps) => {
  const { toast } = useToast();
  const [notificationType, setNotificationType] = useState<"general" | "user">("general");
  const [targetUsername, setTargetUsername] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const userDevices = bans.reduce((acc: Record<string, string[]>, ban) => {
    if (ban.device_id && ban.username) {
      if (!acc[ban.username]) {
        acc[ban.username] = [];
      }
      if (!acc[ban.username].includes(ban.device_id)) {
        acc[ban.username].push(ban.device_id);
      }
    }
    return acc;
  }, {});

  const sendNotification = async () => {
    if (!message.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a notification message",
        variant: "destructive",
      });
      return;
    }

    if (notificationType === "user" && !targetUsername.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a target username",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      if (notificationType === "user") {
        // Send to specific user's devices
        const devices = userDevices[targetUsername] || [];
        
        for (const deviceId of devices) {
          await db.insert("notifications", {
            type: "user_notification",
            message: message.trim(),
            recipient_device_id: deviceId,
            is_read: 0,
            created_by_admin: 1,
          });
        }

        if (devices.length === 0) {
          toast({
            title: "No device found",
            description: "User has no devices with known IDs",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Notification sent",
            description: `Message sent to ${targetUsername} (${devices.length} device(s))`,
          });
        }
      } else {
        // Send general announcement (no specific device)
        // In a real system, this would go to all connected users
        await db.insert("notifications", {
          type: "general_announcement",
          message: message.trim(),
          recipient_device_id: null,
          is_read: 0,
          created_by_admin: 1,
        });

        toast({
          title: "Announcement saved",
          description: "General announcement has been created",
        });
      }

      setMessage("");
      setTargetUsername("");
    } catch (error) {
      console.log("Error sending notification:", error);
      toast({
        title: "Error",
        description: "Failed to send notification",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const banWithNotification = async (username: string) => {
    if (!message.trim()) {
      // Just ban user normally
      onBanUserClick(username);
      return;
    }

    setIsSending(true);
    try {
      // First ban the user
      onBanUserClick(username);
      
      // Then send notification to their devices
      const devices = userDevices[username] || [];
      
      for (const deviceId of devices) {
        await db.insert("notifications", {
          type: "ban_notification",
          message: `You have been banned: ${message.trim()}`,
          recipient_device_id: deviceId,
          is_read: 0,
          created_by_admin: 1,
        });
      }

      toast({
        title: "User banned and notified",
        description: `${username} has been banned and sent a notification`,
      });
      
      setMessage("");
    } catch (error) {
      console.log("Error banning with notification:", error);
      toast({
        title: "Error",
        description: "Failed to complete ban with notification",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Form */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-yellow-400" />
            Send Notifications
          </CardTitle>
          <CardDescription>
            Send notifications to specific users or create general announcements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={notificationType} onValueChange={(value: "general" | "user") => setNotificationType(value)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General Announcement</SelectItem>
                <SelectItem value="user">Specific User</SelectItem>
              </SelectContent>
            </Select>
            
            {notificationType === "user" && (
              <Input
                placeholder="Username"
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                className="flex-1 bg-secondary/50 border-white/10"
              />
            )}
          </div>
          
          <Textarea
            placeholder="Enter notification message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="bg-secondary/50 border-white/10 min-h-[100px] resize-none"
          />
          
          <Button
            onClick={sendNotification}
            disabled={isSending}
            className="w-full bg-yellow-600 hover:bg-yellow-700"
          >
            {isSending ? (
              "Sending..."
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send {notificationType === "general" ? "Announcement" : "Message"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Ban with Message */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-red-400" />
            Ban with Message
          </CardTitle>
          <CardDescription>
            Ban a user and send them a notification explaining the reason
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Username to ban"
            value={targetUsername}
            onChange={(e) => setTargetUsername(e.target.value)}
            className="bg-secondary/50 border-white/10"
          />
          
          <Textarea
            placeholder="Reason for ban (will be sent as notification)..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="bg-secondary/50 border-white/10 min-h-[80px] resize-none"
          />
          
          <Button
            onClick={() => banWithNotification(targetUsername)}
            disabled={isSending || !targetUsername.trim()}
            className="w-full bg-red-600 hover:bg-red-700"
          >
            {isSending ? (
              "Processing..."
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Ban & Notify User
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNotificationSystem;