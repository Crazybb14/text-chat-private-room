import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import db from "@/lib/shared/kliv-database.js";
import { useToast } from "@/hooks/use-toast";
import MessageBubble from "@/components/MessageBubble";
import RoomHeader from "@/components/RoomHeader";
import FileUpload from "@/components/FileUpload";
import SharedFile from "@/components/SharedFile";
import { getDeviceId, containsProfanity, getBanReason } from "@/lib/deviceId";
import PushNotificationManager from "@/lib/pushNotifications";
import RealTimePushNotifications from "@/lib/realTimePushNotifications";
import AdvancedBanDetection from "@/lib/advancedBanDetection";
import UserManager from "@/lib/userManagement";

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

const ChatRoom = () => {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
    } catch (error) {
      console.log("Error loading room:", error);
    }
  }, [roomId, toast, navigate]);

  const checkBanStatus = useCallback(async (user: string, device: string, showToast = true) => {
    try {
      // Check for ban by username
      const userBans = await db.query("bans", { username: `eq.${user}` });
      if (userBans.length > 0) {
        if (!isBanned && showToast) {
          toast({
            title: "You are banned",
            description: "You have been banned from this chat",
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

  // Auto-ban user with advanced detection
  const autoBanUser = useCallback(async (user: string, device: string, message: string) => {
    try {
      // Check if already banned
      const existingBans = await db.query("bans", { device_id: `eq.${device}` });
      if (existingBans.length === 0) {
        const banAnalysis = await AdvancedBanDetection.analyzeMessage(message, user);
        
        if (banAnalysis.shouldBan) {
          await db.insert("bans", {
            username: user,
            device_id: device,
            room_id: null, // Global ban
          });
          
          // Create notification about the ban
          await db.insert("notifications", {
            type: "auto_ban",
            message: `You have been automatically banned: ${banAnalysis.reason}`,
            recipient_device_id: device,
            is_read: 0,
            created_by_admin: 0,
          });
          
          // Send push notification
          await PushNotificationManager.sendLocalNotification(
            "⛔ Auto-Ban Detected",
            `${banAnalysis.reason} (Threat Score: ${banAnalysis.threatScore})`,
            { requireInteraction: true, tag: 'auto-ban' }
          );
          
          setIsBanned(true);
          toast({
            title: "You have been banned",
            description: `${banAnalysis.reason} (Threat Score: ${banAnalysis.threatScore})`,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.log("Error auto-banning user:", error);
    }
  }, [toast]);

  useEffect(() => {
    if (!username) return;
    
    // Get or create device ID
    const device = getDeviceId();
    setDeviceId(device);
    console.log("Device ID:", device);
    
    loadRoom();
    checkBanStatus(username, device, true);

    // Poll for new messages every 2 seconds
    pollInterval.current = setInterval(() => {
      loadMessages();
      // Also check ban status in real-time (without showing toast each time)
      checkBanStatus(username, device, false);
    }, 2000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
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

    // Advanced content filtering
    const basicProfanity = containsProfanity(messageContent);
    const advancedCheck = await AdvancedBanDetection.analyzeMessage(messageContent, username);
    
    if (basicProfanity || advancedCheck.shouldBan) {
      await autoBanUser(username, deviceId, messageContent);
      setIsSending(false);
      return;
    }

    try {
      // Send user message
      await db.insert("messages", {
        room_id: parseInt(roomId!),
        sender_name: username,
        content: messageContent,
        is_ai: 0,
        device_id: deviceId,
      });

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

      {/* Header */}
      <RoomHeader room={room} onCopyCode={copyRoomCode} onBack={() => navigate("/")} />

      {/* Messages and Files */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 relative z-10">
        <div className="max-w-3xl mx-auto space-y-4">
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
              <MessageBubble
                key={message._row_id}
                message={message}
                isOwn={message.sender_name === username}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input with file upload */}
      <div className="border-t border-white/10 p-4 relative z-10">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto flex gap-3">
          <FileUpload
            roomId={parseInt(roomId!)}
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

export default ChatRoom;