import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, Copy, Trash2, Users, Shield, Download, Upload, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface AdminAPIManagerProps {
  open: boolean;
  onClose: () => void;
}

const AdminAPIManager = ({ open, onClose }: AdminAPIManagerProps) => {
  const { toast } = useToast();
const [allApiKeys, setAllApiKeys] = useState<Array<{ _row_id: number; username: string; setting_key: string; setting_value: string; _created_at: number }>>([]);
  const [allUsers, setAllUsers] = useState<Array<{ _row_id: number; username: string }>>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "create" | "manage">("list");

  useEffect(() => {
    if (open) {
      loadAllApiKeys();
      loadAllUsers();
    }
  }, [open]);

  const loadAllApiKeys = async () => {
    try {
      const keys = await db.query("user_settings", { setting_key: "like.api_key_%" });
      console.log("Loaded all API keys:", keys);
      setAllApiKeys(keys || []);
    } catch (error) {
      console.log("Error loading API keys:", error);
    }
  };

  const loadAllUsers = async () => {
    try {
      const users = await db.query("user_profiles", {});
      console.log("Loaded users:", users);
      setAllUsers(users || []);
    } catch (error) {
      console.log("Error loading users:", error);
    }
  };

  const generateAdminAPIKey = async (targetUsername: string) => {
    if (!targetUsername.trim()) return;
    
    setLoading(true);
    try {
      // Generate unique 50-character API key
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let apiKey = 'ck_admin_';
      for (let i = 0; i < 40; i++) {
        apiKey += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const keyName = newKeyName.trim() || `admin_key_${Date.now()}`;
      
      await db.insert("user_settings", {
        username: targetUsername,
        setting_key: `api_key_${keyName}_${Date.now()}`,
        setting_value: apiKey,
        created_at: Date.now(),
        created_by: "admin"
      });
      
      setNewKeyName("");
      await loadAllApiKeys();
      
      toast({
        title: "Admin API Key Generated",
        description: `Generated for ${targetUsername}: ${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length-4)}`,
      });
    } catch (error) {
      console.log("Error generating admin API key:", error);
      toast({
        title: "Error",
        description: "Failed to generate admin API key",
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

  const deleteApiKey = async (rowId: number) => {
    try {
      await db.delete("user_settings", { _row_id: `eq.${rowId}` });
      await loadAllApiKeys();
      
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

  const exportApiKeys = () => {
    const csvContent = [
      ["Username", "Key Name", "API Key", "Created At"],
      ...allApiKeys.map(key => [
        key.username,
        key.setting_key.replace('api_key_', '').replace(/_\d+$/, ''),
        key.setting_value,
        new Date(key._created_at * 1000).toLocaleString()
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api_keys_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 bg-secondary/20 p-1 rounded-lg">
        <Button
          variant={activeTab === "list" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("list")}
          className="flex-1"
        >
          <Key className="w-4 h-4 mr-2" />
          All API Keys
        </Button>
        <Button
          variant={activeTab === "create" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("create")}
          className="flex-1"
        >
          <Shield className="w-4 h-4 mr-2" />
          Create for User
        </Button>
        <Button
          variant={activeTab === "manage" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("manage")}
          className="flex-1"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Manage
        </Button>
      </div>

      {/* List Tab */}
      {activeTab === "list" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-yellow-400" />
                All API Keys ({allApiKeys.length})
              </CardTitle>
              <CardDescription>
                View and manage all generated API keys
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={loadAllApiKeys} size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" onClick={exportApiKeys} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              {allApiKeys.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No API keys found</p>
              ) : (
                <div className="space-y-3">
                  {allApiKeys.map((key) => (
                    <div key={key._row_id} className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm flex items-center gap-2">
                          {key.username}
                          {key.setting_key.includes('admin') && (
                            <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">
                              Admin
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {key.setting_key.replace('api_key_', '').replace(/_\d+$/, '')}
                        </p>
                        <p className="text-xs font-mono text-gray-500 mt-1">
                          {key.setting_value.substring(0, 20)}...{key.setting_value.substring(key.setting_value.length - 8)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(key._created_at * 1000).toLocaleDateString()}
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
                          onClick={() => deleteApiKey(key._row_id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Create Tab */}
      {activeTab === "create" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Generate API Key for User
            </CardTitle>
            <CardDescription>
              Create API keys for specific users (they won't see these)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-400">Select User</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-secondary/50 border-white/10">
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map((user) => (
                    <SelectItem key={user._row_id} value={user.username}>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {user.username}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-400">Key Name (Optional)</label>
              <Input
                placeholder="Enter a descriptive name..."
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="bg-secondary/50 border-white/10"
              />
            </div>

            <Button
              onClick={() => generateAdminAPIKey(selectedUser)}
              disabled={!selectedUser || loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Key className="w-4 h-4 mr-2" />
              Generate Admin API Key
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-400">{allApiKeys.length}</div>
            <p className="text-sm text-gray-400">Total Keys</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-400">
              {allApiKeys.filter(k => !k.setting_key.includes('admin')).length}
            </div>
            <p className="text-sm text-gray-400">User Keys</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-400">
              {allApiKeys.filter(k => k.setting_key.includes('admin')).length}
            </div>
            <p className="text-sm text-gray-400">Admin Keys</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAPIManager;