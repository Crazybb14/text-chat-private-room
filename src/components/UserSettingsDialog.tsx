import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Settings, User, Key, Shield, Copy, RefreshCw, Trash2, Users, MessageSquare, Globe, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import auth from "@/lib/shared/kliv-auth.js";

interface UserSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  username: string;
}

const UserSettingsDialog = ({ open, onClose, username }: UserSettingsDialogProps) => {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<Array<{ _row_id: number; setting_key: string; setting_value: string }>>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [directMessages, setDirectMessages] = useState<Array<{ _row_id: number; sender_username: string; recipient_username: string; content: string; _created_at: number; is_read: number }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (open) {
      loadApiKeys();
      loadDirectMessages();
    }
  }, [open]);

const loadApiKeys = async () => {
    try {
      // For demo, generate API keys from user settings
      const keys = await db.query("user_settings", { setting_key: "like.api_key_%", username: `eq.${username}` });
      console.log("Loaded API keys:", keys);
      setApiKeys(keys || []);
    } catch (error) {
      console.log("Error loading API keys:", error);
      setApiKeys([]);
    }
};

  const loadDirectMessages = async () => {
    try {
      const messages = await db.query("direct_messages", { 
        recipient_username: `eq.${username}`,
        is_read: `eq.0`
      });
      setDirectMessages(messages);
      setUnreadCount(messages.length);
    } catch (error) {
      console.log("Error loading direct messages:", error);
    }
  };

const generateApiKey = async () => {
    // Allow empty name - generate default if needed
    const keyName = newKeyName.trim() || `key_${Date.now()}`;
    
    setLoading(true);
    try {
      // Generate unique 50-character API key
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let apiKey = 'ck_';
      for (let i = 0; i < 47; i++) { // 47 chars + ck_ prefix = 50 total
        apiKey += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      console.log("Generating API key for:", username, "with name:", keyName);
      
      await db.insert("user_settings", {
        username: username,
        setting_key: `api_key_${keyName}_${Date.now()}`,
        setting_value: apiKey,
        created_at: Date.now()
      });
      
      setNewKeyName("");
      await loadApiKeys();
      
      toast({
        title: "API Key Generated",
        description: `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length-4)} (${apiKey.length} characters)`,
      });
} catch (error) {
      console.log("Error generating API key:", error);
      toast({
        title: "Error",
        description: "Failed to generate API key",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    toast({
      title: "API Key Copied",
      description: "Key copied to clipboard"
    });
  };

  const deleteApiKey = async (settingKey: string) => {
    try {
      await db.delete("user_settings", { setting_key: `eq.${settingKey}`, username: `eq.${username}` });
      await loadApiKeys();
      
      toast({
        title: "API Key Deleted",
        description: "Key has been removed permanently"
      });
    } catch (error) {
      console.log("Error deleting API key:", error);
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive"
      });
    }
  };

  const markDirectMessageAsRead = async (messageId: number) => {
    try {
      await db.update("direct_messages", { _row_id: `eq.${messageId}` }, { is_read: 1 });
      await loadDirectMessages();
    } catch (error) {
      console.log("Error marking message as read:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-gradient-to-b from-gray-900 to-gray-950 border-gray-800">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Settings
          </DialogTitle>
          <p className="text-gray-400 text-sm mt-2">
            Manage your profile, API keys, and privacy settings
          </p>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="api" className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-2 relative">
              <MessageSquare className="w-4 h-4" />
              Messages
              {unreadCount > 0 && (
                <Badge className="ml-1 h-5 w-5 rounded-full p-0 text-xs bg-red-500">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="privacy" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Privacy
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            {/* Profile Tab */}
            <TabsContent value="profile">
              <Card className="glass-morphism border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-400" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Your basic profile information and settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-400">Username</label>
                    <Input value={username} disabled className="bg-secondary/50 border-white/10" />
                    <p className="text-xs text-gray-500 mt-1">Your username is permanent and unique</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-400">Account Status</label>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                        Active
                      </Badge>
                      <span className="text-sm text-gray-400">Member since today</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* API Keys Tab */}
            <TabsContent value="api">
              <Card className="glass-morphism border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5 text-yellow-400" />
                    API Key Generation
                  </CardTitle>
                  <CardDescription>
                    Generate API keys for programmatic access. These keys can control your account completely!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Name your API key..."
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="bg-secondary/50 border-white/10"
                    />
                    <Button onClick={generateApiKey} disabled={loading} className="bg-yellow-600 hover:bg-yellow-700">
                      <Key className="w-4 h-4 mr-2" />
                      Generate
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-64">
                    {apiKeys.length === 0 ? (
                      <p className="text-center text-gray-400 py-8">No API keys generated yet</p>
                    ) : (
                      <div className="space-y-2">
                        {apiKeys.map((key) => (
                          <div key={key.setting_key} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                            <div>
                              <p className="font-medium text-sm">
                                {key.setting_key.replace('api_key_', '').replace(/_/g, ' ')}
                              </p>
                              <p className="text-xs text-gray-400 font-mono">
                                {key.setting_value.substring(0, 20)}...
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyApiKey(key.setting_value)}
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteApiKey(key.setting_key)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-sm text-yellow-400">
                      ⚠️ API keys give full control over your account. Keep them secret!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Direct Messages Tab */}
            <TabsContent value="messages">
              <Card className="glass-morphism border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-400" />
                    Direct Messages
                  </CardTitle>
                  <CardDescription>
                    Private messages from other users
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {directMessages.length === 0 ? (
                      <p className="text-center text-gray-400 py-8">No new messages</p>
                    ) : (
                      <div className="space-y-2">
                        {directMessages.map((message) => (
                          <div 
                            key={message._row_id} 
                            className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg cursor-pointer hover:bg-secondary/50"
                            onClick={() => markDirectMessageAsRead(message._row_id)}
                          >
                            <div>
                              <p className="font-medium text-sm">{message.sender_username}</p>
                              <p className="text-sm text-gray-400">{message.content}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(message._created_at * 1000).toLocaleString()}
                              </p>
                            </div>
                            <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                              New
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Friends Tab */}
            <TabsContent value="friends">
              <Card className="glass-morphism border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-400" />
                    Friends List
                  </CardTitle>
                  <CardDescription>
                    Manage your friends and friend requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-center text-gray-400 py-8">Friend list loading...</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Privacy Tab */}
            <TabsContent value="privacy">
              <Card className="glass-morphism border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-red-400" />
                    Privacy Settings
                  </CardTitle>
                  <CardDescription>
                    Control your privacy and security settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Allow direct messages</p>
                      <p className="text-xs text-gray-400">Others can send you private messages</p>
                    </div>
                    <Button variant="outline" size="sm">Enabled</Button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Show online status</p>
                      <p className="text-xs text-gray-400">Others can see when you're online</p>
                    </div>
                    <Button variant="outline" size="sm">Enabled</Button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Profile visibility</p>
                      <p className="text-xs text-gray-400">Who can see your profile</p>
                    </div>
                    <Button variant="outline" size="sm">Everyone</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default UserSettingsDialog;