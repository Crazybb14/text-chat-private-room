import React, { useState, useEffect, useRef } from "react";
import { Users, ChevronLeft, ChevronRight, UserPlus, Search, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface RoomMember {
  _row_id: number;
  room_id: number;
  user_id: string;
  username: string;
  joined_at: number;
  last_active: number;
  is_private_room: boolean;
  profile?: {
    display_name: string;
    avatar_url: string;
    status: 'online' | 'away' | 'busy' | 'offline';
    last_seen: number;
  };
}

interface RoomMembersSidebarProps {
  roomId: number;
  isPrivateRoom: boolean;
  currentUserId: string;
  currentUsername: string;
  onUserClick: (userId: string, username: string) => void;
}

const RoomMembersSidebar = ({ 
  roomId, 
  isPrivateRoom, 
  currentUserId, 
  currentUsername,
  onUserClick 
}: RoomMembersSidebarProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load room members
  useEffect(() => {
    loadRoomMembers();
    
    // Set up real-time updates
    intervalRef.current = setInterval(() => {
      loadRoomMembers();
    }, 5000); // Update every 5 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [roomId]);

  // Update current user's activity in room
  useEffect(() => {
    if (roomId && currentUserId) {
      updateUserActivity();
    }
  }, [roomId, currentUserId]);

  const loadRoomMembers = async () => {
    try {
      const membersData = await db.query("room_members", { room_id: `eq.${roomId}` });
      
      // Enrich with profile data
      const enrichedMembers = await Promise.all(
        membersData.map(async (member: RoomMember) => {
          try {
            const profiles = await db.query("user_profiles", { user_id: `eq.${member.user_id}` });
            return {
              ...member,
              profile: profiles.length > 0 ? profiles[0] : null
            };
          } catch (error) {
            return { ...member, profile: null };
          }
        })
      );

      setMembers(enrichedMembers);
      
      // Count online members
      const onlineMembers = enrichedMembers.filter(member => {
        if (!member.profile) return false;
        
        const status = member.profile.status;
        if (status === 'online') return true;
        if (status === 'away' || status === 'busy') {
          const lastSeenMinutes = (Date.now() - member.profile.last_seen) / (1000 * 60);
          return lastSeenMinutes < 10; // Consider away/busy as "online" for 10 minutes
        }
        return false;
      });
      
      setOnlineCount(onlineMembers.length);
    } catch (error) {
      console.error('Error loading room members:', error);
    }
  };

  const updateUserActivity = async () => {
    try {
      // Check if user is already in the room
      const existingMembers = await db.query("room_members", {
        room_id: `eq.${roomId}`,
        user_id: `eq.${currentUserId}`
      });

      if (existingMembers.length === 0) {
        // Add user to room
        await db.insert("room_members", {
          room_id: roomId,
          user_id: currentUserId,
          username: currentUsername,
          is_private_room: isPrivateRoom ? 1 : 0
        });
      } else {
        // Update last activity
        await db.update("room_members",
          { room_id: `eq.${roomId}`, user_id: `eq.${currentUserId}` },
          { last_active: Date.now() }
        );
      }

      // Update user status in profile
      const profiles = await db.query("user_profiles", { user_id: `eq.${currentUserId}` });
      if (profiles.length > 0) {
        await db.update("user_profiles",
          { user_id: `eq.${currentUserId}` },
          { 
            status: 'online',
            last_seen: Date.now()
          }
        );
      } else {
        // Create profile if doesn't exist
        await db.insert("user_profiles", {
          user_id: currentUserId,
          username: currentUsername,
          display_name: currentUsername,
          status: 'online',
          last_seen: Date.now()
        });
      }
    } catch (error) {
      console.error('Error updating user activity:', error);
    }
  };

  const getStatusColor = (status: string, lastSeen: number) => {
    if (status === 'online') return 'bg-green-500';
    if (status === 'away') return 'bg-yellow-500';
    if (status === 'busy') return 'bg-red-500';
    
    // For offline status, check how long they've been offline
    const lastSeenMinutes = (Date.now() - lastSeen) / (1000 * 60);
    if (lastSeenMinutes < 5) return 'bg-yellow-500'; // Recently active
    return 'bg-gray-500';
  };

  const getStatusText = (status: string, lastSeen: number) => {
    if (status === 'online') return 'Online';
    if (status === 'away') return 'Away';
    if (status === 'busy') return 'Busy';
    
    const lastSeenMinutes = (Date.now() - lastSeen) / (1000 * 60);
    if (lastSeenMinutes < 1) return 'Just now';
    if (lastSeenMinutes < 60) return `${Math.floor(lastSeenMinutes)}m ago`;
    if (lastSeenMinutes < 1440) return `${Math.floor(lastSeenMinutes / 60)}h ago`;
    return new Date(lastSeen).toLocaleDateString();
  };

  const filteredMembers = members.filter(member => 
    member.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.profile?.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedMembers = filteredMembers.sort((a, b) => {
    // Current user first
    if (a.user_id === currentUserId) return -1;
    if (b.user_id === currentUserId) return 1;
    
    // Then sort by online status
    const aOnline = a.profile?.status === 'online' ? 1 : 0;
    const bOnline = b.profile?.status === 'online' ? 1 : 0;
    
    if (aOnline !== bOnline) return bOnline - aOnline;
    
    // Then alphabetically
    const aName = a.profile?.display_name || a.username;
    const bName = b.profile?.display_name || b.username;
    return aName.localeCompare(bName);
  });

  return (
    <>
      {/* Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-4 top-1/2 transform -translate-y-1/2 z-40 bg-white dark:bg-gray-800 shadow-lg rounded-l-none rounded-r-lg border-r-0"
      >
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4" />
          <div className="flex flex-col items-center">
            <span className="text-xs">{onlineCount}</span>
            <span className="text-xs">online</span>
          </div>
          {isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </div>
      </Button>

      {/* Sidebar */}
      <div className={`fixed right-0 top-0 h-full bg-white dark:bg-gray-900 shadow-2xl z-30 transition-all duration-300 ${
        isOpen ? 'w-80' : 'w-0'
      } overflow-hidden`}>
        {isOpen && (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>Room Members</span>
                  <Badge variant="secondary">{onlineCount}</Badge>
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Members List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sortedMembers.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {searchTerm ? 'No members found' : 'No members in this room'}
                </p>
              ) : (
                sortedMembers.map((member) => {
                  const displayName = member.profile?.display_name || member.username;
                  const isCurrentUser = member.user_id === currentUserId;
                  
                  return (
                    <div
                      key={member._row_id}
                      className={`flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                        isCurrentUser ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : ''
                      }`}
                      onClick={() => onUserClick(member.user_id, member.username)}
                    >
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={member.profile?.avatar_url} />
                          <AvatarFallback>{displayName[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor(
                          member.profile?.status || 'offline', 
                          member.profile?.last_seen || 0
                        )} rounded-full border-2 border-white dark:border-gray-900`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-sm truncate">
                            {displayName}
                          </p>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          @{member.username}
                        </p>
                        <p className="text-xs text-gray-400">
                          {getStatusText(member.profile?.status || 'offline', member.profile?.last_seen || 0)}
                        </p>
                      </div>

                      {/* Add Friend Button (for non-friends, non-current users) */}
                      {!isCurrentUser && member.profile && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            // This will trigger the friend request in the UserProfile component
                            onUserClick(member.user_id, member.username);
                          }}
                          className="opacity-0 hover:opacity-100 transition-opacity"
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {members.length} total members • {onlineCount} online
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default RoomMembersSidebar;