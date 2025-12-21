import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus, Ban, MessageSquare, User, Copy, Flag, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { FriendManager } from "@/lib/friendSystem";
import db from "@/lib/shared/kliv-database.js";
import EnhancedReportDialog from "@/components/EnhancedReportDialog";
import ProfileSystem from "@/components/ProfileSystem";

interface UsernameClickMenuProps {
  username: string;
  currentUsername: string;
  onSendMessage?: (username: string) => void;
}

const UsernameClickMenu = ({ username, currentUsername, onSendMessage }: UsernameClickMenuProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const handleAddFriend = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      await FriendManager.sendFriendRequest(currentUsername, username);
      toast({
        title: "Friend Request Sent",
        description: `Friend request sent to ${username}`,
      });
    } catch (error) {
      console.log("Friend request error:", error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async () => {
    try {
      await FriendManager.blockUser(currentUsername, username);
      toast({
        title: "User Blocked",
        description: `${username} has been blocked`,
      });
    } catch (error) {
      console.log("Block user error:", error);
      toast({
        title: "Error",
        description: "Failed to block user",
        variant: "destructive"
      });
    }
  };

  const handleReportUser = async () => {
    try {
      await db.insert("reports", {
        reporter_username: currentUsername,
        reported_username: username,
        reason: "User reported via context menu",
        _created_at: Date.now()
      });
      
      toast({
        title: "User Reported",
        description: `${username} has been reported to admin`,
      });
    } catch (error) {
      console.log("Report error:", error);
      toast({
        title: "Error",
        description: "Failed to report user",
        variant: "destructive"
      });
    }
  };

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(username);
    toast({
      title: "Username Copied",
      description: `${username} copied to clipboard`,
    });
  };

  const handleSendMessage = () => {
    if (onSendMessage) {
      onSendMessage(username);
    }
  };

  const handleViewProfile = () => {
    setProfileDialogOpen(true);
  };

  const handleReport = () => {
    setReportDialogOpen(true);
  };

  const isOwnUsername = username === currentUsername;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span className="text-blue-400 hover:text-blue-300 cursor-pointer hover:underline transition-colors">
            {username}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-background border-white/10">
          <DropdownMenuItem onClick={handleViewProfile}>
            <Eye className="w-3 h-3 mr-2" />
            View Profile
          </DropdownMenuItem>
          
          {!isOwnUsername && (
            <>
              <DropdownMenuItem onClick={handleSendMessage}>
                <MessageSquare className="w-3 h-3 mr-2" />
                Message
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAddFriend} disabled={loading}>
                <UserPlus className="w-3 h-3 mr-2" />
                Add Friend
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          <DropdownMenuItem onClick={handleCopyUsername}>
            <Copy className="w-3 h-3 mr-2" />
            Copy Username
          </DropdownMenuItem>
          
          {!isOwnUsername && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleReport} className="text-orange-400">
                <Flag className="w-3 h-3 mr-2" />
                Report
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBlockUser} className="text-destructive">
                <UserMinus className="w-3 h-3 mr-2" />
                Block
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Report Dialog */}
      <EnhancedReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        reportedUsername={username}
        currentUsername={currentUsername}
      />

      {/* Profile Dialog */}
      <ProfileSystem
        open={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        currentUsername={currentUsername}
        targetUsername={username}
        isOwnProfile={false}
      />
    </>
  );
};

export default UsernameClickMenu;