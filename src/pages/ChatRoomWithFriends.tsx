import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, X, Users, Heart, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import db from "@/lib/shared/kliv-database.js";
import { useToast } from "@/hooks/use-toast";
import MessageBubbleWithMentions from "@/components/MessageBubbleWithMentions";
import RoomHeader from "@/components/RoomHeader";
import UserProfile from "@/components/UserProfile";
import RoomMembersSidebar from "@/components/RoomMembersSidebar";
import FriendRequests from "@/components/FriendRequests";
import FileUpload from "@/components/FileUpload";
import SharedFile from "@/components/SharedFile";
import OnlineStatusTracker from "@/components/OnlineStatusTracker";
import PrivateRoomCleaner from "@/components/PrivateRoomCleaner";
import PrivateRoomApproval from "@/components/PrivateRoomApproval";
import RoomJoinRequest from "@/components/RoomJoinRequest";
import LockdownScreenFixed from "@/components/LockdownScreenFixed";
import { getDeviceId } from "@/lib/deviceId";
import PushNotificationManager from "@/lib/pushNotifications";
import RealTimePushNotifications from "@/lib/realTimePushNotifications";
import superBanSystem from "@/lib/superAdvancedBanSystem";
import UserManager from "@/lib/userManagement";
import { filterContent, FilterSettings } from "@/lib/contentFilter";

interface Message {
  _row_id: number;
  room_id: number;
  sender_name: string;
  content: string;
  is_ai: number;
  device_id: string | null;
  _created_at: number;
}

interface UploadedFile {
  _row_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  file_type: string;
  room_id: number;
  uploaded_by: string;
  device_id: string | null;
  _created_at: number;
}

interface Notification {
  _row_id: number;
  type: string;
  message: string;
  recipient_device_id: string | null;
  is_read: number;
  created_by_admin: number;
  _created_at: number;
}

interface Room {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
}

interface Setting {
  setting_key: string;
  setting_value: string;
}

const ChatRoomWithFriends = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotification, setUnreadNotification] = useState<Notification | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [username, setUsername] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [isCrashed, setIsCrashed] = useState(false);
  const [crashCountdown, setCrashCountdown] = useState(1);
  const [adminSettings, setAdminSettings] = useState<Record<string, string>>({});
  const [autoScroll, setAutoScroll] = useState(true);
  const [banTime, setBanTime] = useState<string>("");
  const [showPrivateRoomCleaner, setShowPrivateRoomCleaner] = useState(true);
  
  // Friending system state
  const [currentUserId, setCurrentUserId] = useState("");
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUsername, setSelectedUsername] = useState("");
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [pendingFriendRequestsCount, setPendingFriendRequestsCount] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize current user ID
  useEffect(() => {
    const device = getDeviceId();
    setCurrentUserId(device);
  }, []);

  // Load admin settings for content filtering
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await db.query('admin_settings', {});
        const map: Record<string, string> = {};
        data.forEach((s: Setting) => { map[s.setting_key] = s.setting_value; });
        setAdminSettings(map);
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
    const interval = setInterval(loadSettings, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load pending friend requests count
  useEffect(() => {
    if (!currentUserId) return;
    
    const loadFriendRequestsCount = async () => {
      try {
        const incoming = await db.query("friend_requests", {
          to_user_id: `eq.${currentUserId}`,
          status: `eq.pending`
        });
        setPendingFriendRequestsCount(incoming.length);
      } catch (error) {
        console.error('Error loading friend requests count:', error);
      }
    };

    loadFriendRequestsCount();
    const interval = setInterval(loadFriendRequestsCount, 10000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  // Listen for admin crash command
  useEffect(() => {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('admin_commands');
      channel.onmessage = (event) => {
        if (event.data.type === 'CRASH_ALL') {
          console.log('💥 CRASH COMMAND RECEIVED IN CHATROOM');
          setIsCrashed(true);
          setCrashCountdown(Math.ceil(event.data.duration / 1000));
          
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
      
      return () => channel.close();
    }
  }, []);

  // Check for crash command in localStorage
  useEffect(() => {
    const checkCrash = () => {
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
          }
        } catch {
          // Ignore parse errors
        }
      }
    };
    checkCrash();
    const interval = setInterval(checkCrash, 1000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Handle user scrolling up to disable auto-scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    setAutoScroll(isAtBottom);
  };

  // Load username from UserManager
  useEffect(() => {
    const loadUsername = async () => {
      try {
        const savedUsername = await UserManager.getUsername();
        if (savedUsername) {
          setUsername(savedUsername);
        } else {
          toast({
            title: "No username set",
            description: "Please set a username first",
            variant: "destructive",
          });
          navigate("/");
        }
      } catch (error) {
        console.error("Error loading username:", error);
        setUsername("");
      }
    };
    
    loadUsername();
  }, [navigate, toast]);

  const loadMessages = useCallback(async () => {
    if (!deviceId) return;
    
    try {
      const [msgs, files, notifs] = await Promise.all([
        db.query("messages", { 
          room_id: `eq.${roomId}`,
          order: "_created_at.asc"
        }),
        db.query("uploaded_files", {
          room_id: `eq.${roomId}`,
          order: "_created_at.desc"
        }),
        db.query("notifications", {
          recipient_device_id: `eq.${deviceId}`,
          is_read: `eq.0`,
          order: "_created_at.desc"
        })
      ]);
      setMessages(msgs);
      setUploadedFiles(files);
      
      // Show first unread notification
      if (notifs.length > 0 && !unreadNotification) {
        setUnreadNotification(notifs[0]);
        
        // Mark as read
        await db.update("notifications", { _row_id: `eq.${notifs[0]._row_id}` }, { is_read: 1 });
      }
    } catch (error) {
      console.log("Error loading messages:", error);
    }
  }, [roomId, deviceId, unreadNotification]);

  const loadRoom = useCallback(async () => {
    try {
      const rooms = await db.query("rooms", { _row_id: `eq.${roomId}` });
      if (rooms.length === 0) {
        toast({
          title: "Room not found",
          description: "This room does not exist",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      setRoom(rooms[0]);
      
      // Log room join for IP tracking
      const device = getDeviceId();
      try {
        await db.insert("ip_activity_logs", {
          device_id: device,
          username: localStorage.getItem("chatUsername") || "Unknown",
          action: "room_join",
          room_id: parseInt(roomId!),
          message_preview: rooms[0].name,
        });
      } catch (logErr) {
        console.log("IP log failed:", logErr);
      }
    } catch (error) {
      console.log("Error loading room:", error);
    }
  }, [roomId, toast, navigate]);

  const checkBanStatus = useCallback(async (user: string, device: string, showToast = true) => {
    try {
      // Check for ban by username
      const userBans = await db.query("bans", { username: `eq.${user}` });
      if (userBans.length > 0) {
        const ban = userBans[0];
        if (!isBanned && showToast) {
          const banEndsAt = new Date(Date.now() + (ban.ban_duration || 0) * 1000);
          setBanTime(banEndsAt.toISOString());
          toast({
            title: `⛔ ${user} is BANNED`,
            description: `Banned until ${banEndsAt.toLocaleString()}. Reason: ${ban.ban_reason || "Contact administrator"}`,
            variant: "destructive",
          });
        }
        setIsBanned(true);
        return true;
      }
      
      // Check for ban by device ID
      const deviceBans = await db.query("bans", { device_id: `eq.${device}` });
      if (deviceBans.length > 0) {
        if (!isBanned && showToast) {
          toast({
            title: "You are banned",
            description: "This device has been banned from this chat",
            variant: "destructive",
          });
        }
        setIsBanned(true);
        return true;
      }
      return false;
    } catch (error) {
      console.log("Error checking ban status:", error);
      return false;
    }
  }, [toast, isBanned]);

  // Super Advanced Auto-ban system
  const processAutoBan = useCallback(async (user: string, device: string, message: string, roomIdNum?: number) => {
    try {
      const existingBans = await db.query("bans", { device_id: `eq.${device}` });
      const now = Date.now();
      const activeBan = existingBans.find((b: { expires_at: number | null }) => !b.expires_at || b.expires_at > now);
      
      if (activeBan) {
        setIsBanned(true);
        return true;
      }

      const decision = await superBanSystem.analyzeMessage(message, user, device, roomIdNum);
      
      console.log("Ban Analysis Result:", {
        shouldBan: decision.shouldBan,
        shouldWarn: decision.shouldWarn,
        threatScore: decision.threatScore,
        severity: decision.severity,
        patterns: decision.detectedPatterns,
        suggestedAction: decision.suggestedAction
      });

      if (decision.shouldWarn && !decision.shouldBan) {
        const warningCount = superBanSystem.getWarningCount(device);
        toast({
          title: `⚠️ Warning (${warningCount + 1}/3)`,
          description: `${decision.reason}. ${3 - warningCount - 1} warnings left before ban.`,
          variant: "destructive",
        });
        
        await PushNotificationManager.sendLocalNotification(
          `⚠️ Warning ${warningCount + 1}/3`,
          decision.reason,
          { requireInteraction: false, tag: 'warning' }
        );
        
        return false;
      }

      if (decision.shouldBan) {
        await superBanSystem.executeBan(user, device, decision, message);
        
        let durationText = 'permanently';
        if (decision.banDuration > 0) {
          const hours = Math.round(decision.banDuration / 3600);
          const days = Math.floor(hours / 24);
          durationText = days > 0 ? `for ${days} day${days > 1 ? 's' : ''}` : `for ${hours} hour${hours !== 1 ? 's' : ''}`;
        }
        
        await PushNotificationManager.sendLocalNotification(
          "⛔ You Have Been Banned",
          `${decision.reason}\nDuration: ${durationText}\nThreat Score: ${decision.threatScore}`,
          { requireInteraction: true, tag: 'auto-ban' }
        );
        
        setIsBanned(true);
        toast({
          title: `⛔ Banned ${durationText}`,
          description: `${decision.reason} (Severity: ${decision.severity.toUpperCase()}, Score: ${decision.threatScore})`,
          variant: "destructive",
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.log("Error in auto-ban processing:", error);
      return false;
    }
  }, [toast]);

  useEffect(() => {
    if (!username) return;
    
    const device = getDeviceId();
    setDeviceId(device);
    console.log("Device ID:", device);
    
    loadRoom();
    checkBanStatus(username, device, true);

    const updateActivity = async () => {
      try {
        await db.insert("online_users", {
          username: username,
          device_id: device,
          room_id: parseInt(roomId!),
          last_seen: new Date().toISOString(),
          is_online: true,
        });
      } catch (err) {
        // Ignore errors
      }
    };

    updateActivity();
    const activityInterval = setInterval(updateActivity, 30000);

    const setOffline = async () => {
      try {
        await db.update("online_users", { device_id: `eq.${device}` }, { 
          is_online: false,
          last_seen: new Date().toISOString(),
        });
      } catch (err) {
        // Ignore errors
      }
    };

    window.addEventListener('beforeunload', setOffline);

    pollInterval.current = setInterval(() => {
      loadMessages();
      checkBanStatus(username, device, false);
    }, 500);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
      clearInterval(activityInterval);
      setOffline();
      window.removeEventListener('beforeunload', setOffline);
    };
  }, [roomId, navigate, username, loadRoom, checkBanStatus, loadMessages]);

  useEffect(() => {
    if (username) {
      loadMessages();
    }
  }, [username, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!newMessage.trim() || isBanned) return;

    setIsSending(true);
    const messageContent = newMessage.trim();
    setNewMessage("");

    // Content safety filter
    const filterSettings: Partial<FilterSettings> = {
      block_phone_numbers: adminSettings.block_phone_numbers === 'true',
      block_emails: adminSettings.block_emails === 'true',
      block_addresses: adminSettings.block_addresses === 'true',
      block_social_security: adminSettings.block_social_security === 'true',
      block_credit_cards: adminSettings.block_credit_cards === 'true',
      block_ip_addresses: adminSettings.block_ip_addresses === 'true',
      profanity_filter: adminSettings.profanity_filter === 'true',
    };

    const filterResult = filterContent(messageContent, filterSettings);
    
    if (filterResult.blocked || filterResult.hasProfanity) {
      const banReason = filterResult.reasons.length > 0 
        ? filterResult.reasons.join(', ')
        : 'Profanity/inappropriate language detected';
      
      try {
        await db.insert("bans", {
          username: username,
          device_id: deviceId,
          room_id: null,
          ban_reason: banReason,
          message_content: messageContent,
          ban_duration: 86400,
        });
        
        await db.insert("ip_activity_logs", {
          device_id: deviceId,
          username: username,
          action: "banned_content",
          room_id: parseInt(roomId!),
          message_preview: `[BLOCKED] ${messageContent.substring(0, 30)}...`,
        });
        
        const banEndsAt = new Date(Date.now() + 86400 * 1000);
        await db.insert("notifications", {
          type: "ban",
          message: `${username} BANNED until ${banEndsAt.toLocaleString()}. Reason: ${banReason}. Message blocked.`,
          recipient_device_id: deviceId,
          is_read: 0,
          created_by_admin: 0,
        });
        
        setBanTime(banEndsAt.toISOString());
      } catch (banErr) {
        console.log("Ban insert error:", banErr);
      }
      
      setIsBanned(true);
      
      toast({
        title: `⛔ ${username} is BANNED`,
        description: `Banned until ${new Date(Date.now() + 86400 * 1000).toLocaleString()}. Reason: ${banReason}`,
        variant: "destructive",
      });
      
      setIsSending(false);
      return;
    }

    const shouldBlock = await processAutoBan(username, deviceId, messageContent, parseInt(roomId!));
    
    if (shouldBlock) {
      setIsSending(false);
      return;
    }

    try {
      await db.insert("messages", {
        room_id: parseInt(roomId!),
        sender_name: username,
        content: messageContent,
        is_ai: 0,
        device_id: deviceId,
      });

      try {
        await db.insert("ip_activity_logs", {
          device_id: deviceId,
          username: username,
          action: "message",
          room_id: parseInt(roomId!),
          message_preview: messageContent.substring(0, 50),
        });
      } catch (logError) {
        console.log("IP logging failed:", logError);
      }

      loadMessages();
    } catch (error) {
      console.log("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const copyRoomCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code);
      toast({
        title: "Code copied!",
        description: `Room code ${room.code} copied to clipboard`,
      });
    }
  };

  const handleUsernameClick = (userId: string, username: string) => {
    setSelectedUserId(userId);
    setSelectedUsername(username);
    setShowUserProfile(true);
  };

  const handleFriendRequestClick = () => {
    setShowFriendRequests(true);
  };

  // Enhanced private room joining with friend bypass
  const canBypassPrivateRoom = async (roomCode: string): Promise<boolean> => {
    try {
      // Check if user is friends with the room creator
      const roomData = await db.query("rooms", { code: `eq.${roomCode}` });
      if (roomData.length === 0) return false;

      const room = roomData[0];
      
      // Get room creator (this would need to be added to rooms table)
      // For now, we'll check if current user has any friendship with anyone in the room
      const friendships = await db.query("friendships", {
        user_id: `eq.${currentUserId}`,
        status: `eq.accepted`
      });

      const friendIds = friendships.map(f => f.friend_id);
      
      // Check if any friends are in this room
      const roomMembers = await db.query("room_members", {
        room_id: `eq.${room._row_id}`
      });

      const hasFriendInRoom = roomMembers.some(member => 
        friendIds.includes(member.user_id)
      );

      return hasFriendInRoom;
    } catch (error) {
      console.error('Error checking private room bypass:', error);
      return false;
    }
  };

  // Crash screen
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
                animation: `glitch ${0.1 + Math.random() * 0.3}s infinite`,
                animationDelay: `${Math.random() * 0.5}s`
              }}
            />
          ))}
        </div>
        <div className="relative z-10 text-center">
          <div className="text-8xl mb-8 animate-bounce">💥</div>
          <h1 className="text-6xl font-bold text-red-500 mb-4 animate-pulse" style={{ textShadow: '0 0 20px rgba(239, 68, 68, 0.8)' }}>
            CONNECTION LOST
          </h1>
          <p className="text-2xl text-red-400 mb-8">Server interrupted by administrator</p>
          <div className="text-9xl font-mono font-bold text-white mb-4" style={{ textShadow: '0 0 30px rgba(255, 255, 255, 0.5)' }}>
            {crashCountdown}
          </div>
          <p className="text-xl text-gray-400">Reconnecting in {crashCountdown} seconds...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/10 via-background to-blue-900/10 pointer-events-none" />

      {/* Notification popup */}
      {unreadNotification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-sm">
          <div className="bg-yellow-500/90 backdrop-blur-sm border border-yellow-600 rounded-lg p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium text-black">🔔 Notification</p>
                <p className="text-sm text-black/90">{unreadNotification.message}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setUnreadNotification(null)}
                className="h-6 w-6 text-black hover:bg-yellow-600/50"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header with friend buttons */}
      <div className="relative z-20">
        <RoomHeader room={room} onCopyCode={copyRoomCode} onBack={() => navigate("/")} />
        
        {/* Friend system buttons */}
        <div className="absolute top-4 left-4 flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFriendRequestClick}
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm"
          >
            <Heart className="w-4 h-4 mr-2" />
            Friends
            {pendingFriendRequestsCount > 0 && (
              <Badge variant="destructive" className="ml-1 px-1 py-0 text-xs">
                {pendingFriendRequestsCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <div 
          className="bg-blue-500 text-white text-xs px-2 py-1 text-center cursor-pointer hover:bg-blue-600"
          onClick={() => {
            scrollToBottom();
            setAutoScroll(true);
          }}
        >
          Click to scroll to new messages ↓
        </div>
      )}

      {/* Messages and Files */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 relative z-10" onScroll={handleScroll}>
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Online Status Tracker */}
          <OnlineStatusTracker roomId={parseInt(roomId!)} />
          
          {/* Show uploaded files */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-3">
              {uploadedFiles.map((file) => (
                <div key={file._row_id} className={`mb-3 ${
                  file.uploaded_by === username ? 'flex justify-end' : 'flex justify-start'
                }`}>
                  <SharedFile
                    file={file}
                    isOwn={file.uploaded_by === username}
                  />
                </div>
              ))}
            </div>
          )}
          
          {/* Show messages */}
          {messages.length === 0 && uploadedFiles.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm">Be the first to say something or share a file!</p>
            </div>
          ) : (
            messages.map((message) => (
              <MessageBubbleWithMentions
                key={message._row_id}
                message={message}
                isOwn={message.sender_name === username}
                onUsernameClick={handleUsernameClick}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Background Private Room Cleaner */}
      {showPrivateRoomCleaner && (
        <PrivateRoomCleaner 
          isTimerActive={true} 
          onCleanup={() => console.log("Inactive private rooms cleaned")} 
        />
      )}

      {/* Room Members Sidebar */}
      <RoomMembersSidebar
        roomId={parseInt(roomId!)}
        isPrivateRoom={room?.type === 'private'}
        currentUserId={currentUserId}
        currentUsername={username}
        onUserClick={handleUsernameClick}
      />

      {/* User Profile Modal */}
      {showUserProfile && (
        <UserProfile
          userId={selectedUserId}
          currentUserId={currentUserId}
          username={selectedUsername}
          isOpen={showUserProfile}
          onClose={() => setShowUserProfile(false)}
          isOwnProfile={selectedUserId === currentUserId}
        />
      )}

      {/* Friend Requests Modal */}
      <FriendRequests
        currentUserId={currentUserId}
        isOpen={showFriendRequests}
        onClose={() => setShowFriendRequests(false)}
        onProfileClick={handleUsernameClick}
      />

      {/* Input with file upload */}
      <div className="border-t border-white/10 p-4 relative z-10">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-3">
          <FileUpload
            roomId={parseInt(roomId!)}
            roomType={room?.type || 'public'}
            username={username}
            onFileUploaded={loadMessages}
          />
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={isBanned ? "You are banned from chatting" : "Type a message..."}
            disabled={isBanned || isSending || !username}
            className="flex-1 bg-secondary/50 border-white/10 focus:border-purple-500/50"
          />
          <Button
            type="submit"
            disabled={isBanned || isSending || !newMessage.trim() || !username}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ChatRoomWithFriends;