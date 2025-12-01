import React, { useState, useEffect } from "react";
import { User, Mail, Calendar, Users, Settings, MessageCircle, UserPlus, X, Check, Clock, MapPin, Globe, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface UserProfile {
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  last_seen: number;
  timezone: string;
  language: string;
  theme: string;
  notifications_enabled: boolean;
  friend_requests_enabled: boolean;
}

interface UserProfileProps {
  userId: string;
  currentUserId: string;
  username: string;
  isOpen: boolean;
  onClose: () => void;
  isOwnProfile?: boolean;
}

const UserProfile = ({ userId, currentUserId, username, isOpen, onClose, isOwnProfile = false }: UserProfileProps) => {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted' | 'sent'>('none');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    timezone: '',
    language: 'en',
    theme: 'dark',
    notifications_enabled: true,
    friend_requests_enabled: true
  });

  // Load user profile data
  useEffect(() => {
    if (isOpen && userId) {
      loadUserProfile();
      loadFriendStatus();
    }
  }, [isOpen, userId, currentUserId]);

  const loadUserProfile = async () => {
    try {
      const profiles = await db.query("user_profiles", { user_id: `eq.${userId}` });
      if (profiles.length > 0) {
        const userProfile = profiles[0] as UserProfile;
        setProfile(userProfile);
        setEditForm({
          display_name: userProfile.display_name || '',
          bio: userProfile.bio || '',
          timezone: userProfile.timezone || '',
          language: userProfile.language || 'en',
          theme: userProfile.theme || 'dark',
          notifications_enabled: userProfile.notifications_enabled || true,
          friend_requests_enabled: userProfile.friend_requests_enabled || true
        });
      } else {
        // Create default profile if doesn't exist
        const defaultProfile: Partial<UserProfile> = {
          user_id: userId,
          username: username,
          display_name: username,
          bio: '',
          avatar_url: '',
          status: 'online',
          last_seen: Date.now(),
          timezone: '',
          language: 'en',
          theme: 'dark',
          notifications_enabled: true,
          friend_requests_enabled: true
        };
        await db.insert("user_profiles", defaultProfile);
        setProfile(defaultProfile as UserProfile);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      toast({
        title: "Error",
        description: "Failed to load user profile.",
        variant: "destructive"
      });
    }
  };

  const loadFriendStatus = async () => {
    try {
      if (currentUserId === userId) {
        setFriendStatus('accepted'); // It's their own profile
        return;
      }

      // Check if they are friends
      const friendships = await db.query("friendships", {
        user_id: `eq.${currentUserId}`,
        friend_id: `eq.${userId}`
      });

      if (friendships.length > 0) {
        const friendship = friendships[0];
        if (friendship.status === 'accepted') {
          setFriendStatus('accepted');
        } else if (friendship.status === 'pending') {
          setFriendStatus(friendship.requested_by === currentUserId ? 'sent' : 'pending');
        }
      } else {
        setFriendStatus('none');
      }
    } catch (error) {
      console.error('Error loading friend status:', error);
    }
  };

  const sendFriendRequest = async () => {
    setIsLoading(true);
    try {
      await db.insert("friend_requests", {
        from_user_id: currentUserId,
        to_user_id: userId,
        message: requestMessage,
        status: 'pending'
      });

      await db.insert("friendships", {
        user_id: currentUserId,
        friend_id: userId,
        status: 'pending',
        requested_by: currentUserId
      });

      setFriendStatus('sent');
      setShowRequestModal(false);
      setRequestMessage('');
      toast({
        title: "Friend Request Sent",
        description: `Your friend request has been sent to ${username}.`
      });
    } catch (error) {
      console.error('Error sending friend request:', error);
      toast({
        title: "Error",
        description: "Failed to send friend request.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const acceptFriendRequest = async () => {
    setIsLoading(true);
    try {
      // Update friendship status
      await db.update("friendships", 
        { user_id: `eq.${userId}`, friend_id: `eq.${currentUserId}` }, 
        { status: 'accepted' }
      );

      await db.update("friendships", 
        { user_id: `eq.${currentUserId}`, friend_id: `eq.${userId}` }, 
        { status: 'accepted' }
      );

      // Update friend request status
      await db.update("friend_requests", 
        { from_user_id: `eq.${userId}`, to_user_id: `eq.${currentUserId}` }, 
        { status: 'accepted' }
      );

      setFriendStatus('accepted');
      toast({
        title: "Friend Request Accepted",
        description: `You are now friends with ${username}!`
      });
    } catch (error) {
      console.error('Error accepting friend request:', error);
      toast({
        title: "Error",
        description: "Failed to accept friend request.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const declineFriendRequest = async () => {
    setIsLoading(true);
    try {
      // Update friendship status
      await db.update("friendships", 
        { user_id: `eq.${userId}`, friend_id: `eq.${currentUserId}` }, 
        { status: 'declined' }
      );

      await db.update("friendships", 
        { user_id: `eq.${currentUserId}`, friend_id: `eq.${userId}` }, 
        { status: 'declined' }
      );

      // Update friend request status
      await db.update("friend_requests", 
        { from_user_id: `eq.${userId}`, to_user_id: `eq.${currentUserId}` }, 
        { status: 'declined' }
      );

      setFriendStatus('none');
      toast({
        title: "Friend Request Declined",
        description: "The friend request has been declined."
      });
    } catch (error) {
      console.error('Error declining friend request:', error);
      toast({
        title: "Error",
        description: "Failed to decline friend request.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async () => {
    setIsLoading(true);
    try {
      await db.update("user_profiles", 
        { user_id: `eq.${currentUserId}` }, 
        {
          display_name: editForm.display_name,
          bio: editForm.bio,
          timezone: editForm.timezone,
          language: editForm.language,
          theme: editForm.theme,
          notifications_enabled: editForm.notifications_enabled,
          friend_requests_enabled: editForm.friend_requests_enabled
        }
      );

      await loadUserProfile();
      setIsEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully."
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string, lastSeen: number) => {
    if (status === 'online') return 'Online';
    if (status === 'away') return 'Away';
    if (status === 'busy') return 'Busy';
    
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return lastSeenDate.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback>{profile?.display_name?.[0]?.toUpperCase() || username[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className={`absolute bottom-0 right-0 w-4 h-4 ${getStatusColor(profile?.status || 'offline')} rounded-full border-2 border-white dark:border-gray-900`} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {profile?.display_name || username}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">@{username}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className={`w-2 h-2 ${getStatusColor(profile?.status || 'offline')} rounded-full`} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {getStatusText(profile?.status || 'offline', profile?.last_seen || 0)}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {isEditing && isOwnProfile ? (
              // Edit Profile Form
              <div className="space-y-4">
                <div>
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={editForm.display_name}
                    onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                    placeholder="Enter your display name"
                  />
                </div>
                <div>
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={editForm.bio}
                    onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                    placeholder="Tell us about yourself"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={editForm.timezone}
                    onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                    placeholder="e.g., America/New_York"
                  />
                </div>
                <div>
                  <Label htmlFor="language">Language</Label>
                  <select
                    id="language"
                    value={editForm.language}
                    onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
                    className="w-full p-2 border rounded-md bg-white dark:bg-gray-800"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="zh">Chinese</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="notifications"
                    checked={editForm.notifications_enabled}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, notifications_enabled: checked })}
                  />
                  <Label htmlFor="notifications">Enable notifications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="friend_requests"
                    checked={editForm.friend_requests_enabled}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, friend_requests_enabled: checked })}
                  />
                  <Label htmlFor="friend_requests">Allow friend requests</Label>
                </div>
                <div className="flex space-x-2">
                  <Button onClick={updateProfile} disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // Profile View
              <>
                {/* Bio Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <User className="w-5 h-5" />
                      <span>About</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {profile?.bio ? (
                      <p className="text-gray-700 dark:text-gray-300">{profile.bio}</p>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 italic">No bio available</p>
                    )}
                  </CardContent>
                </Card>

                {/* User Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">Joined {profile ? new Date(profile._created_at * 1000).toLocaleDateString() : 'Unknown'}</span>
                      </div>
                    </CardContent>
                  </Card>
                  {profile?.timezone && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">{profile.timezone}</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Friend Actions */}
                {!isOwnProfile && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-semibold mb-4">Friend Actions</h3>
                    <div className="flex flex-wrap gap-2">
                      {friendStatus === 'none' && (
                        <Button onClick={() => setShowRequestModal(true)}>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add Friend
                        </Button>
                      )}
                      {friendStatus === 'pending' && (
                        <>
                          <Button onClick={acceptFriendRequest} disabled={isLoading}>
                            <Check className="w-4 h-4 mr-2" />
                            Accept Request
                          </Button>
                          <Button variant="outline" onClick={declineFriendRequest} disabled={isLoading}>
                            <X className="w-4 h-4 mr-2" />
                            Decline
                          </Button>
                        </>
                      )}
                      {friendStatus === 'sent' && (
                        <Badge variant="secondary" className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Request Sent</span>
                        </Badge>
                      )}
                      {friendStatus === 'accepted' && (
                        <>
                          <Badge variant="default" className="flex items-center space-x-1">
                            <Users className="w-3 h-3" />
                            <span>Friends</span>
                          </Badge>
                          <Button variant="outline">
                            <MessageCircle className="w-4 h-4 mr-2" />
                            Message
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit Profile Button (only for own profile) */}
                {isOwnProfile && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <Button onClick={() => setIsEditing(true)}>
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Friend Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Send Friend Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="message">Message (optional)</Label>
                <Textarea
                  id="message"
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Add a personal message..."
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <Button onClick={sendFriendRequest} disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Request'}
                </Button>
                <Button variant="outline" onClick={() => setShowRequestModal(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default UserProfile;