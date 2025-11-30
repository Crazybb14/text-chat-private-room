import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Clock
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

interface SentMessage {
  id: number;
  roomId: number;
  roomName: string;
  content: string;
  messageType: string;
  timestamp: number;
}

const AdminMessaging = () => {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'normal' | 'announcement' | 'warning' | 'system'>('normal');
  const [senderName, setSenderName] = useState('Admin');
  const [loading, setLoading] = useState(false);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [broadcastMode, setBroadcastMode] = useState(false);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      const roomsData = await db.query('rooms', { order: '_created_at.desc' });
      setRooms(roomsData);
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  const sendMessageToRoom = async (room: Room) => {
    if (!message.trim()) return;

    setLoading(true);
    try {
      // Format message based on type
      let formattedContent = message;
      let isSystemMessage = 0;

      switch (messageType) {
        case 'announcement':
          formattedContent = `📢 ANNOUNCEMENT: ${message}`;
          isSystemMessage = 1;
          break;
        case 'warning':
          formattedContent = `⚠️ WARNING: ${message}`;
          isSystemMessage = 1;
          break;
        case 'system':
          formattedContent = `🔧 SYSTEM: ${message}`;
          isSystemMessage = 1;
          break;
        default:
          formattedContent = message;
      }

      await db.insert('messages', {
        room_id: room._row_id,
        sender_name: messageType === 'normal' ? senderName : `[${messageType.toUpperCase()}]`,
        content: formattedContent,
        is_ai: isSystemMessage,
        device_id: 'admin-panel',
      });

      // Track sent message
      setSentMessages(prev => [{
        id: Date.now(),
        roomId: room._row_id,
        roomName: room.name,
        content: formattedContent,
        messageType,
        timestamp: Date.now()
      }, ...prev].slice(0, 20));

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast({
        title: 'Message required',
        description: 'Please enter a message to send',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      if (broadcastMode) {
        // Send to all rooms
        let successCount = 0;
        for (const room of rooms) {
          const success = await sendMessageToRoom(room);
          if (success) successCount++;
        }

        toast({
          title: '📢 Broadcast Sent!',
          description: `Message sent to ${successCount} of ${rooms.length} rooms`,
        });
      } else if (selectedRoom) {
        // Send to selected room only
        const success = await sendMessageToRoom(selectedRoom);
        if (success) {
          toast({
            title: '✅ Message Sent!',
            description: `Message sent to "${selectedRoom.name}"`,
          });
        }
      } else {
        toast({
          title: 'No room selected',
          description: 'Please select a room or enable broadcast mode',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      setMessage('');
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

  const getMessageTypeColor = (type: string) => {
    const colors = {
      normal: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      announcement: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      warning: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      system: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    };
    return colors[type as keyof typeof colors] || colors.normal;
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'announcement': return <Megaphone className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'system': return <Bell className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Admin Messaging Center
        </h3>
        <Button onClick={loadRooms} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Rooms
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Room Selection */}
        <Card className="glass-morphism border-white/10 bg-gradient-to-br from-purple-900/30 to-indigo-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-300">
              <Users className="w-5 h-5" />
              Select Room
            </CardTitle>
            <CardDescription className="text-purple-400/80">
              Choose a room to send messages to
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Broadcast Toggle */}
            <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={broadcastMode}
                  onChange={(e) => {
                    setBroadcastMode(e.target.checked);
                    if (e.target.checked) setSelectedRoom(null);
                  }}
                  className="w-5 h-5 rounded accent-yellow-500"
                />
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-yellow-400" />
                  <span className="font-medium text-yellow-300">Broadcast to ALL Rooms</span>
                </div>
              </label>
              {broadcastMode && (
                <p className="text-xs text-yellow-400/80 mt-2 ml-8">
                  Message will be sent to {rooms.length} rooms
                </p>
              )}
            </div>

            {/* Room List */}
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {rooms.map((room) => (
                  <button
                    key={room._row_id}
                    onClick={() => {
                      setSelectedRoom(room);
                      setBroadcastMode(false);
                    }}
                    disabled={broadcastMode}
                    className={`
                      w-full p-3 rounded-lg text-left transition-all
                      ${broadcastMode ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'}
                      ${selectedRoom?._row_id === room._row_id && !broadcastMode
                        ? 'bg-purple-600/30 border-2 border-purple-500'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-10 h-10 rounded-lg flex items-center justify-center
                          ${room.type === 'public' 
                            ? 'bg-green-500/20' 
                            : 'bg-purple-500/20'
                          }
                        `}>
                          {room.type === 'public' 
                            ? <Globe className="w-5 h-5 text-green-400" />
                            : <Lock className="w-5 h-5 text-purple-400" />
                          }
                        </div>
                        <div>
                          <p className="font-medium text-white">{room.name}</p>
                          <p className="text-xs text-gray-400">
                            {room.type === 'public' ? 'Public Room' : `Code: ${room.code}`}
                          </p>
                        </div>
                      </div>
                      <Badge className={room.type === 'public' ? 'bg-green-600' : 'bg-purple-600'}>
                        {room.type}
                      </Badge>
                    </div>
                  </button>
                ))}

                {rooms.length === 0 && (
                  <p className="text-center text-gray-400 py-8">No rooms found</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message Composer */}
        <Card className="lg:col-span-2 glass-morphism border-white/10 bg-gradient-to-br from-pink-900/30 to-rose-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-pink-300">
              <Crown className="w-5 h-5" />
              Compose Admin Message
            </CardTitle>
            <CardDescription className="text-pink-400/80">
              Send messages directly to any chat room
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Target Display */}
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-sm text-gray-400 mb-1">Sending to:</p>
              {broadcastMode ? (
                <div className="flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-yellow-400" />
                  <span className="font-bold text-yellow-300">ALL ROOMS ({rooms.length})</span>
                </div>
              ) : selectedRoom ? (
                <div className="flex items-center gap-2">
                  {selectedRoom.type === 'public' 
                    ? <Globe className="w-5 h-5 text-green-400" />
                    : <Lock className="w-5 h-5 text-purple-400" />
                  }
                  <span className="font-bold text-white">{selectedRoom.name}</span>
                  {selectedRoom.code && (
                    <Badge variant="outline" className="text-xs">
                      Code: {selectedRoom.code}
                    </Badge>
                  )}
                </div>
              ) : (
                <span className="text-gray-500">No room selected</span>
              )}
            </div>

            {/* Message Type */}
            <div>
              <Label className="text-pink-300 mb-2 block">Message Type</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['normal', 'announcement', 'warning', 'system'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setMessageType(type)}
                    className={`
                      p-3 rounded-lg border transition-all flex items-center justify-center gap-2
                      ${messageType === type 
                        ? getMessageTypeColor(type) + ' ring-2 ring-offset-2 ring-offset-background'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-400'
                      }
                    `}
                  >
                    {getMessageTypeIcon(type)}
                    <span className="capitalize text-sm font-medium">{type}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sender Name (for normal messages) */}
            {messageType === 'normal' && (
              <div>
                <Label htmlFor="sender-name" className="text-pink-300">Sender Name</Label>
                <Input
                  id="sender-name"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Admin"
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            )}

            {/* Message Content */}
            <div>
              <Label htmlFor="message-content" className="text-pink-300">Message</Label>
              <Textarea
                id="message-content"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={4}
                className="bg-white/5 border-white/10 text-white resize-none"
              />
            </div>

            {/* Preview */}
            {message && (
              <div className="p-4 rounded-lg bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-white/10">
                <p className="text-xs text-gray-400 mb-2">Preview:</p>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-purple-300">
                      {messageType === 'normal' ? senderName : `[${messageType.toUpperCase()}]`}
                    </p>
                    <p className="text-white">
                      {messageType === 'announcement' && '📢 ANNOUNCEMENT: '}
                      {messageType === 'warning' && '⚠️ WARNING: '}
                      {messageType === 'system' && '🔧 SYSTEM: '}
                      {message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Send Button */}
            <Button
              onClick={handleSendMessage}
              disabled={loading || !message.trim() || (!selectedRoom && !broadcastMode)}
              className={`
                w-full py-6 text-lg font-bold transition-all
                ${broadcastMode 
                  ? 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
                }
              `}
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Send className="w-5 h-5 mr-2" />
              )}
              {broadcastMode ? 'Broadcast to All Rooms' : 'Send Message'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sent Messages */}
      {sentMessages.length > 0 && (
        <Card className="glass-morphism border-white/10 bg-gradient-to-br from-green-900/30 to-emerald-900/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-300">
              <CheckCircle2 className="w-5 h-5" />
              Recently Sent Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sentMessages.map((msg) => (
                <div key={msg.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getMessageTypeColor(msg.messageType)}`}>
                      {getMessageTypeIcon(msg.messageType)}
                    </div>
                    <div>
                      <p className="text-sm text-white truncate max-w-md">
                        {msg.content.substring(0, 50)}...
                      </p>
                      <p className="text-xs text-gray-400">
                        Sent to: <span className="text-purple-300">{msg.roomName}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminMessaging;
