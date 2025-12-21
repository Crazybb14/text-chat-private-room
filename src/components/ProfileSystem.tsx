import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, Camera, Edit2, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { content } from "@/lib/shared/kliv-content.js";
import db from "@/lib/shared/kliv-database.js";

interface ProfileSystemProps {
  open: boolean;
  onClose: () => void;
  currentUsername: string;
  targetUsername?: string;
  isOwnProfile: boolean;
}

interface UserProfile {
  username: string;
  bio: string;
  avatar_url: string;
  created_at: number;
  status: string;
}

const ProfileSystem = ({ open, onClose, currentUsername, targetUsername, isOwnProfile }: ProfileSystemProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<UserProfile>({
    username: targetUsername || currentUsername,
    bio: "",
    avatar_url: "",
    created_at: Date.now(),
    status: "active"
  });
  const [editing, setEditing] = useState(isOwnProfile);
  const [saveLoading, setSaveLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (open) {
      loadProfile();
    }
  }, [open, targetUsername]);

  const loadProfile = async () => {
    try {
      const profiles = await db.query("user_profiles", { 
        username: `eq.${targetUsername || currentUsername}` 
      });
      
      if (profiles.length > 0) {
        setProfile(profiles[0]);
      } else {
        // Create default profile
        const defaultProfile = {
          username: targetUsername || currentUsername,
          bio: "Hey there! I'm new here.",
          avatar_url: "",
          created_at: Date.now(),
          status: "active"
        };
        setProfile(defaultProfile);
        
        // Save default profile for new users
        await db.insert("user_profiles", defaultProfile);
      }
    } catch (error) {
      console.log("Error loading profile:", error);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "Error", 
        description: "Image must be less than 5MB",
        variant: "destructive"
      });
      return;
    }

    setUploadLoading(true);

    try {
      // Upload image to content filesystem
      const result = await content.uploadFile(file, `/content/avatars/${currentUsername}_${Date.now()}.jpg`);
      
      setPreviewUrl(result.contentUrl);
      setProfile(prev => ({ ...prev, avatar_url: result.contentUrl }));
      
      toast({
        title: "Image Uploaded",
        description: "Your profile picture has been updated"
      });
    } catch (error) {
      console.log("Error uploading image:", error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive"
      });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!isOwnProfile) return;

    setSaveLoading(true);
    
    try {
      const existingProfiles = await db.query("user_profiles", { 
        username: `eq.${currentUsername}` 
      });

      if (existingProfiles.length > 0) {
        // Update existing profile
        await db.update("user_profiles", { 
          _row_id: `eq.${existingProfiles[0]._row_id}` 
        }, {
          bio: profile.bio,
          avatar_url: profile.avatar_url,
          status: profile.status
        });
      } else {
        // Create new profile
        await db.insert("user_profiles", {
          username: currentUsername,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
          status: profile.status,
          created_at: Date.now()
        });
      }

      setEditing(false);
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully"
      });
    } catch (error) {
      console.log("Error saving profile:", error);
      toast({
        title: "Error",
        description: "Failed to save profile",
        variant: "destructive"
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleUsernameChange = async (newUsername: string) => {
    if (!newUsername.trim() || newUsername === currentUsername) return;
    
    try {
      // Check if username is available
      const existing = await db.query("user_profiles", { username: `eq.${newUsername}` });
      if (existing.length > 0) {
        toast({
          title: "Error",
          description: "Username is already taken",
          variant: "destructive"
        });
        return;
      }

      // Update username in profile and all related records
      await db.update("user_profiles", { username: `eq.${currentUsername}` }, { username: newUsername });
      
      // Handle admin panel username update if needed
      if (localStorage.getItem("isAdmin")) {
        localStorage.setItem("adminUsername", newUsername);
      }

      setProfile(prev => ({ ...prev, username: newUsername }));
      
      toast({
        title: "Username Updated",
        description: `Your username is now: ${newUsername}`
      });
      
      // Refresh page to update all components
      setTimeout(() => window.location.reload(), 1000);
      
    } catch (error) {
      console.log("Error updating username:", error);
      toast({
        title: "Error",
        description: "Failed to update username",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-gradient-to-b from-gray-900 to-gray-950 border-gray-800">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <User className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {isOwnProfile ? "Your Profile" : `${profile.username}'s Profile`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar Section */}
          <Card className="glass-morphism border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Profile Picture</span>
                {isOwnProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadLoading}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {uploadLoading ? "Uploading..." : "Change"}
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Avatar className="w-32 h-32">
                <AvatarImage src={previewUrl || profile.avatar_url} />
                <AvatarFallback className="text-3xl bg-gradient-to-br from-blue-500 to-purple-600">
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* User Info Section */}
          <Card className="glass-morphism border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Personal Information</span>
                {isOwnProfile && (
                  <div className="flex gap-2">
                    {editing ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(false)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSaveProfile}
                          disabled={saveLoading}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {saveLoading ? "Saving..." : "Save"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(true)}
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    )}
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Username */}
              <div>
                <label className="text-sm font-medium text-gray-400 flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" />
                  Username
                </label>
                {editing && isOwnProfile ? (
                  <Input
                    value={profile.username}
                    onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
                    className="bg-secondary/50 border-white/10"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">{profile.username}</p>
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                      Active
                    </Badge>
                  </div>
                )}
              </div>

              {/* Bio */}
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2">Bio</label>
                {editing && isOwnProfile ? (
                  <Textarea
                    value={profile.bio}
                    onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Tell us about yourself..."
                    className="bg-secondary/50 border-white/10 min-h-[100px]"
                    maxLength={500}
                  />
                ) : (
                  <p className="text-gray-300">
                    {profile.bio || "No bio set yet."}
                  </p>
                )}
                {editing && isOwnProfile && (
                  <div className="text-sm text-gray-500 mt-1">
                    {profile.bio.length}/500 characters
                  </div>
                )}
              </div>

              {/* Account Info */}
              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Member Since</span>
                  <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-400">Status</span>
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                    Active
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-secondary/50 border-white/10"
            >
              Close
            </Button>
            {isOwnProfile && editing && (
              <Button
                onClick={handleSaveProfile}
                disabled={saveLoading}
                className="bg-gradient-to-r from-blue-600 to-purple-600"
              >
                {saveLoading ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSystem;