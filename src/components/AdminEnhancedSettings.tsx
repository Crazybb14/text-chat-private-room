import React, { useState, useEffect } from "react";
import { Settings, Shield, Lock, Users, FileText, AlertTriangle, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";

interface Setting {
  setting_key: string;
  setting_value: string;
}

interface LockdownSetting {
  lockdown_active: string;
  lockdown_message: string;
  lockdown_image_url: string;
  lockdown_allow_admin: string;
}

const AdminEnhancedSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [lockdownSettings, setLockdownSettings] = useState<LockdownSetting>({
    lockdown_active: "false",
    lockdown_message: "System is currently locked down. Please try again later.",
    lockdown_image_url: "",
    lockdown_allow_admin: "true"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [adminSettings, lockdownData] = await Promise.all([
        db.query("admin_settings", {}),
        db.query("lockdown_settings", {})
      ]);

      const adminMap: Record<string, string> = {};
      adminSettings.forEach((s: Setting) => { 
        adminMap[s.setting_key] = s.setting_value; 
      });

      const lockdownMap: Partial<LockdownSetting> = {};
      lockdownData.forEach((s: Setting) => { 
        lockdownMap[s.setting_key as keyof LockdownSetting] = s.setting_value; 
      });

      setSettings(adminMap);
      setLockdownSettings({
        lockdown_active: lockdownMap.lockdown_active || "false",
        lockdown_message: lockdownMap.lockdown_message || "System is currently locked down. Please try again later.",
        lockdown_image_url: lockdownMap.lockdown_image_url || "",
        lockdown_allow_admin: lockdownMap.lockdown_allow_admin || "true"
      });
      
      setLoading(false);
    } catch (error) {
      console.error("Error loading settings:", error);
      setLoading(false);
    }
  };

  const saveSettings = async (category: string, categorySettings: Record<string, string>) => {
    setSaving(true);
    try {
      const deviceId = getDeviceId();
      
      for (const [key, value] of Object.entries(categorySettings)) {
        await db.upsert("admin_settings", { setting_key: key }, {
          setting_key: key,
          setting_value: value
        });
      }

      // Log the settings change
      await db.insert("ip_activity_logs", {
        device_id: deviceId,
        username: "admin",
        action: "settings_update",
        room_id: null,
        message_preview: `Updated ${category} settings`,
      });

      toast({
        title: "✅ Settings Saved",
        description: `${category} settings have been updated successfully`,
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "❌ Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveLockdownSettings = async () => {
    setSaving(true);
    try {
      const deviceId = getDeviceId();
      
      for (const [key, value] of Object.entries(lockdownSettings)) {
        await db.upsert("lockdown_settings", { setting_key: key }, {
          setting_key: key,
          setting_value: value,
          updated_by: deviceId
        });
      }

      toast({
        title: "✅ Lockdown Settings Saved",
        description: "Lockdown configuration has been updated",
      });
    } catch (error) {
      console.error("Error saving lockdown settings:", error);
      toast({
        title: "❌ Error",
        description: "Failed to save lockdown settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = (category: string) => {
    const defaultSettings: Record<string, Record<string, string>> = {
      security: {
        block_phone_numbers: "true",
        block_emails: "true",
        block_addresses: "true",
        block_social_security: "true",
        block_credit_cards: "true",
        block_ip_addresses: "true",
        instant_ban_profanity: "true",
        instant_ban_personal_info: "true",
        auto_ban_threshold: "3",
        ban_duration_hours: "24"
      },
      content: {
        require_file_approval_public: "true",
        require_file_approval_private: "false",
        max_file_size: "10485760",
        max_message_length: "1000",
        message_rate_limit: "5",
        file_rate_limit: "2"
      },
      moderation: {
        enable_auto_moderation: "true",
        strict_content_filter: "true",
        log_all_activity: "true",
        enable_report_system: "true",
        require_tos_acceptance: "true"
      },
      chat: {
        enable_public_rooms: "true",
        enable_private_rooms: "true",
        private_room_approval: "true",
        auto_delete_private_rooms: "true",
        private_room_inactive_hours: "1",
        enable_file_sharing: "true",
        enable_emoji_reactions: "true",
        enable_message_editing: "true",
        message_edit_timeout: "300"
      }
    };

    if (defaultSettings[category]) {
      setSettings({ ...settings, ...defaultSettings[category] });
      saveSettings(category, defaultSettings[category]);
    }
  };

  const settingsCategories = [
    {
      id: "security",
      title: "Security Settings",
      icon: <Shield className="w-5 h-5" />,
      settings: [
        { key: "block_phone_numbers", label: "Block Phone Numbers", type: "switch" },
        { key: "block_emails", label: "Block Email Addresses", type: "switch" },
        { key: "block_addresses", label: "Block Physical Addresses", type: "switch" },
        { key: "block_social_security", label: "Block SSN Numbers", type: "switch" },
        { key: "block_credit_cards", label: "Block Credit Card Numbers", type: "switch" },
        { key: "block_ip_addresses", label: "Block IP Addresses", type: "switch" },
        { key: "instant_ban_profanity", label: "Instant Ban for Profanity", type: "switch" },
        { key: "instant_ban_personal_info", label: "Instant Ban for Personal Info", type: "switch" },
        { key: "auto_ban_threshold", label: "Auto-ban Warning Threshold", type: "number" },
        { key: "ban_duration_hours", label: "Default Ban Duration (Hours)", type: "number" }
      ]
    },
    {
      id: "content",
      title: "Content & File Settings",
      icon: <FileText className="w-5 h-5" />,
      settings: [
        { key: "require_file_approval_public", label: "File Approval for Public Rooms", type: "switch" },
        { key: "require_file_approval_private", label: "File Approval for Private Rooms", type: "switch" },
        { key: "max_file_size", label: "Max File Size (Bytes)", type: "number" },
        { key: "max_message_length", label: "Max Message Length", type: "number" },
        { key: "message_rate_limit", label: "Message Rate Limit (per minute)", type: "number" },
        { key: "file_rate_limit", label: "File Rate Limit (per minute)", type: "number" }
      ]
    },
    {
      id: "moderation",
      title: "Moderation Settings",
      icon: <AlertTriangle className="w-5 h-5" />,
      settings: [
        { key: "enable_auto_moderation", label: "Enable Auto-Moderation", type: "switch" },
        { key: "strict_content_filter", label: "Strict Content Filtering", type: "switch" },
        { key: "log_all_activity", label: "Log All User Activity", type: "switch" },
        { key: "enable_report_system", label: "Enable User Report System", type: "switch" },
        { key: "require_tos_acceptance", label: "Require TOS Acceptance", type: "switch" }
      ]
    },
    {
      id: "chat",
      title: "Chat Settings",
      icon: <Users className="w-5 h-5" />,
      settings: [
        { key: "enable_public_rooms", label: "Enable Public Rooms", type: "switch" },
        { key: "enable_private_rooms", label: "Enable Private Rooms", type: "switch" },
        { key: "private_room_approval", label: "Require Approval for Private Rooms", type: "switch" },
        { key: "auto_delete_private_rooms", label: "Auto-delete Inactive Private Rooms", type: "switch" },
        { key: "private_room_inactive_hours", label: "Private Room Inactivity Hours", type: "number" },
        { key: "enable_file_sharing", label: "Enable File Sharing", type: "switch" },
        { key: "enable_emoji_reactions", label: "Enable Emoji Reactions", type: "switch" },
        { key: "enable_message_editing", label: "Enable Message Editing", type: "switch" },
        { key: "message_edit_timeout", label: "Message Edit Timeout (Seconds)", type: "number" }
      ]
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Enhanced Settings</h2>
        <Button onClick={loadSettings} variant="outline">
          <RotateCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Lockdown Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Lockdown Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="lockdown_active">Enable Lockdown Mode</Label>
            <Switch
              id="lockdown_active"
              checked={lockdownSettings.lockdown_active === "true"}
              onCheckedChange={(checked) =>
                setLockdownSettings({
                  ...lockdownSettings,
                  lockdown_active: checked ? "true" : "false"
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="lockdown_message">Lockdown Message</Label>
            <Textarea
              id="lockdown_message"
              value={lockdownSettings.lockdown_message}
              onChange={(e) =>
                setLockdownSettings({
                  ...lockdownSettings,
                  lockdown_message: e.target.value
                })
              }
              placeholder="Message to show users during lockdown..."
            />
          </div>

          <div>
            <Label htmlFor="lockdown_image_url">Lockdown Image URL</Label>
            <Input
              id="lockdown_image_url"
              value={lockdownSettings.lockdown_image_url}
              onChange={(e) =>
                setLockdownSettings({
                  ...lockdownSettings,
                  lockdown_image_url: e.target.value
                })
              }
              placeholder="https://example.com/lockdown-image.jpg"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="lockdown_allow_admin">Allow Admins During Lockdown</Label>
            <Switch
              id="lockdown_allow_admin"
              checked={lockdownSettings.lockdown_allow_admin === "true"}
              onCheckedChange={(checked) =>
                setLockdownSettings({
                  ...lockdownSettings,
                  lockdown_allow_admin: checked ? "true" : "false"
                })
              }
            />
          </div>

          <Button onClick={saveLockdownSettings} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Lockdown Settings"}
          </Button>
        </CardContent>
      </Card>

      {/* Regular Settings Categories */}
      {settingsCategories.map((category) => (
        <Card key={category.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {category.icon}
                {category.title}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resetToDefaults(category.id)}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Defaults
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {category.settings.map((setting) => (
                <div key={setting.key} className="flex items-center justify-between">
                  <Label htmlFor={setting.key}>{setting.label}</Label>
                  {setting.type === "switch" ? (
                    <Switch
                      id={setting.key}
                      checked={settings[setting.key] === "true"}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          [setting.key]: checked ? "true" : "false"
                        })
                      }
                    />
                  ) : (
                    <Input
                      id={setting.key}
                      type="number"
                      value={settings[setting.key] || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          [setting.key]: e.target.value
                        })
                      }
                      className="w-32"
                    />
                  )}
                </div>
              ))}

              <Button
                onClick={() => {
                  const categorySettings: Record<string, string> = {};
                  category.settings.forEach(s => {
                    categorySettings[s.key] = settings[s.key] || "";
                  });
                  saveSettings(category.title, categorySettings);
                }}
                disabled={saving}
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : `Save ${category.title}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AdminEnhancedSettings;