import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UserMinus, Shield, MessageSquare, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import EnhancedFriendRequest from "@/components/EnhancedFriendRequest";

interface UsernameClickMenuProps {
  username: string;
  currentUsername: string;
}

const UsernameClickMenu = ({ username, currentUsername }: UsernameClickMenuProps) => {
  const { toast } = useToast();
  const [showMenu, setShowMenu] = useState(false);

  if (username === currentUsername) {
    return <span className="font-medium">{username}</span>;
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="ghost"
        size="sm"
        className="p-0 h-auto font-medium text-blue-400 hover:text-blue-300 hover:bg-transparent"
        onClick={() => setShowMenu(!showMenu)}
      >
        <User className="w-3 h-3 mr-1" />
        {username}
      </Button>
      
      {showMenu && (
        <div className="absolute top-full left-0 mt-1 bg-background border border-white/10 rounded-lg shadow-lg p-2 z-50 min-w-32">
          <div className="space-y-1">
            <EnhancedFriendRequest
              currentUsername={currentUsername}
              targetUsername={username}
              onToggleFriend={() => setShowMenu(false)}
            />
            
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                toast({
                  title: "Direct Message",
                  description: "Direct messaging coming soon!"
                });
                setShowMenu(false);
              }}
            >
              <MessageSquare className="w-3 h-3 mr-2" />
              Message
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                toast({
                  title: "View Profile",
                  description: "User profiles coming soon!"
                });
                setShowMenu(false);
              }}
            >
              <User className="w-3 h-3 mr-2" />
              Profile
            </Button>
          </div>
        </div>
      )}
      
      {/* Close menu when clicking outside */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
};

export default UsernameClickMenu;