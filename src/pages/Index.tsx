import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Users, Lock, Plus, ArrowRight, Shield, Lightbulb, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import db from "@/lib/shared/kliv-database.js";
import { useToast } from "@/hooks/use-toast";

import PushNotificationManager from "@/lib/pushNotifications";
import RealTimePushNotifications from "@/lib/realTimePushNotifications";
import RealTimeNotifications from "@/lib/realTimeNotifications";
import UserManager from "@/lib/userManagement";
import { getDeviceId } from "@/lib/deviceId";
import UsernameSetup from "@/components/UsernameSetup";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [usernameSet, setUsernameSet] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);

  const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // Crash screen state
  const [isCrashed, setIsCrashed] = useState(false);
  const [crashCountdown, setCrashCountdown] = useState(1);

  // Initialize desktop notifications and check ban status
  useEffect(() => {
    const initializeApp = async () => {
      const deviceId = getDeviceId();
      console.log("Device ID:", deviceId);
      
      // Listen for admin crash command
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('admin_commands');
        channel.onmessage = (event) => {
          if (event.data.type === 'CRASH_ALL') {
            console.log('💥 CRASH COMMAND RECEIVED');
            setIsCrashed(true);
            setCrashCountdown(Math.ceil(event.data.duration / 1000));
            
            // Start countdown
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
          }
        };
      }
      
      // Check for crash command in localStorage (backup method)
      const checkCrashCommand = () => {
        const crashCmd = localStorage.getItem('admin_crash_command');
        if (crashCmd) {
          try {
            const cmd = JSON.parse(crashCmd);
            if (cmd.active && Date.now() - cmd.timestamp < cmd.duration) {
              const remaining = Math.ceil((cmd.duration - (Date.now() - cmd.timestamp)) / 1000);
              setIsCrashed(true);
              setCrashCountdown(remaining);
              
              setTimeout(() => {
                setIsCrashed(false);
                localStorage.removeItem('admin_crash_command');
              }, remaining * 1000);
            } else {
              localStorage.removeItem('admin_crash_command');
            }
          } catch {
            localStorage.removeItem('admin_crash_command');
          }
        }
      };
      checkCrashCommand();
      
      try {
        // Request desktop notification permission and enable
        if ('Notification' in window) {
          if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            console.log('Notification permission:', permission);
          }
          
          // Always enable desktop notifications with fallback
          console.log('Desktop notifications enabled');
          
          // Show welcome notification on first visit
          if (Notification.permission === 'granted') {
            new Notification('Welcome to ChatRooms!', {
              body: 'Desktop notifications are enabled. You\'ll receive alerts for bans and messages.',
              icon: '/favicon.ico',
              tag: 'welcome'
            });
          }
        } else {
          console.log('This browser does not support desktop notifications');
        }
        
        // Initialize real-time push notifications
        await RealTimePushNotifications.initializeRealTimeNotifications();
        
        // Initialize real-time notifications for admin announcements
        await RealTimeNotifications.initialize();
        
        // Add notification listener for announcements
        RealTimeNotifications.addNotificationListener((announcement) => {
          toast({
            title: announcement.title,
            description: announcement.message,
            variant: announcement.type === 'warning' || announcement.type === 'security' ? 'destructive' : 'default',
          });
        });
        
        // Check for existing ban that might have expired
        const deviceBans = await db.query("bans", { device_id: `eq.${deviceId}` });
        
        // Check if any active bans exist
        const now = Date.now();
        const activeBans = deviceBans.filter(ban => {
          return ban.expires_at === null || ban.expires_at > now;
        });
        
        if (activeBans.length > 0) {
          setIsBanned(true);
          const ban = activeBans[0];
          const durationText = ban.ban_duration === 0 ? "permanently" : `${Math.ceil((ban.expires_at - Date.now()) / 3600000)} hours`;
          
          // Send desktop notification about ban
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('⛔ Access Denied', {
              body: `You have been banned ${durationText}: ${ban.ban_reason || "This device has been banned from using the chat"}`,
              icon: '/favicon.ico',
              tag: 'ban',
              requireInteraction: true
            });
          }
          
          // Send in-app notification
          await RealTimePushNotifications.sendBanNotification(deviceId, {
            username: ban.username,
            reason: ban.ban_reason || "Ban in effect",
            duration: ban.ban_duration || 0,
            message: ban.message_content
          });
          
          toast({
            title: "You are banned",
            description: `${ban.ban_reason || "This device has been banned from using the chat"} (${durationText})`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.log("Error initializing app:", error);
      }
    };
    
    initializeApp();
  }, [toast]);

  // Check for existing username and terms acceptance
  useEffect(() => {
    const checkSetup = async () => {
      try {
        // Check if terms have been accepted
        const termsAccepted = localStorage.getItem('terms_accepted');
        if (!termsAccepted) {
          console.log("Terms not accepted, redirecting to terms");
          navigate('/terms');
          return;
        }
        
        // Check for existing username
        const existingUsername = await UserManager.getUsername();
        if (existingUsername) {
          console.log("Found existing username:", existingUsername);
          setUsername(existingUsername);
          setUsernameSet(true);
        }
      } catch (error) {
        console.log("Error checking setup:", error);
      }
    };
    
    checkSetup();
  }, [navigate]);

  // Crash screen
  if (isCrashed) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/50 via-black to-red-900/50 animate-pulse" />
        <div className="absolute inset-0">
          {/* Glitch effect lines */}
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute h-1 bg-red-500/30"
              style={{
                top: `${Math.random() * 100}%`,
                left: 0,
                right: 0,
                animation: `glitch ${0.1 + Math.random() * 0.3}s infinite`,
                animationDelay: `${Math.random() * 0.5}s`
              }}
            />
          ))}
        </div>
        <div className="relative z-10 text-center">
          <div className="text-8xl mb-8 animate-bounce">💥</div>
          <h1 className="text-6xl font-bold text-red-500 mb-4 animate-pulse" style={{ textShadow: '0 0 20px rgba(239, 68, 68, 0.8)' }}>
            SYSTEM CRASH
          </h1>
          <p className="text-2xl text-red-400 mb-8">Connection interrupted by administrator</p>
          <div className="text-9xl font-mono font-bold text-white mb-4" style={{ textShadow: '0 0 30px rgba(255, 255, 255, 0.5)' }}>
            {crashCountdown}
          </div>
          <p className="text-xl text-gray-400">Reconnecting in {crashCountdown} seconds...</p>
          <div className="mt-8 w-64 h-2 bg-gray-800 rounded-full mx-auto overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-1000"
              style={{ width: `${(1 - crashCountdown) * 100}%` }}
            />
          </div>
        </div>
        <style>{`
          @keyframes glitch {
            0%, 100% { transform: translateX(0); opacity: 0.3; }
            50% { transform: translateX(${Math.random() > 0.5 ? '' : '-'}${10 + Math.random() * 20}px); opacity: 0.7; }
          }
        `}</style>
      </div>
    );
  }

  if (isBanned) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass-morphism border-white/10">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-red-400">Access Denied</CardTitle>
            <CardDescription className="text-red-300">This device has been banned from using the chat.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!usernameSet) {
    return (
      <UsernameSetup 
        onUsernameSet={(username) => {
          console.log("Username setup completed:", username);
          setUsername(username);
          setUsernameSet(true);
        }}
      />
    );
  }

  const handleJoinPublic = async () => {
    if (isBanned) {
      toast({
        title: "You are banned",
        description: "You cannot join any chat rooms",
        variant: "destructive",
      });
      return;
    }
    
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a username to join the chat",
        variant: "destructive",
      });
      return;
    }
    
    // Find or create public room
    try {
      const publicRooms = await db.query("rooms", { type: "eq.public" });
      let roomId;
      
      if (publicRooms.length === 0) {
        // Create public room if it doesn't exist
        const result = await db.insert("rooms", {
          name: "Public Room",
          type: "public",
          code: null,
        });
        roomId = result._row_id;
      } else {
        roomId = publicRooms[0]._row_id;
      }
      
      navigate(`/chat/${roomId}`);
    } catch (error) {
      console.log("Error accessing public room:", error);
      toast({
        title: "Error",
        description: "Failed to access public room",
        variant: "destructive",
      });
    }
  };

  const handleCreatePrivate = async () => {
    if (isBanned) {
      toast({
        title: "You are banned",
        description: "You cannot create chat rooms",
        variant: "destructive",
      });
      return;
    }
    
    if (!username.trim() || !roomName.trim()) {
      toast({
        title: "Missing info",
        description: "Please enter both username and room name",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const code = generateCode();
      const result = await db.insert("rooms", {
        name: roomName,
        code: code,
        type: "private",
      });
      
      toast({
        title: "Room created!",
        description: `Share this code: ${code}`,
      });
      
      setCreateDialogOpen(false);
      navigate(`/chat/${result._row_id}`);
    } catch (error) {
      console.log("Error creating room:", error);
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinPrivate = async () => {
    if (isBanned) {
      toast({
        title: "You are banned",
        description: "You cannot join any chat rooms",
        variant: "destructive",
      });
      return;
    }
    
    if (!username.trim() || !joinCode.trim()) {
      toast({
        title: "Missing info",
        description: "Please enter both username and room code",
        variant: "destructive",
      });
      return;
    }

    setIsJoining(true);
    try {
      const rooms = await db.query("rooms", { code: `eq.${joinCode}` });
      
      if (rooms.length === 0) {
        toast({
          title: "Room not found",
          description: "Invalid room code. Please check and try again.",
          variant: "destructive",
        });
        return;
      }

      setJoinDialogOpen(false);
      navigate(`/chat/${rooms[0]._row_id}`);
    } catch (error) {
      console.log("Error joining room:", error);
      toast({
        title: "Error",
        description: "Failed to join room",
        variant: "destructive",
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-blue-900/20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30">
              <MessageSquare className="w-6 h-6 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              ChatRooms
            </h1>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Shield className="w-4 h-4 mr-2" />
            Admin
          </Button>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Chat with anyone,{" "}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                anywhere
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join the public room for open conversations or create a private room with a secret code for you and your friends.
            </p>
          </div>

          {/* Username display */}
          <div className="w-full max-w-sm mb-8 p-4 rounded-lg bg-secondary/50 border border-white/10 text-center">
            <p className="text-sm text-muted-foreground">Your username:</p>
            <p className="text-xl font-semibold text-purple-400">{username}</p>
          </div>

          {/* Enhanced Room Cards with Status */}
          <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl mx-auto">
            {/* Public Room Card */}
            <Card className="glass-morphism border-white/10 hover:border-green-500/30 transition-all duration-300 group transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                    Available
                  </Badge>
                </div>
                <CardTitle className="text-xl bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  Public Room
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Join the community chat room. Always open, no code required!
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="bg-green-500/10 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-green-300">🟢 Always Online</span>
                      <span className="text-green-300">🌐 Public</span>
                    </div>
                  </div>
                  <Button
                    onClick={handleJoinPublic}
                    disabled={isBanned}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-3 h-12 shadow-lg hover:shadow-green-500/25"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Join Public Room
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Private Room Card */}
            <Card className="glass-morphism border-white/10 hover:border-purple-500/30 transition-all duration-300 group transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <Lock className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                    <span className="w-2 h-2 bg-purple-400 rounded-full mr-2 animate-pulse"></span>
                    Private
                  </Badge>
                </div>
                <CardTitle className="text-xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Private Room
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Create a secret room with a 6-digit code for friends only.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="bg-purple-500/10 rounded-lg p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-300">🔒 Secured</span>
                      <span className="text-purple-300">👥 Invite Only</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {/* Create Private Room Dialog */}
                    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          disabled={isBanned}
                          className="flex-1 border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-400 bg-purple-500/10 text-purple-300 font-semibold py-3 h-12"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Create
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-white/10 shadow-2xl">
                        <DialogHeader className="pb-4">
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mx-auto mb-4">
                            <Lock className="w-8 h-8 text-white" />
                          </div>
                          <DialogTitle className="text-xl">Create Private Room</DialogTitle>
                          <DialogDescription className="text-gray-400">
                            Give your room a unique name. We\'ll generate a secret 6-digit code for sharing.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <Input
                            placeholder="Enter room name..."
                            value={roomName}
                            onChange={(e) => setRoomName(e.target.value)}
                            className="bg-secondary/50 border-white/10 text-white placeholder:text-gray-500 h-12"
                          />
                          <Button
                            onClick={handleCreatePrivate}
                            disabled={isCreating}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 h-12 shadow-lg"
                          >
                            {isCreating ? "Creating..." : "Create Private Room"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Join Private Room Dialog */}
                    <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          disabled={isBanned}
                          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 h-12 shadow-lg hover:shadow-purple-500/25"
                        >
                          Join
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-white/10 shadow-2xl">
                        <DialogHeader className="pb-4">
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mx-auto mb-4">
                            <Lock className="w-8 h-8 text-white" />
                          </div>
                          <DialogTitle className="text-xl">Join Private Room</DialogTitle>
                          <DialogDescription className="text-gray-400">
                            Enter the 6-digit code that was shared with you.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <div className="relative">
                            <Input
                              placeholder="000000"
                              value={joinCode}
                              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
                              maxLength={6}
                              className="bg-secondary/50 border-white/10 text-center text-3xl tracking-widest font-mono text-white placeholder:text-gray-600 h-14"
                            />
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-purple-400">
                              <Lock className="w-5 h-5" />
                            </div>
                          </div>
                          <Button
                            onClick={handleJoinPrivate}
                            disabled={isJoining}
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 h-12 shadow-lg"
                          >
                            {isJoining ? "Joining..." : "Join Private Room"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Links */}
        <div className="flex justify-center gap-4 mt-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/suggestions")}
            className="text-muted-foreground hover:text-yellow-400"
          >
            <Lightbulb className="w-4 h-4 mr-2" />
            Suggestions
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/appeal")}
            className="text-muted-foreground hover:text-blue-400"
          >
            <Scale className="w-4 h-4 mr-2" />
            Ban Appeal
          </Button>
        </div>

        {/* Footer */}
        <footer className="text-center text-muted-foreground text-sm mt-4">
          <p>Your username is permanently linked to this device. Keep the chat friendly!</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;