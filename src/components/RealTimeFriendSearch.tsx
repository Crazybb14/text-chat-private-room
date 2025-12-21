import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, Users, X, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface User {
  username: string;
  device_id: string;
  status: string;
  last_seen: number;
}

interface RealTimeFriendSearchProps {
  currentUsername: string;
  onSelectUser: (username: string) => void;
}

const RealTimeFriendSearch = ({ currentUsername, onSelectUser }: RealTimeFriendSearchProps) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (searchTerm.length > 0) {
      searchUsers();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const searchUsers = async () => {
    if (searchTerm.length < 1) return;
    
    setLoading(true);
    try {
      // Search for users by username
      const users = await db.query("messages", {
        order: "_created_at.desc",
        limit: 1000
      });
      
      // Get unique users from messages
      const uniqueUsers: { [key: string]: User } = {};
      users.forEach((message: { sender_name?: string; device_id?: string; _created_at: number }) => {
        if (message.sender_name && message.sender_name !== currentUsername) {
          if (!uniqueUsers[message.sender_name]) {
            uniqueUsers[message.sender_name] = {
              username: message.sender_name,
              device_id: message.device_id || "",
              status: 'offline',
              last_seen: message._created_at
            };
          }
        }
      });

      // Filter by search term
      const filtered = Object.values(uniqueUsers).filter(user =>
        user.username.toLowerCase().startsWith(searchTerm.toLowerCase())
      ).slice(0, 20); // Limit to 20 results

      setSearchResults(filtered);
    } catch (error) {
      console.log("Error searching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (username: string) => {
    onSelectUser(username);
    setSearchTerm("");
    setIsOpen(false);
  };

  const getStatusBadge = (status: string, lastSeen: number) => {
    const now = Date.now();
    const minutesAgo = Math.floor((now - lastSeen) / 60000);
    
    if (minutesAgo < 1) {
      return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">Online</Badge>;
    } else if (minutesAgo < 5) {
      return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">Away</Badge>;
    } else {
      return <Badge variant="outline">Offline</Badge>;
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="relative"
      >
        <Users className="w-4 h-4 mr-2" />
        Friends
        <Search className="w-4 h-4 ml-2" />
      </Button>
    );
  }

  return (
    <div className="absolute top-0 right-0 z-50 w-80 bg-background border border-white/10 rounded-lg shadow-2xl">
      <Card className="border-0 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Find Friends
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Type to search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-secondary/50 border-white/10"
              autoFocus
            />
          </div>
          
          <ScrollArea className="h-64">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                {searchTerm.length > 0 ? "No users found" : "Type to search..."}
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((user, index) => (
                  <div
                    key={user.username + index}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 cursor-pointer transition-colors"
                    onClick={() => handleSelectUser(user.username)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-semibold">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{user.username}</p>
                        <p className="text-xs text-gray-400">
                          Last seen: {new Date(user.last_seen * 1000).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getStatusBadge(user.status, user.last_seen)}
                      <Button size="sm" variant="outline">
                        <MessageSquare className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealTimeFriendSearch;