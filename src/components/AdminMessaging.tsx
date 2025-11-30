import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  MessageSquare, 
  Globe, 
  Lock, 
  Users, 
  Crown,
  Megaphone,
  AlertTriangle,
  Bell,
  RefreshCw,
  User,
  Trash2,
  Ban,
  Eye,
  EyeOff
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import db from '@/lib/shared/kliv-database.js';

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

const AdminMessaging = () => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [senderName, setSenderName] = useState('Admin');
  const [messageType, setMessageType] = useState<'normal' | 'announcement' | 'warning' | 'system'>('normal');
  const [loading, setLoading] = useState(false);
  const [incognitoMode, setIncognitoMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load rooms on mount
  useEffect(() => {
    loadRooms();
  }, []);

  // Real-time message polling when room is selected
  useEffect(() => {
    if (selectedRoom) {
      loadMessages();
      // Real-time updates - refresh every 500ms
      pollInterval.current = setInterval(loadMessages, 500);
    }
    
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [selectedRoom]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadRooms = async () => {
    try {
      const roomsData = await db.query('rooms', { order: '_created_at.desc' });
      setRooms(roomsData);
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  const loadMessages = async () => {
    if (!selectedRoom) return;
    
    try {
      const msgs = await db.query('messages', {
        room_id: `eq.${selectedRoom._row_id}`,
        order: '_created_at.asc'
      });
      setMessages(msgs);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRoom) return;

    setLoading(true);
    try {
      // Format message based on type
      let formattedContent = newMessage;
      let displayName = senderName;

      if (messageType !== 'normal') {
        switch (messageType) {
          case 'announcement':
            formattedContent = `📢 ANNOUNCEMENT: ${newMessage}`;
            if (!incognitoMode) displayName = '[ANNOUNCEMENT]';
            break;
          case 'warning':
            formattedContent = `⚠️ WARNING: ${newMessage}`;
            if (!incognitoMode) displayName = '[WARNING]';
            break;
          case 'system':
            formattedContent = `🔧 SYSTEM: ${newMessage}`;
            if (!incognitoMode) displayName = '[SYSTEM]';
            break;
        }
      }

      await db.insert('messages', {
        room_id: selectedRoom._row_id,
        sender_name: displayName,
        content: formattedContent,
        is_ai: messageType !== 'normal' && !incognitoMode ? 1 : 0,
        device_id: incognitoMode ? `user-${Date.now()}` : 'admin-panel',
      });

      setNewMessage('');
      loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await db.delete('messages', { _row_id: `eq.${messageId}` });
      toast({ title: 'Message deleted' });
      loadMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleBanUser = async (username: string, deviceId: string | null) => {
    try {
      await db.insert('bans', {
        username,
        device_id: deviceId,
        room_id: null,
        ban_reason: 'Banned by admin from chat panel',
        ban_duration: 86400,
        created_at: Date.now(),
        expires_at: Date.now() + 86400000,
      });
      toast({ 
        title: 'User banned',
        description: `${username} has been banned for 24 hours`
      });
    } catch (error) {
      console.error('Error banning user:', error);
    }
  };

  const copyUsername = async (username: string) => {
    setSenderName(username);
    toast({ title: 'Username copied', description: `Now chatting as "${username}"` });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          💬 Admin Live Chat
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-400 border-green-500/50">
            <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
            Real-time
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4 h-[600px]">
        {/* Room Selection Sidebar */}
        <Card className="glass-morphism border-white/10 overflow-hidden">
          <CardHeader className="py-3 bg-gradient-to-r from-purple-600/20 to-pink-600/20">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Rooms ({rooms.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[520px]">
              <div className="p-2 space-y-1">
                {rooms.map((room) => (
                  <button
                    key={room._row_id}
                    onClick={() => setSelectedRoom(room)}
                    className={`
                      w-full p-3 rounded-lg text-left transition-all
                      ${selectedRoom?._row_id === room._row_id
                        ? 'bg-purple-600/40 border-2 border-purple-500 shadow-lg shadow-purple-500/20'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`
                        w-8 h-8 rounded-lg flex items-center justify-center
                        ${room.type === 'public' 
                          ? 'bg-green-500/20' 
                          : 'bg-purple-500/20'
                        }
                      `}>
                        {room.type === 'public' 
                          ? <Globe className="w-4 h-4 text-green-400" />
                          : <Lock className="w-4 h-4 text-purple-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm truncate">{room.name}</p>
                        <p className="text-xs text-gray-400">
                          {room.type === 'public' ? 'Public' : `Code: ${room.code}`}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}

                {rooms.length === 0 && (
                  <p className="text-center text-gray-400 py-8 text-sm">No rooms</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="lg:col-span-3 glass-morphism border-white/10 flex flex-col overflow-hidden">
          {selectedRoom ? (
            <>
              {/* Room Header */}
              <CardHeader className="py-3 border-b border-white/10 bg-gradient-to-r from-purple-600/10 to-pink-600/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center
                      ${selectedRoom.type === 'public' 
                        ? 'bg-green-500/20' 
                        : 'bg-purple-500/20'
                      }
                    `}>
                      {selectedRoom.type === 'public' 
                        ? <Globe className="w-5 h-5 text-green-400" />
                        : <Lock className="w-5 h-5 text-purple-400" />
                      }
                    </div>
                    <div>
                      <h4 className="font-bold text-white">{selectedRoom.name}</h4>
                      <p className="text-xs text-gray-400">
                        {messages.length} messages • {selectedRoom.type === 'private' ? `Code: ${selectedRoom.code}` : 'Public Room'}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={loadMessages}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-400 py-12">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No messages yet</p>
                      <p className="text-sm">Be the first to send a message!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg._row_id}
                        className={`
                          group relative p-3 rounded-xl border transition-all
                          ${msg.device_id === 'admin-panel' 
                            ? 'bg-purple-500/10 border-purple-500/30 ml-8' 
                            : 'bg-white/5 border-white/10 mr-8'
                          }
                        `}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`
                              w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform
                              ${msg.device_id === 'admin-panel' 
                                ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                                : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                              }
                            `}
                            onClick={() => copyUsername(msg.sender_name)}
                            title="Click to use this username"
                            >
                              {msg.device_id === 'admin-panel' 
                                ? <Crown className="w-4 h-4 text-white" />
                                : <User className="w-4 h-4 text-white" />
                              }
                            </div>
                            <div>
                              <p 
                                className="font-medium text-sm cursor-pointer hover:text-purple-400 transition-colors"
                                onClick={() => copyUsername(msg.sender_name)}
                                title="Click to use this username"
                              >
                                {msg.sender_name}
                                {msg.device_id === 'admin-panel' && (
                                  <Badge className="ml-2 text-xs bg-purple-600/50 text-purple-200">Admin</Badge>
                                )}
                              </p>
                              <p className="text-xs text-gray-400">{formatTime(msg._created_at)}</p>
                            </div>
                          </div>
                          
                          {/* Admin Actions */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              onClick={() => handleDeleteMessage(msg._row_id)}
                              title="Delete message"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                            {msg.device_id !== 'admin-panel' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-orange-400 hover:text-orange-300 hover:bg-orange-500/20"
                                onClick={() => handleBanUser(msg.sender_name, msg.device_id)}
                                title="Ban user"
                              >
                                <Ban className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="text-white mt-2 text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.device_id && msg.device_id !== 'admin-panel' && (
                          <p className="text-xs text-gray-500 mt-1">
                            Device: {msg.device_id.substring(0, 16)}...
                          </p>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input Area */}
              <div className="border-t border-white/10 p-4 bg-black/20">
                {/* Admin Controls */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {/* Username Input */}
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <User className="w-4 h-4 text-gray-400" />
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Your username..."
                      className="h-8 bg-white/5 border-white/10 text-sm"
                    />
                  </div>
                  
                  {/* Message Type Buttons */}
                  <div className="flex gap-1">
                    {(['normal', 'announcement', 'warning', 'system'] as const).map((type) => (
                      <Button
                        key={type}
                        size="sm"
                        variant={messageType === type ? 'default' : 'outline'}
                        onClick={() => setMessageType(type)}
                        className={`
                          h-8 text-xs capitalize
                          ${messageType === type 
                            ? type === 'normal' ? 'bg-blue-600' 
                              : type === 'announcement' ? 'bg-purple-600'
                              : type === 'warning' ? 'bg-orange-600'
                              : 'bg-gray-600'
                            : 'border-white/20'
                          }
                        `}
                      >
                        {type === 'announcement' && <Megaphone className="w-3 h-3 mr-1" />}
                        {type === 'warning' && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {type === 'system' && <Bell className="w-3 h-3 mr-1" />}
                        {type === 'normal' && <MessageSquare className="w-3 h-3 mr-1" />}
                        {type}
                      </Button>
                    ))}
                  </div>
                  
                  {/* Incognito Mode Toggle */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIncognitoMode(!incognitoMode)}
                    className={`h-8 text-xs ${incognitoMode ? 'border-green-500 text-green-400 bg-green-500/20' : 'border-white/20'}`}
                    title={incognitoMode ? "Incognito: Messages look like regular user" : "Normal: Shows admin badge"}
                  >
                    {incognitoMode ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                    {incognitoMode ? 'Incognito ON' : 'Visible'}
                  </Button>
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Send message as "${senderName}"...`}
                    className="flex-1 bg-white/5 border-white/10"
                    disabled={loading}
                  />
                  <Button
                    type="submit"
                    disabled={loading || !newMessage.trim()}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </form>

                {/* Tips */}
                <div className="text-xs text-gray-500 mt-2 space-y-1">
                  <p>💡 <span className="text-purple-400">Click any username</span> to impersonate that user</p>
                  <p>🕵️ <span className="text-green-400">Incognito mode</span> hides admin badge and makes messages look like regular user</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <h4 className="text-lg font-medium mb-2">Select a Room</h4>
                <p className="text-sm">Choose a room from the sidebar to start chatting</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AdminMessaging;
