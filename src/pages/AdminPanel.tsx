import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, LogOut, MessageSquare, Ban, Plus, Lightbulb, Scale, Bell, FileText, AlertTriangle, Send, Zap, Settings, Image, MapPin, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import db from "@/lib/shared/kliv-database.js";
import { useToast } from "@/hooks/use-toast";
import AdminRoomCard from "@/components/AdminRoomCard";
import AdminMessageView from "@/components/AdminMessageView";
import AdminBanList from "@/components/AdminBanList";
import AdminSuggestionsList from "@/components/AdminSuggestionsList";
import AdminAppealsList from "@/components/AdminAppealsList";
import AdminNotificationSystem from "@/components/AdminNotificationSystem";
import AdminThreatMonitor from "@/components/AdminThreatMonitor";
import AdminFileModeration from "@/components/AdminFileModeration";
import AdminMessaging from "@/components/AdminMessaging";
import AdminQuickActions from "@/components/AdminQuickActions";
import AdminSettings from "@/components/AdminSettings";
import AdminFileApproval from "@/components/AdminFileApproval";
import AdminIPLogger from "@/components/AdminIPLogger";
import { BiometricAuth } from "@/components/BiometricAuth";
import ScheduledDowntime from "@/components/ScheduledDowntime";
import BanManager from "@/components/BanManager";

interface Room {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
  _created_at: number;
}

interface Message {
  _row_id: number;
  room_id: number;
  sender_name: string;
  content: string;
  is_ai: number;
  device_id: string | null;
  _created_at: number;
}

interface Ban {
  _row_id: number;
  username: string;
  device_id: string | null;
  room_id: number | null;
  _created_at: number;
}

interface Suggestion {
  _row_id: number;
  username: string;
  content: string;
  device_id: string | null;
  _created_at: number;
}

interface Appeal {
  _row_id: number;
  real_name: string;
  banned_username: string;
  reason: string;
  device_id: string | null;
  status: string;
  _created_at: number;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState<"public" | "private">("private");
  const [banUsername, setBanUsername] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCrashed, setIsCrashed] = useState(false);
  const [crashCountdown, setCrashCountdown] = useState(1);
  const [showBiometricAuth, setShowBiometricAuth] = useState(false);
  const [needsBiometricSetup, setNeedsBiometricSetup] = useState(false);

  // Listen for crash command (crashes admin too!)
  useEffect(() => {
    const handleCrash = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsCrashed(true);
      setCrashCountdown(Math.ceil(detail.duration / 1000));
      
      const countdownInterval = setInterval(() => {
        setCrashCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setIsCrashed(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    window.addEventListener('admin_crash', handleCrash);
    
    // Also listen to broadcast channel
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('admin_commands');
      channel.onmessage = (event) => {
        if (event.data.type === 'CRASH_ALL') {
          setIsCrashed(true);
          setCrashCountdown(Math.ceil(event.data.duration / 1000));
          
          setTimeout(() => {
            setIsCrashed(false);
          }, event.data.duration);
        }
      };
    }

    return () => {
      window.removeEventListener('admin_crash', handleCrash);
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [roomsData, bansData, suggestionsData, appealsData] = await Promise.all([
        db.query("rooms", { order: "_created_at.desc" }),
        db.query("bans", { order: "_created_at.desc" }),
        db.query("suggestions", { order: "_created_at.desc" }),
        db.query("appeals", { order: "_created_at.desc" }),
      ]);
      setRooms(roomsData);
      setBans(bansData);
      setSuggestions(suggestionsData);
      setAppeals(appealsData);
    } catch (error) {
      console.log("Error loading data:", error);
    }
  }, []);

  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin");
    if (!isAdmin) {
      navigate("/admin");
      return;
    }

    // Check if biometric is enabled (optional - user chose to enable it)
    const biometricEnabled = localStorage.getItem('admin_biometric_enabled');
    const hasTemplate = localStorage.getItem('admin_biometric_template');
    
    if (biometricEnabled === 'true' && hasTemplate) {
      // Only require biometric if user previously enabled it
      setShowBiometricAuth(true);
    } else {
      // Biometric not enabled - proceed normally without forcing setup
      loadData();
      
      // Set up real-time updates
      const interval = setInterval(loadData, 1000);
      return () => clearInterval(interval);
    }
  }, [navigate, loadData]);

  const loadRoomMessages = async (room: Room) => {
    setSelectedRoom(room);
    try {
      const msgs = await db.query("messages", {
        room_id: `eq.${room._row_id}`,
        order: "_created_at.desc",
      });
      setMessages(msgs);
    } catch (error) {
      console.log("Error loading messages:", error);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;

    try {
      const code = newRoomType === "private" 
        ? Math.floor(100000 + Math.random() * 900000).toString()
        : null;
      
      await db.insert("rooms", {
        name: newRoomName,
        code: code,
        type: newRoomType,
      });
      
      toast({
        title: "Room created!",
        description: code ? `Room code: ${code}` : "Public room created",
      });
      
      setNewRoomName("");
      setCreateDialogOpen(false);
      loadData();
    } catch (error) {
      console.log("Error creating room:", error);
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRoom = async (roomId: number) => {
    try {
      // Delete all messages in the room first
      const roomMessages = await db.query("messages", { room_id: `eq.${roomId}` });
      for (const msg of roomMessages) {
        await db.delete("messages", { _row_id: `eq.${msg._row_id}` });
      }
      
      // Delete the room
      await db.delete("rooms", { _row_id: `eq.${roomId}` });
      
      toast({
        title: "Room deleted",
        description: "The room and all its messages have been deleted",
      });
      
      if (selectedRoom?._row_id === roomId) {
        setSelectedRoom(null);
        setMessages([]);
      }
      
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

  const handleBanUser = async (usernameToban?: string) => {
    const targetUsername = usernameToban || banUsername;
    if (!targetUsername.trim()) return;

    try {
      // Look up the device ID from the user's messages
      const userMessages = await db.query("messages", { 
        sender_name: `eq.${targetUsername}`,
        order: "_created_at.desc"
      });
      
      const deviceId = userMessages.length > 0 ? userMessages[0].device_id : null;
      
      await db.insert("bans", {
        username: targetUsername,
        device_id: deviceId,
        room_id: null, // Global ban
      });
      
      toast({
        title: "User banned",
        description: deviceId 
          ? `${targetUsername} and their device have been banned from all rooms`
          : `${targetUsername} has been banned from all rooms`,
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

  const handleUnban = async (banId: number) => {
    try {
      await db.delete("bans", { _row_id: `eq.${banId}` });
      toast({
        title: "User unbanned",
        description: "The user can now chat again",
      });
      loadData();
    } catch (error) {
      console.log("Error unbanning user:", error);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await db.delete("messages", { _row_id: `eq.${messageId}` });
      toast({
        title: "Message deleted",
      });
      if (selectedRoom) {
        loadRoomMessages(selectedRoom);
      }
    } catch (error) {
      console.log("Error deleting message:", error);
    }
  };

  const handleDeleteSuggestion = async (id: number) => {
    try {
      await db.delete("suggestions", { _row_id: `eq.${id}` });
      toast({ title: "Suggestion deleted" });
      loadData();
    } catch (error) {
      console.log("Error deleting suggestion:", error);
    }
  };

  const handleApproveAppeal = async (appeal: Appeal) => {
    try {
      // Remove the ban for this device/user
      if (appeal.device_id) {
        const deviceBans = await db.query("bans", { device_id: `eq.${appeal.device_id}` });
        for (const ban of deviceBans) {
          await db.delete("bans", { _row_id: `eq.${ban._row_id}` });
        }
      }
      
      const userBans = await db.query("bans", { username: `eq.${appeal.banned_username}` });
      for (const ban of userBans) {
        await db.delete("bans", { _row_id: `eq.${ban._row_id}` });
      }
      
      // Update appeal status
      await db.update("appeals", { _row_id: `eq.${appeal._row_id}` }, { status: "approved" });
      
      toast({
        title: "Appeal approved",
        description: `${appeal.real_name} has been unbanned`,
      });
      loadData();
    } catch (error) {
      console.log("Error approving appeal:", error);
      toast({
        title: "Error",
        description: "Failed to approve appeal",
        variant: "destructive",
      });
    }
  };

  const handleDenyAppeal = async (id: number) => {
    try {
      await db.update("appeals", { _row_id: `eq.${id}` }, { status: "denied" });
      toast({ title: "Appeal denied" });
      loadData();
    } catch (error) {
      console.log("Error denying appeal:", error);
    }
  };

  const handleDeleteAppeal = async (id: number) => {
    try {
      await db.delete("appeals", { _row_id: `eq.${id}` });
      toast({ title: "Appeal deleted" });
      loadData();
    } catch (error) {
      console.log("Error deleting appeal:", error);
    }
  };

  const handleBiometricSuccess = () => {
    setShowBiometricAuth(false);
    setNeedsBiometricSetup(false);
    loadData();
    
    // Set up real-time updates after successful auth
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  };

  const handleBiometricCancel = () => {
    // Always allow cancel - biometric is optional
    setShowBiometricAuth(false);
    loadData();
  };

  const handleBiometricSkip = () => {
    // Skip biometric entirely
    setShowBiometricAuth(false);
    setNeedsBiometricSetup(false);
    loadData();
  };

  const handleLogout = () => {
    localStorage.removeItem("isAdmin");
    navigate("/admin");
  };

  // Crash screen for admin
  if (isCrashed) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/50 via-black to-red-900/50 animate-pulse" />
        <div className="absolute inset-0">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute h-1 bg-red-500/30"
              style={{
                top: `${Math.random() * 100}%`,
                left: 0,
                right: 0,
                animation: `glitch ${0.1 + Math.random() * 0.3}s infinite`
              }}
            />
          ))}
        </div>
        <div className="relative z-10 text-center">
          <div className="text-8xl mb-8 animate-bounce">💥</div>
          <h1 className="text-6xl font-bold text-red-500 mb-4 animate-pulse" style={{ textShadow: '0 0 20px rgba(239, 68, 68, 0.8)' }}>
            ADMIN CRASHED
          </h1>
          <p className="text-2xl text-red-400 mb-8">You crashed yourself!</p>
          <div className="text-9xl font-mono font-bold text-white mb-4">
            {crashCountdown}
          </div>
          <p className="text-xl text-gray-400">Reconnecting...</p>
        </div>
        <style>{`
          @keyframes glitch {
            0%, 100% { transform: translateX(0); opacity: 0.3; }
            50% { transform: translateX(10px); opacity: 0.7; }
          }
        `}</style>
      </div>
    );
  }

  // Biometric Authentication Overlay
  if (showBiometricAuth) {
    return (
      <BiometricAuth
        setupMode={needsBiometricSetup}
        onSuccess={handleBiometricSuccess}
        onCancel={handleBiometricCancel}
        onSkip={handleBiometricSkip}
        isOptional={true}
      />
    );
  }

  // Main Admin Panel
  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/10 via-background to-red-900/10 pointer-events-none" />

      {/* Header */}
      <header className="border-b border-white/10 p-4 relative z-10 bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/20">
              <Shield className="w-6 h-6 text-red-400" />
            </div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const hasTemplate = localStorage.getItem('admin_biometric_template');
                setNeedsBiometricSetup(!hasTemplate);
                setShowBiometricAuth(true);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Camera className="w-4 h-4 mr-2" />
              {localStorage.getItem('admin_biometric_template') ? 'Face ID' : 'Set Up Face ID'}
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-7xl mx-auto p-4">
        <Tabs defaultValue="quick" className="space-y-6">
          <TabsList className="bg-secondary/50 flex-wrap h-auto gap-1">
            <TabsTrigger value="quick" className="data-[state=active]:bg-yellow-600">
              <Zap className="w-4 h-4 mr-2" />
              Quick Actions
            </TabsTrigger>
            <TabsTrigger value="rooms" className="data-[state=active]:bg-purple-600">
              <MessageSquare className="w-4 h-4 mr-2" />
              Rooms
            </TabsTrigger>
            <TabsTrigger value="messaging" className="data-[state=active]:bg-pink-600">
              <Send className="w-4 h-4 mr-2" />
              Send Messages
            </TabsTrigger>
            <TabsTrigger value="bans" className="data-[state=active]:bg-red-600">
              <Ban className="w-4 h-4 mr-2" />
              Bans
            </TabsTrigger>
            <TabsTrigger value="files" className="data-[state=active]:bg-blue-600">
              <FileText className="w-4 h-4 mr-2" />
              Files
            </TabsTrigger>
            <TabsTrigger value="file-approval" className="data-[state=active]:bg-teal-600">
              <Image className="w-4 h-4 mr-2" />
              File Approval
            </TabsTrigger>
            <TabsTrigger value="threats" className="data-[state=active]:bg-orange-600">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Threats
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="data-[state=active]:bg-amber-600">
              <Lightbulb className="w-4 h-4 mr-2" />
              Suggestions
            </TabsTrigger>
            <TabsTrigger value="appeals" className="data-[state=active]:bg-cyan-600">
              <Scale className="w-4 h-4 mr-2" />
              Appeals
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-green-600">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="ip-logger" className="data-[state=active]:bg-cyan-600">
              <MapPin className="w-4 h-4 mr-2" />
              IP Logger
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-violet-600">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="downtime" className="data-[state=active]:bg-orange-600">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Downtime
            </TabsTrigger>
          </TabsList>

          {/* Quick Actions Tab */}
          <TabsContent value="quick">
            <AdminQuickActions />
          </TabsContent>

          {/* Admin Messaging Tab */}
          <TabsContent value="messaging">
            <AdminMessaging />
          </TabsContent>

          {/* Rooms Tab */}
          <TabsContent value="rooms" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Chat Rooms</h2>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Room
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-white/10">
                  <DialogHeader>
                    <DialogTitle>Create New Room</DialogTitle>
                    <DialogDescription>
                      Create a new chat room for users
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Room name"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      className="bg-secondary/50 border-white/10"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant={newRoomType === "public" ? "default" : "outline"}
                        onClick={() => setNewRoomType("public")}
                        className={newRoomType === "public" ? "bg-green-600" : ""}
                      >
                        Public
                      </Button>
                      <Button
                        variant={newRoomType === "private" ? "default" : "outline"}
                        onClick={() => setNewRoomType("private")}
                        className={newRoomType === "private" ? "bg-purple-600" : ""}
                      >
                        Private
                      </Button>
                    </div>
                    <Button
                      onClick={handleCreateRoom}
                      className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                      Create Room
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Room list */}
              <div className="space-y-3">
                {rooms.map((room) => (
                  <AdminRoomCard
                    key={room._row_id}
                    room={room}
                    isSelected={selectedRoom?._row_id === room._row_id}
                    onView={() => loadRoomMessages(room)}
                    onDelete={() => handleDeleteRoom(room._row_id)}
                  />
                ))}
              </div>

              {/* Message view */}
              <AdminMessageView
                room={selectedRoom}
                messages={messages}
                onDeleteMessage={handleDeleteMessage}
                onBanUser={(username) => handleBanUser(username)}
              />
            </div>
          </TabsContent>

          {/* Bans Tab */}
          <TabsContent value="bans" className="space-y-6">
            <Card className="glass-morphism border-white/10">
              <CardHeader>
                <CardTitle>Ban User</CardTitle>
                <CardDescription>
                  Ban a user from all chat rooms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Input
                    placeholder="Username to ban"
                    value={banUsername}
                    onChange={(e) => setBanUsername(e.target.value)}
                    className="bg-secondary/50 border-white/10"
                  />
                  <Button
                    onClick={() => handleBanUser()}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Ban className="w-4 h-4 mr-2" />
                    Ban
                  </Button>
                </div>
              </CardContent>
            </Card>

            <AdminBanList bans={bans} onUnban={handleUnban} />
          </TabsContent>

          {/* Suggestions Tab */}
          <TabsContent value="suggestions">
            <AdminSuggestionsList 
              suggestions={suggestions} 
              onDelete={handleDeleteSuggestion} 
            />
          </TabsContent>

          {/* Appeals Tab */}
          <TabsContent value="appeals">
            <AdminAppealsList 
              appeals={appeals}
              onApprove={handleApproveAppeal}
              onDeny={handleDenyAppeal}
              onDelete={handleDeleteAppeal}
            />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <AdminNotificationSystem
              bans={bans}
              onBanUserClick={handleBanUser}
            />
          </TabsContent>
          
          {/* File Approval Tab */}
          <TabsContent value="file-approval">
            <AdminFileApproval />
          </TabsContent>
          
          {/* IP Logger Tab */}
          <TabsContent value="ip-logger">
            <AdminIPLogger />
          </TabsContent>
          
          {/* Settings Tab */}
          <TabsContent value="settings">
            <AdminSettings />
          </TabsContent>
          
          {/* Downtime Tab */}
          <TabsContent value="downtime">
            <ScheduledDowntime />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPanel;
