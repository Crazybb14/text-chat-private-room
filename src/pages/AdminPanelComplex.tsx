import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import auth from "@/lib/shared/kliv-auth.js";
import BanWordManager from "@/components/BanWordManager";
import AdminReportsList from "@/components/AdminReportsList";
import AdminAPIManager from "@/components/AdminAPIManager";
import EnhancedIPLogger from "@/components/EnhancedIPLogger";
import WorkingAdminBiometric from "@/components/WorkingAdminBiometric";
import AdminControlPanel from "@/components/AdminControlPanel";
import AdminSecurityPanel from "@/components/AdminSecurityPanel";
import AdminUserManagement from "@/components/AdminUserManagement";
import AdminFileModeration from "@/components/AdminFileModeration";
import AdminMessageFiltering from "@/components/AdminMessageFiltering";
import AdminAnalytics from "@/components/AdminAnalytics";
import AdminSettings from "@/components/AdminSettings";

interface Room {
  _row_id: number;
  name: string;
  type: string;
  code?: string;
  _created_at: number;
}

interface Message {
  _row_id: number;
  content: string;
  sender_name: string;
  room_id: number;
  device_id: string;
  _created_at: number;
}

interface Ban {
  _row_id: number;
  username: string;
  device_id: string;
  ban_reason: string;
  _created_at: number;
}

export default function AdminPanel() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [banUsername, setBanUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [showBiometric, setShowBiometric] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [roomsData, messagesData, bansData] = await Promise.all([
        db.query("rooms", { order: "_created_at.desc" }),
        db.query("messages", { order: "_created_at.desc", limit: 100 }),
        db.query("bans", { order: "_created_at.desc" })
      ]);
      
      setRooms(roomsData || []);
      setMessages(messagesData || []);
      setBans(bansData || []);
    } catch (error) {
      console.log("Error loading admin data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check biometric authentication status
    const biometricEnabled = localStorage.getItem('admin_biometric_enabled');
    const biometricTemplate = localStorage.getItem('admin_biometric_template');
    
    if (biometricEnabled === 'true' && biometricTemplate) {
      setShowBiometric(true);
    } else {
      setIsAuthenticated(true); // No biometric setup required
      loadData();
    }
    
    const interval = setInterval(() => {
      if (isAuthenticated) {
        loadData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData, isAuthenticated]);

  const handleBiometricComplete = () => {
    setIsAuthenticated(true);
    setShowBiometric(false);
    loadData();
    toast({
      title: "Authentication Successful",
      description: "Welcome to the Admin Panel",
    });
    // Redirect to /admin/panel 
    navigate('/admin/panel');
  };

  const handleBiometricCancel = () => {
    navigate("/admin");
  };

  const handleBanUser = async () => {
    if (!banUsername.trim()) {
      return;
    }
    
    try {
      const userMessages = await db.query("messages", { 
        sender_name: `eq.${banUsername}`, 
        order: "_created_at.desc", 
      });
      
      const deviceId = userMessages.length > 0 ? userMessages[0].device_id : null;
      
      await db.insert("bans", { 
        username: banUsername,
        device_id: deviceId,
        room_id: null,
        ban_reason: "Banned by admin"
      });
      
      toast({
        title: "User banned",
        description: `${banUsername} has been banned from all rooms`,
      });
      
      setBanUsername("");
      loadData();
    } catch (error) {
      console.log("Error banning user:", error);
      toast({
        title: "Error",
        description: "Failed to ban user",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await db.delete("messages", { _row_id: `eq.${messageId}` });
      toast({ title: "Message deleted" });
      loadData();
    } catch (error) {
      console.log("Error deleting message:", error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoom = async (roomId: number) => {
    try {
      await db.delete("rooms", { _row_id: `eq.${roomId}` });
      toast({ title: "Room deleted" });
      loadData();
    } catch (error) {
      console.log("Error deleting room:", error);
      toast({
        title: "Error",
        description: "Failed to delete room",
        variant: "destructive",
      });
    }
  };

  const handleUnbanUser = async (banId: number) => {
    try {
      await db.delete("bans", { _row_id: `eq.${banId}` });
      toast({ title: "User unbanned" });
      loadData();
    } catch (error) {
      console.log("Error unbanning user:", error);
      toast({
        title: "Error",
        description: "Failed to unban user",
        variant: "destructive",
      });
    }
  };

// Show biometric authentication if required
  if (showBiometric) {
    return (
      <WorkingAdminBiometric 
        open={showBiometric}
        onComplete={handleBiometricComplete}
        onCancel={handleBiometricCancel}
        isSetup={false}
      />
    );
  }
  // Show loading while checking authentication
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Verifying administrator access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              Back to Chat
            </Button>
            <Button variant="outline" onClick={() => setShowBiometric(true)}>
              Re-authenticate
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 lg:grid-cols-12">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="bans">Bans</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="filtering">Filtering</TabsTrigger>
            <TabsTrigger value="ip-logger">IP Logger</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AdminControlPanel />
          </TabsContent>

          <TabsContent value="rooms">
            <Card>
              <CardHeader>
                <CardTitle>Chat Rooms</CardTitle>
                <CardDescription>Manage all chat rooms</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p>Loading rooms...</p>
                ) : (
                  <div className="space-y-4">
                    {rooms.map((room) => (
                      <div key={room._row_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-semibold">{room.name}</h3>
                          <p className="text-sm text-gray-500">
                            Type: {room.type} {room.code && `• Code: ${room.code}`}
                          </p>
                          <p className="text-xs text-gray-400">
                            Created: {new Date(room._created_at * 1000).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={room.type === "public" ? "default" : "secondary"}>
                            {room.type}
                          </Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteRoom(room._row_id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Recent Messages</CardTitle>
                <CardDescription>View and delete messages</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p>Loading messages...</p>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message._row_id} className="flex items-start justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-semibold">{message.sender_name}</p>
                          <p className="text-sm mt-1">{message.content}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            Room ID: {message.room_id} • {new Date(message._created_at * 1000).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteMessage(message._row_id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bans">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ban User</CardTitle>
                  <CardDescription>Ban a user from all rooms</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Username to ban..."
                      value={banUsername}
                      onChange={(e) => setBanUsername(e.target.value)}
                    />
                    <Button onClick={handleBanUser} disabled={!banUsername.trim()}>
                      Ban User
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Bans</CardTitle>
                  <CardDescription>Manage banned users</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p>Loading bans...</p>
                  ) : (
                    <div className="space-y-4">
                      {bans.map((ban) => (
                        <div key={ban._row_id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <h3 className="font-semibold">{ban.username}</h3>
                            <p className="text-sm text-gray-500">
                              Device ID: {ban.device_id || "Unknown"}
                            </p>
                            <p className="text-xs text-gray-400">
                              Banned: {new Date(ban._created_at * 1000).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnbanUser(ban._row_id)}
                          >
                            Unban
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <AdminUserManagement />
          </TabsContent>

          <TabsContent value="reports">
            <AdminReportsList />
          </TabsContent>

          <TabsContent value="files">
            <AdminFileModeration />
          </TabsContent>

          <TabsContent value="security">
            <AdminSecurityPanel />
          </TabsContent>

          <TabsContent value="filtering">
            <div className="space-y-6">
              <BanWordManager />
              <AdminMessageFiltering />
            </div>
          </TabsContent>

          <TabsContent value="ip-logger">
            <EnhancedIPLogger />
          </TabsContent>

          <TabsContent value="api-keys">
            <AdminAPIManager />
          </TabsContent>
<TabsContent value="api-keys">
            <AdminAPIManager />
          </TabsContent>

          <TabsContent value="analytics">
            <AdminAnalytics />
          </TabsContent>

          <TabsContent value="settings">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}