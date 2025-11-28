import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Ban, Clock, User, MessageSquare, Calendar, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import RealTimePushNotifications from "@/lib/realTimePushNotifications";
import UserManager from "@/lib/userManagement";

interface BanManagerProps {
  onBan: (username: string, duration?: number, reason?: string) => void;
  onUnban: (device_id: string) => void;
  onDeleteBan: (device_id: string) => void;
  bans: Array<{
    _row_id: number;
    username: string;
    device_id: string;
    ip_address: string | null;
    ban_duration: number;
    ban_reason: string;
    message_content: string | null;
    created_at: number;
    expires_at: number | null;
    room_id: number | null;
  }>;
}

const BanManager = ({ onBan, onUnban, onDeleteBan, bans }: BanManagerProps) => {
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    _row_id: number;
    username: string;
    device_id: string;
    ip_address: string | null;
    first_seen: number;
    last_active: number;
  } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("3600");
  const [customDuration, setCustomDuration] = useState("");
  const [banMessage, setBanMessage] = useState("");
  const { toast } = useToast();

  const durationOptions = [
    { value: "900", label: "15 minutes", seconds: 900 },
    { value: "1800", label: "30 minutes", seconds: 1800 },
    { value: "3600", label: "1 hour", seconds: 3600 },
    { value: "86400", label: "1 day", seconds: 86400 },
    { value: "604800", label: "1 week", seconds: 604800 },
    { value: "0", label: "Permanent", seconds: 0 },
  ];

  const handleBan = async () => {
    if (!userInfo) return;
    
    const duration = banDuration === "custom" ? parseInt(customDuration) * 3600 : parseInt(banDuration);
    if (isNaN(duration) || duration < 0) {
      toast({
        title: "Invalid duration",
        description: "Please enter a valid duration in hours",
        variant: "destructive",
      });
      return;
    }

    try {
      const now = Date.now();
      const expiresAt = duration === 0 ? null : now + (duration * 1000);
      
      // Get user's recent messages for context
      const recentMessages = await db.query("messages", {
        sender_name: `eq.${userInfo.username}`,
        order: "_created_at.desc",
        limit: 10
      });

      // Create ban record
      await db.insert("bans", {
        username: userInfo.username,
        device_id: userInfo.device_id,
        ip_address: userInfo.ip_address,
        ban_duration: duration,
        ban_reason: banReason || "Banned by administrator",
        message_content: recentMessages.map((m: { content: string }) => m.content).join("\n"),
        created_at: now,
        expires_at: expiresAt,
        room_id: null, // Global ban
      });

      // Send push notification to banned user
      await RealTimePushNotifications.sendBanNotification(userInfo.device_id, {
        username: userInfo.username,
        reason: banReason || "Banned by administrator",
        duration: duration,
        message: recentMessages.map(m => m.content).join("\n")
      });

      toast({
        title: "User banned",
        description: `${userInfo.username} has been banned for ${duration === 0 ? "permanently" : `${duration/3600} hours`}`,
      });

      onBan(userInfo.username, duration, banReason);
      setShowBanDialog(false);
      setUserInfo(null);
      setBanReason("");
      setBanMessage("");
    } catch (error) {
      console.error("Error banning user:", error);
      toast({
        title: "Ban failed",
        description: "Unable to ban user",
        variant: "destructive",
      });
    }
  };

  const formatBanDuration = (duration: number | null) => {
    if (!duration || duration === 0) return "Permanent";
    
    const hours = duration / 3600;
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  };

  const getBanStatus = (expiresAt: number | null) => {
    if (!expiresAt) return { text: "Active", badge: "destructive" };
    
    const now = Date.now();
    if (expiresAt > now) {
      const remaining = Math.floor((expiresAt - now) / 3600000);
      return { 
        text: `Expires in ${remaining}h`, 
        badge: remaining < 1 ? "destructive" : "secondary" 
      };
    }
    
    return { text: "Expired", badge: "outline" };
  };

  const viewUserMessages = async (deviceId: string) => {
    try {
      const deviceUsers = await db.query("users", { device_id: `eq.${deviceId}` });
      if (deviceUsers.length > 0) {
        const messages = await db.query("messages", {
          sender_name: `eq.${deviceUsers[0].username}`,
          order: "_created_at.desc",
          limit: 20
        });
        
        // Show messages in a dialog or modal
        alert(`Recent messages from ${deviceUsers[0].username}:\n\n${messages.slice(0, 5).map(m => `[${new Date(m._created_at).toLocaleTimeString()}] ${m.content}`).join('\n\n')}`);
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-400" />
              Ban Management
            </div>
            <Button
              onClick={() => setShowBanDialog(true)}
              className="bg-red-600 hover:bg-red-700"
            >
              <Ban className="w-4 h-4 mr-2" />
              Ban User
            </Button>
          </CardTitle>
          <CardDescription>
            Manage user bans with time-based duration and automatic notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bans.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No active bans</p>
          ) : (
            <div className="space-y-3">
              {bans.map((ban, index) => {
                const status = getBanStatus(ban.expires_at);
                return (
                  <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium">{ban.username}</p>
                        <p className="text-sm text-muted-foreground">
                          Device: {ban.device_id?.substring(0, 20)}...
                          {ban.ip_address && ` • IP: ${ban.ip_address}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ban.ban_reason}
                          {ban.ban_duration !== undefined && ` • Duration: ${formatBanDuration(ban.ban_duration)}`}
                        </p>
                        {ban.created_at && (
                          <p className="text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            Banned: {new Date(ban.created_at * 1000).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant={status.badge as "default" | "secondary" | "destructive" | "outline"}>
                        {status.text}
                      </Badge>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => viewUserMessages(ban.device_id)}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUnban(ban.device_id)}
                      >
                        Unban
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteBan(ban.device_id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {showBanDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Ban User</CardTitle>
              <CardDescription>
                Enter the username and select ban duration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter username to ban"
                  onBlur={async (e) => {
                    const username = e.target.value.trim();
                    if (username) {
                      try {
                        const users = await db.query("users", { username: `eq.${username.toLowerCase()}` });
                        setUserInfo(users.length > 0 ? users[0] : null);
                      } catch (error) {
                        setUserInfo(null);
                      }
                    }
                  }}
                />
                {userInfo && (
                  <p className="text-sm text-green-400 mt-1">
                    Found user: {userInfo.username} (Device: {userInfo.device_id?.substring(0, 20)}...)
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="duration">Ban Duration</Label>
                <Select value={banDuration} onValueChange={setBanDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {durationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom (hours)</SelectItem>
                  </SelectContent>
                </Select>
                
                {banDuration === "custom" && (
                  <div className="mt-2">
                    <Label htmlFor="custom">Hours</Label>
                    <Input
                      id="custom"
                      type="number"
                      min="1"
                      max="8760"
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      placeholder="Enter hours"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="reason">Ban Reason</Label>
                <Textarea
                  id="reason"
                  placeholder="Reason for ban (will be shown to user)"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="message">Message Context (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="What the user said or did (will be shown to user)"
                  value={banMessage}
                  onChange={(e) => setBanMessage(e.target.value)}
                />
              </div>

              <Alert>
                <AlertDescription>
                  The user will receive a push notification with the ban reason and duration.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowBanDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBan}
                  disabled={!userInfo}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Ban User
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BanManager;