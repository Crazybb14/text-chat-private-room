import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, Shield, Clock, MessageSquare, Image, Link, 
  Users, AlertTriangle, Bell, FileText, Lock, Zap,
  RefreshCw, Save, RotateCcw, CheckCircle2, Phone, Mail,
  MapPin, CreditCard, Globe, Eye, Video, Activity, TrendingUp,
  Database, Server, Wifi, Battery, HardDrive, Monitor, Speaker,
  Volume2, Mic, Camera, Smartphone, Tablet, Laptop, Code,
  Filter, Search, Hash, AtSign, DollarSign, Percent
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import db from '@/lib/shared/kliv-database.js';

interface Setting {
  _row_id: number;
  setting_key: string;
  setting_value: string;
  setting_type: string;
}

const AdminSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
    const interval = setInterval(loadSettings, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      const data = await db.query('admin_settings', {});
      const settingsMap: Record<string, string> = {};
      data.forEach((s: Setting) => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSetting = async (key: string, value: string) => {
    try {
      await db.update('admin_settings', { setting_key: `eq.${key}` }, { setting_value: value });
      toast({ title: 'Setting saved', description: `${key} updated` });
    } catch (error) {
      console.error('Error saving setting:', error);
      toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' });
    }
  };

  const saveAllSettings = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        await db.update('admin_settings', { setting_key: `eq.${key}` }, { setting_value: value });
      }
      setHasChanges(false);
      toast({ title: 'All settings saved!', description: 'Changes applied' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    // STRICT DEFAULTS - Maximum security
    const defaults: Record<string, string> = {
      // Rate Limiting - STRICT
      slow_mode_enabled: 'true',
      slow_mode_seconds: '3',
      max_message_length: '300',
      rate_limit_enabled: 'true',
      rate_limit_messages: '5',
      rate_limit_seconds: '30',
      new_user_cooldown: '60',
      
      // Content Controls
      links_allowed: 'false',
      images_allowed: 'true',
      files_allowed: 'true',
      profanity_filter: 'true',
      file_size_limit_mb: '5',
      
      // Safety Filters - ALL ON
      block_phone_numbers: 'true',
      block_emails: 'true',
      block_addresses: 'true',
      block_social_security: 'true',
      block_credit_cards: 'true',
      block_ip_addresses: 'true',
      block_personal_info: 'true',
      instant_ban_personal_info: 'true',
      
      // File Moderation
      require_file_approval_public: 'true',
      auto_approve_private_files: 'true',
      only_allow_media: 'true',
      
      // Auto-Ban - VERY STRICT
      auto_ban_enabled: 'true',
      auto_ban_threshold: '30',
      max_warnings_before_ban: '1',
      ban_duration_hours: '72',
      escalating_bans: 'true',
      auto_ban_spam_score: '20',
      auto_ban_profanity_count: '1',
      spam_detection: 'true',
      
      // Modes
      guest_mode: 'false',
      maintenance_mode: 'false',
      lockdown_mode: 'false',
      announcements_enabled: 'true',
      vip_bypass_limits: 'false',
      
      // Room Management (50+ new settings below)
      auto_delete_empty_rooms: 'true',
      auto_delete_timeout_minutes: '60',
      max_private_rooms_per_user: '3',
      room_inactivity_cleanup_hours: '1',
      allow_room_creation: 'true',
      require_admin_room_approval: 'false',
      max_users_per_room: '50',
      default_room_message_history: '100',
      
      // User Behavior
      require_email_verification: 'false',
      min_username_length: '3',
      max_username_length: '20',
      allow_username_changes: 'false',
      username_change_cooldown_days: '30',
      block_duplicate_usernames: 'true',
      force_unique_nicknames: 'true',
      allow_anonymous_mode: 'false',
      
      // Advanced Moderation
      shadow_ban_enabled: 'true',
      auto_timeout_warnings: 'true',
      warning_timeout_seconds: '300',
      mute_duration_minutes: '15',
      allow_user_reports: 'true',
      auto_review_flagged_content: 'true',
      min_reports_for_review: '3',
      trust_score_enabled: 'true',
      trust_score_threshold: '50',
      
      // Message Features
      allow_message_editing: 'false',
      message_edit_time_limit: '300',
      allow_message_deletion: 'true',
      show_deleted_placeholder: 'true',
      enable_message_reactions: 'true',
      enable_message_threads: 'false',
      enable_mentions: 'true',
      enable_hashtags: 'true',
      max_mentions_per_message: '5',
      
      // Media Restrictions
      allow_gifs: 'true',
      allow_emoji: 'true',
      allow_stickers: 'false',
      max_emoji_per_message: '10',
      auto_preview_links: 'false',
      scan_images_for_nsfw: 'true',
      block_screenshot_sharing: 'false',
      watermark_images: 'false',
      
      // Performance & Limits
      max_message_history_days: '30',
      database_cleanup_frequency: '24',
      cache_messages: 'true',
      message_cache_size: '500',
      enable_compression: 'true',
      optimize_images: 'true',
      max_concurrent_connections: '1000',
      connection_timeout_seconds: '300',
      
      // Security Enhancements
      enable_2fa_for_admin: 'false',
      require_strong_passwords: 'false',
      session_timeout_hours: '12',
      max_login_attempts: '5',
      lockout_duration_minutes: '30',
      enable_ip_tracking: 'true',
      block_vpn_users: 'false',
      block_tor_users: 'false',
      geo_restriction_enabled: 'false',
      allowed_countries: '',
      
      // Analytics & Logging
      enable_analytics: 'true',
      log_message_content: 'false',
      log_user_actions: 'true',
      log_admin_actions: 'true',
      analytics_retention_days: '90',
      track_user_activity: 'true',
      generate_daily_reports: 'true',
      export_logs_enabled: 'true',
      
      // Notifications
      desktop_notifications: 'true',
      mobile_push_notifications: 'true',
      email_notifications: 'false',
      notify_on_mention: 'true',
      notify_on_dm: 'true',
      notify_on_ban: 'true',
      notify_admin_on_report: 'true',
      notification_sound_enabled: 'true',
      
      // Advanced Content Filtering
      block_all_caps_messages: 'false',
      max_caps_percentage: '70',
      block_zalgo_text: 'true',
      block_unicode_abuse: 'true',
      detect_language: 'true',
      allowed_languages: 'en',
      translate_messages: 'false',
      censor_mode: 'replace',
      
      // Chat Features
      enable_private_messages: 'true',
      enable_voice_chat: 'false',
      enable_video_chat: 'false',
      enable_screen_sharing: 'false',
      enable_polls: 'true',
      enable_bot_commands: 'false',
      enable_custom_commands: 'false',
      command_prefix: '/',
      
      // Rate Limiting Advanced
      burst_limit_enabled: 'true',
      burst_limit_messages: '10',
      burst_window_seconds: '5',
      adaptive_rate_limiting: 'true',
      rate_limit_by_ip: 'true',
      whitelist_enabled: 'false',
      blacklist_enabled: 'true',
      
      // Experimental Features
      ai_moderation: 'false',
      sentiment_analysis: 'false',
      auto_translation: 'false',
      smart_suggestions: 'false',
      predictive_banning: 'false',
      behavior_scoring: 'true',
    };
    
    for (const [key, value] of Object.entries(defaults)) {
      await db.update('admin_settings', { setting_key: `eq.${key}` }, { setting_value: value });
    }
    setSettings(defaults);
    setHasChanges(false);
    toast({ title: '🛡️ Strict Mode Activated', description: 'All settings set to maximum security' });
  };

  const getBool = (key: string) => settings[key] === 'true';
  const getNum = (key: string) => parseInt(settings[key] || '0', 10);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/20">
            <Settings className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Admin Settings</h2>
            <p className="text-sm text-muted-foreground">Configure chat behavior and moderation</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button 
            onClick={saveAllSettings} 
            disabled={saving || !hasChanges}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All
          </Button>
        </div>
      </div>

      {hasChanges && (
        <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
          Unsaved changes
        </Badge>
      )}

      <ScrollArea className="h-[600px]">
        <div className="grid md:grid-cols-2 gap-4 pr-4">
          {/* Security Settings */}
          <Card className="glass-morphism border-red-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-400">
                <Shield className="w-5 h-5" />
                Security
              </CardTitle>
              <CardDescription>Protection and moderation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Lockdown Mode</Label>
                  <p className="text-xs text-muted-foreground">Block all new messages</p>
                </div>
                <Switch
                  checked={getBool('lockdown_mode')}
                  onCheckedChange={(v) => {
                    updateSetting('lockdown_mode', v.toString());
                    saveSetting('lockdown_mode', v.toString());
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Maintenance Mode</Label>
                  <p className="text-xs text-muted-foreground">Show maintenance screen</p>
                </div>
                <Switch
                  checked={getBool('maintenance_mode')}
                  onCheckedChange={(v) => {
                    updateSetting('maintenance_mode', v.toString());
                    saveSetting('maintenance_mode', v.toString());
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Ban System</Label>
                  <p className="text-xs text-muted-foreground">Auto-ban high threat users</p>
                </div>
                <Switch
                  checked={getBool('auto_ban_enabled')}
                  onCheckedChange={(v) => {
                    updateSetting('auto_ban_enabled', v.toString());
                    saveSetting('auto_ban_enabled', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Ban Threshold: {getNum('auto_ban_threshold')}</Label>
                <Slider
                  value={[getNum('auto_ban_threshold')]}
                  onValueChange={([v]) => updateSetting('auto_ban_threshold', v.toString())}
                  onValueCommit={([v]) => saveSetting('auto_ban_threshold', v.toString())}
                  min={10}
                  max={200}
                  step={10}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Spam Detection</Label>
                  <p className="text-xs text-muted-foreground">Detect and block spam</p>
                </div>
                <Switch
                  checked={getBool('spam_detection')}
                  onCheckedChange={(v) => {
                    updateSetting('spam_detection', v.toString());
                    saveSetting('spam_detection', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Profanity Filter</Label>
                  <p className="text-xs text-muted-foreground">Block bad words</p>
                </div>
                <Switch
                  checked={getBool('profanity_filter')}
                  onCheckedChange={(v) => {
                    updateSetting('profanity_filter', v.toString());
                    saveSetting('profanity_filter', v.toString());
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Rate Limiting */}
          <Card className="glass-morphism border-yellow-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-yellow-400">
                <Clock className="w-5 h-5" />
                Rate Limiting
              </CardTitle>
              <CardDescription>Control message frequency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Slow Mode</Label>
                  <p className="text-xs text-muted-foreground">Delay between messages</p>
                </div>
                <Switch
                  checked={getBool('slow_mode_enabled')}
                  onCheckedChange={(v) => {
                    updateSetting('slow_mode_enabled', v.toString());
                    saveSetting('slow_mode_enabled', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Slow Mode Delay: {getNum('slow_mode_seconds')}s</Label>
                <Slider
                  value={[getNum('slow_mode_seconds')]}
                  onValueChange={([v]) => updateSetting('slow_mode_seconds', v.toString())}
                  onValueCommit={([v]) => saveSetting('slow_mode_seconds', v.toString())}
                  min={1}
                  max={60}
                  step={1}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Rate Limit</Label>
                  <p className="text-xs text-muted-foreground">Limit messages per minute</p>
                </div>
                <Switch
                  checked={getBool('rate_limit_enabled')}
                  onCheckedChange={(v) => {
                    updateSetting('rate_limit_enabled', v.toString());
                    saveSetting('rate_limit_enabled', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Messages: {getNum('rate_limit_messages')}</Label>
                <Slider
                  value={[getNum('rate_limit_messages')]}
                  onValueChange={([v]) => updateSetting('rate_limit_messages', v.toString())}
                  onValueCommit={([v]) => saveSetting('rate_limit_messages', v.toString())}
                  min={1}
                  max={50}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Per {getNum('rate_limit_seconds')} seconds</Label>
                <Slider
                  value={[getNum('rate_limit_seconds')]}
                  onValueChange={([v]) => updateSetting('rate_limit_seconds', v.toString())}
                  onValueCommit={([v]) => saveSetting('rate_limit_seconds', v.toString())}
                  min={10}
                  max={300}
                  step={10}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>New User Cooldown: {getNum('new_user_cooldown')}s</Label>
                <p className="text-xs text-muted-foreground">Wait time before new users can chat</p>
                <Slider
                  value={[getNum('new_user_cooldown')]}
                  onValueChange={([v]) => updateSetting('new_user_cooldown', v.toString())}
                  onValueCommit={([v]) => saveSetting('new_user_cooldown', v.toString())}
                  min={0}
                  max={300}
                  step={10}
                />
              </div>
            </CardContent>
          </Card>

          {/* Message Settings */}
          <Card className="glass-morphism border-blue-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <MessageSquare className="w-5 h-5" />
                Messages
              </CardTitle>
              <CardDescription>Message content rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Max Message Length: {getNum('max_message_length')}</Label>
                <Slider
                  value={[getNum('max_message_length')]}
                  onValueChange={([v]) => updateSetting('max_message_length', v.toString())}
                  onValueCommit={([v]) => saveSetting('max_message_length', v.toString())}
                  min={50}
                  max={2000}
                  step={50}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link className="w-4 h-4 text-cyan-400" />
                  <Label>Allow Links</Label>
                </div>
                <Switch
                  checked={getBool('links_allowed')}
                  onCheckedChange={(v) => {
                    updateSetting('links_allowed', v.toString());
                    saveSetting('links_allowed', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-green-400" />
                  <Label>Allow Images</Label>
                </div>
                <Switch
                  checked={getBool('images_allowed')}
                  onCheckedChange={(v) => {
                    updateSetting('images_allowed', v.toString());
                    saveSetting('images_allowed', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-orange-400" />
                  <Label>Allow Files</Label>
                </div>
                <Switch
                  checked={getBool('files_allowed')}
                  onCheckedChange={(v) => {
                    updateSetting('files_allowed', v.toString());
                    saveSetting('files_allowed', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>File Size Limit: {getNum('file_size_limit_mb')} MB</Label>
                <Slider
                  value={[getNum('file_size_limit_mb')]}
                  onValueChange={([v]) => updateSetting('file_size_limit_mb', v.toString())}
                  onValueCommit={([v]) => saveSetting('file_size_limit_mb', v.toString())}
                  min={1}
                  max={50}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* Content Safety Filters */}
          <Card className="glass-morphism border-orange-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-400">
                <AlertTriangle className="w-5 h-5" />
                Safety Filters
              </CardTitle>
              <CardDescription>Block personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-red-400" />
                  <Label>Block Phone Numbers</Label>
                </div>
                <Switch
                  checked={getBool('block_phone_numbers')}
                  onCheckedChange={(v) => {
                    updateSetting('block_phone_numbers', v.toString());
                    saveSetting('block_phone_numbers', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <Label>Block Email Addresses</Label>
                </div>
                <Switch
                  checked={getBool('block_emails')}
                  onCheckedChange={(v) => {
                    updateSetting('block_emails', v.toString());
                    saveSetting('block_emails', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-green-400" />
                  <Label>Block Addresses/ZIP</Label>
                </div>
                <Switch
                  checked={getBool('block_addresses')}
                  onCheckedChange={(v) => {
                    updateSetting('block_addresses', v.toString());
                    saveSetting('block_addresses', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-yellow-400" />
                  <Label>Block Credit Cards</Label>
                </div>
                <Switch
                  checked={getBool('block_credit_cards')}
                  onCheckedChange={(v) => {
                    updateSetting('block_credit_cards', v.toString());
                    saveSetting('block_credit_cards', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400" />
                  <Label>Block SSN</Label>
                </div>
                <Switch
                  checked={getBool('block_social_security')}
                  onCheckedChange={(v) => {
                    updateSetting('block_social_security', v.toString());
                    saveSetting('block_social_security', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <Label>Block IP Addresses</Label>
                </div>
                <Switch
                  checked={getBool('block_ip_addresses')}
                  onCheckedChange={(v) => {
                    updateSetting('block_ip_addresses', v.toString());
                    saveSetting('block_ip_addresses', v.toString());
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-red-400">Instant Ban for PII</Label>
                  <p className="text-xs text-muted-foreground">Auto-ban for sharing personal info</p>
                </div>
                <Switch
                  checked={getBool('instant_ban_personal_info')}
                  onCheckedChange={(v) => {
                    updateSetting('instant_ban_personal_info', v.toString());
                    saveSetting('instant_ban_personal_info', v.toString());
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* File Moderation */}
          <Card className="glass-morphism border-cyan-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-cyan-400">
                <Eye className="w-5 h-5" />
                File Moderation
              </CardTitle>
              <CardDescription>Control file uploads</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Only Photos & Videos</Label>
                  <p className="text-xs text-muted-foreground">Block all other file types</p>
                </div>
                <Switch
                  checked={getBool('only_allow_media')}
                  onCheckedChange={(v) => {
                    updateSetting('only_allow_media', v.toString());
                    saveSetting('only_allow_media', v.toString());
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-yellow-400">Require Approval (Public)</Label>
                  <p className="text-xs text-muted-foreground">Admin must approve public room files</p>
                </div>
                <Switch
                  checked={getBool('require_file_approval_public')}
                  onCheckedChange={(v) => {
                    updateSetting('require_file_approval_public', v.toString());
                    saveSetting('require_file_approval_public', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-green-400">Auto-Approve Private</Label>
                  <p className="text-xs text-muted-foreground">Skip approval for private rooms</p>
                </div>
                <Switch
                  checked={getBool('auto_approve_private_files')}
                  onCheckedChange={(v) => {
                    updateSetting('auto_approve_private_files', v.toString());
                    saveSetting('auto_approve_private_files', v.toString());
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Strict Auto-Ban Settings */}
          <Card className="glass-morphism border-red-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-400">
                <Shield className="w-5 h-5" />
                Strict Auto-Ban
              </CardTitle>
              <CardDescription>Advanced ban automation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Max Warnings Before Ban: {getNum('max_warnings_before_ban')}</Label>
                <Slider
                  value={[getNum('max_warnings_before_ban')]}
                  onValueChange={([v]) => updateSetting('max_warnings_before_ban', v.toString())}
                  onValueCommit={([v]) => saveSetting('max_warnings_before_ban', v.toString())}
                  min={1}
                  max={10}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Ban Duration: {getNum('ban_duration_hours')} hours</Label>
                <Slider
                  value={[getNum('ban_duration_hours')]}
                  onValueChange={([v]) => updateSetting('ban_duration_hours', v.toString())}
                  onValueCommit={([v]) => saveSetting('ban_duration_hours', v.toString())}
                  min={1}
                  max={168}
                  step={1}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Escalating Bans</Label>
                  <p className="text-xs text-muted-foreground">Each ban gets longer</p>
                </div>
                <Switch
                  checked={getBool('escalating_bans')}
                  onCheckedChange={(v) => {
                    updateSetting('escalating_bans', v.toString());
                    saveSetting('escalating_bans', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Spam Score Threshold: {getNum('auto_ban_spam_score')}</Label>
                <p className="text-xs text-muted-foreground">Auto-ban at this spam score</p>
                <Slider
                  value={[getNum('auto_ban_spam_score')]}
                  onValueChange={([v]) => updateSetting('auto_ban_spam_score', v.toString())}
                  onValueCommit={([v]) => saveSetting('auto_ban_spam_score', v.toString())}
                  min={20}
                  max={100}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Profanity Count for Ban: {getNum('auto_ban_profanity_count')}</Label>
                <Slider
                  value={[getNum('auto_ban_profanity_count')]}
                  onValueChange={([v]) => updateSetting('auto_ban_profanity_count', v.toString())}
                  onValueCommit={([v]) => saveSetting('auto_ban_profanity_count', v.toString())}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* User Settings */}
          <Card className="glass-morphism border-green-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-green-400">
                <Users className="w-5 h-5" />
                Users
              </CardTitle>
              <CardDescription>User access and privileges</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Guest Mode</Label>
                  <p className="text-xs text-muted-foreground">Allow guests without names</p>
                </div>
                <Switch
                  checked={getBool('guest_mode')}
                  onCheckedChange={(v) => {
                    updateSetting('guest_mode', v.toString());
                    saveSetting('guest_mode', v.toString());
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>VIP Bypass Limits</Label>
                  <p className="text-xs text-muted-foreground">VIP users skip restrictions</p>
                </div>
                <Switch
                  checked={getBool('vip_bypass_limits')}
                  onCheckedChange={(v) => {
                    updateSetting('vip_bypass_limits', v.toString());
                    saveSetting('vip_bypass_limits', v.toString());
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Announcements</Label>
                  <p className="text-xs text-muted-foreground">Enable system announcements</p>
                </div>
                <Switch
                  checked={getBool('announcements_enabled')}
                  onCheckedChange={(v) => {
                    updateSetting('announcements_enabled', v.toString());
                    saveSetting('announcements_enabled', v.toString());
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Room Management */}
          <Card className="glass-morphism border-indigo-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-indigo-400">
                <Database className="w-5 h-5" />
                Room Management
              </CardTitle>
              <CardDescription>Room creation and cleanup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Delete Empty Rooms</Label>
                  <p className="text-xs text-muted-foreground">Remove rooms with no activity</p>
                </div>
                <Switch
                  checked={getBool('auto_delete_empty_rooms')}
                  onCheckedChange={(v) => {
                    updateSetting('auto_delete_empty_rooms', v.toString());
                    saveSetting('auto_delete_empty_rooms', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Inactivity Cleanup: {getNum('room_inactivity_cleanup_hours')}h</Label>
                <Slider
                  value={[getNum('room_inactivity_cleanup_hours')]}
                  onValueChange={([v]) => updateSetting('room_inactivity_cleanup_hours', v.toString())}
                  onValueCommit={([v]) => saveSetting('room_inactivity_cleanup_hours', v.toString())}
                  min={1}
                  max={48}
                  step={1}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Max Private Rooms Per User: {getNum('max_private_rooms_per_user')}</Label>
                <Slider
                  value={[getNum('max_private_rooms_per_user')]}
                  onValueChange={([v]) => updateSetting('max_private_rooms_per_user', v.toString())}
                  onValueCommit={([v]) => saveSetting('max_private_rooms_per_user', v.toString())}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Users Per Room: {getNum('max_users_per_room')}</Label>
                <Slider
                  value={[getNum('max_users_per_room')]}
                  onValueChange={([v]) => updateSetting('max_users_per_room', v.toString())}
                  onValueCommit={([v]) => saveSetting('max_users_per_room', v.toString())}
                  min={2}
                  max={500}
                  step={5}
                />
              </div>
            </CardContent>
          </Card>

          {/* User Behavior */}
          <Card className="glass-morphism border-pink-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-pink-400">
                <AtSign className="w-5 h-5" />
                User Behavior
              </CardTitle>
              <CardDescription>Username and user controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Min Username Length: {getNum('min_username_length')}</Label>
                <Slider
                  value={[getNum('min_username_length')]}
                  onValueChange={([v]) => updateSetting('min_username_length', v.toString())}
                  onValueCommit={([v]) => saveSetting('min_username_length', v.toString())}
                  min={2}
                  max={10}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Username Length: {getNum('max_username_length')}</Label>
                <Slider
                  value={[getNum('max_username_length')]}
                  onValueChange={([v]) => updateSetting('max_username_length', v.toString())}
                  onValueCommit={([v]) => saveSetting('max_username_length', v.toString())}
                  min={10}
                  max={50}
                  step={1}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label>Block Duplicate Usernames</Label>
                <Switch
                  checked={getBool('block_duplicate_usernames')}
                  onCheckedChange={(v) => {
                    updateSetting('block_duplicate_usernames', v.toString());
                    saveSetting('block_duplicate_usernames', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Allow Username Changes</Label>
                <Switch
                  checked={getBool('allow_username_changes')}
                  onCheckedChange={(v) => {
                    updateSetting('allow_username_changes', v.toString());
                    saveSetting('allow_username_changes', v.toString());
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Advanced Moderation */}
          <Card className="glass-morphism border-rose-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-rose-400">
                <Filter className="w-5 h-5" />
                Advanced Moderation
              </CardTitle>
              <CardDescription>Sophisticated moderation tools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Shadow Ban</Label>
                  <p className="text-xs text-muted-foreground">Hide messages without user knowing</p>
                </div>
                <Switch
                  checked={getBool('shadow_ban_enabled')}
                  onCheckedChange={(v) => {
                    updateSetting('shadow_ban_enabled', v.toString());
                    saveSetting('shadow_ban_enabled', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Trust Score System</Label>
                  <p className="text-xs text-muted-foreground">Track user reliability</p>
                </div>
                <Switch
                  checked={getBool('trust_score_enabled')}
                  onCheckedChange={(v) => {
                    updateSetting('trust_score_enabled', v.toString());
                    saveSetting('trust_score_enabled', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Trust Score Threshold: {getNum('trust_score_threshold')}</Label>
                <Slider
                  value={[getNum('trust_score_threshold')]}
                  onValueChange={([v]) => updateSetting('trust_score_threshold', v.toString())}
                  onValueCommit={([v]) => saveSetting('trust_score_threshold', v.toString())}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label>Allow User Reports</Label>
                <Switch
                  checked={getBool('allow_user_reports')}
                  onCheckedChange={(v) => {
                    updateSetting('allow_user_reports', v.toString());
                    saveSetting('allow_user_reports', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Reports for Review: {getNum('min_reports_for_review')}</Label>
                <Slider
                  value={[getNum('min_reports_for_review')]}
                  onValueChange={([v]) => updateSetting('min_reports_for_review', v.toString())}
                  onValueCommit={([v]) => saveSetting('min_reports_for_review', v.toString())}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* Message Features */}
          <Card className="glass-morphism border-teal-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-teal-400">
                <Hash className="w-5 h-5" />
                Message Features
              </CardTitle>
              <CardDescription>Chat functionality options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Allow Message Editing</Label>
                <Switch
                  checked={getBool('allow_message_editing')}
                  onCheckedChange={(v) => {
                    updateSetting('allow_message_editing', v.toString());
                    saveSetting('allow_message_editing', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enable Reactions</Label>
                <Switch
                  checked={getBool('enable_message_reactions')}
                  onCheckedChange={(v) => {
                    updateSetting('enable_message_reactions', v.toString());
                    saveSetting('enable_message_reactions', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enable Mentions</Label>
                <Switch
                  checked={getBool('enable_mentions')}
                  onCheckedChange={(v) => {
                    updateSetting('enable_mentions', v.toString());
                    saveSetting('enable_mentions', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enable Hashtags</Label>
                <Switch
                  checked={getBool('enable_hashtags')}
                  onCheckedChange={(v) => {
                    updateSetting('enable_hashtags', v.toString());
                    saveSetting('enable_hashtags', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Mentions Per Message: {getNum('max_mentions_per_message')}</Label>
                <Slider
                  value={[getNum('max_mentions_per_message')]}
                  onValueChange={([v]) => updateSetting('max_mentions_per_message', v.toString())}
                  onValueCommit={([v]) => saveSetting('max_mentions_per_message', v.toString())}
                  min={1}
                  max={20}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* Media Restrictions */}
          <Card className="glass-morphism border-amber-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-400">
                <Camera className="w-5 h-5" />
                Media Restrictions
              </CardTitle>
              <CardDescription>Image and media controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Allow GIFs</Label>
                <Switch
                  checked={getBool('allow_gifs')}
                  onCheckedChange={(v) => {
                    updateSetting('allow_gifs', v.toString());
                    saveSetting('allow_gifs', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Allow Emoji</Label>
                <Switch
                  checked={getBool('allow_emoji')}
                  onCheckedChange={(v) => {
                    updateSetting('allow_emoji', v.toString());
                    saveSetting('allow_emoji', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Emoji Per Message: {getNum('max_emoji_per_message')}</Label>
                <Slider
                  value={[getNum('max_emoji_per_message')]}
                  onValueChange={([v]) => updateSetting('max_emoji_per_message', v.toString())}
                  onValueCommit={([v]) => saveSetting('max_emoji_per_message', v.toString())}
                  min={1}
                  max={50}
                  step={1}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Scan Images for NSFW</Label>
                  <p className="text-xs text-muted-foreground">Auto-detect inappropriate images</p>
                </div>
                <Switch
                  checked={getBool('scan_images_for_nsfw')}
                  onCheckedChange={(v) => {
                    updateSetting('scan_images_for_nsfw', v.toString());
                    saveSetting('scan_images_for_nsfw', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Optimize Images</Label>
                <Switch
                  checked={getBool('optimize_images')}
                  onCheckedChange={(v) => {
                    updateSetting('optimize_images', v.toString());
                    saveSetting('optimize_images', v.toString());
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Performance */}
          <Card className="glass-morphism border-emerald-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-400">
                <Server className="w-5 h-5" />
                Performance
              </CardTitle>
              <CardDescription>System optimization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Cache Messages</Label>
                <Switch
                  checked={getBool('cache_messages')}
                  onCheckedChange={(v) => {
                    updateSetting('cache_messages', v.toString());
                    saveSetting('cache_messages', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Message Cache Size: {getNum('message_cache_size')}</Label>
                <Slider
                  value={[getNum('message_cache_size')]}
                  onValueChange={([v]) => updateSetting('message_cache_size', v.toString())}
                  onValueCommit={([v]) => saveSetting('message_cache_size', v.toString())}
                  min={100}
                  max={5000}
                  step={100}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label>Enable Compression</Label>
                <Switch
                  checked={getBool('enable_compression')}
                  onCheckedChange={(v) => {
                    updateSetting('enable_compression', v.toString());
                    saveSetting('enable_compression', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Concurrent Connections: {getNum('max_concurrent_connections')}</Label>
                <Slider
                  value={[getNum('max_concurrent_connections')]}
                  onValueChange={([v]) => updateSetting('max_concurrent_connections', v.toString())}
                  onValueCommit={([v]) => saveSetting('max_concurrent_connections', v.toString())}
                  min={100}
                  max={10000}
                  step={100}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Enhancements */}
          <Card className="glass-morphism border-violet-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-violet-400">
                <Lock className="w-5 h-5" />
                Security Enhancements
              </CardTitle>
              <CardDescription>Advanced security features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable IP Tracking</Label>
                <Switch
                  checked={getBool('enable_ip_tracking')}
                  onCheckedChange={(v) => {
                    updateSetting('enable_ip_tracking', v.toString());
                    saveSetting('enable_ip_tracking', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Block VPN Users</Label>
                <Switch
                  checked={getBool('block_vpn_users')}
                  onCheckedChange={(v) => {
                    updateSetting('block_vpn_users', v.toString());
                    saveSetting('block_vpn_users', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Block Tor Users</Label>
                <Switch
                  checked={getBool('block_tor_users')}
                  onCheckedChange={(v) => {
                    updateSetting('block_tor_users', v.toString());
                    saveSetting('block_tor_users', v.toString());
                  }}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Session Timeout: {getNum('session_timeout_hours')}h</Label>
                <Slider
                  value={[getNum('session_timeout_hours')]}
                  onValueChange={([v]) => updateSetting('session_timeout_hours', v.toString())}
                  onValueCommit={([v]) => saveSetting('session_timeout_hours', v.toString())}
                  min={1}
                  max={72}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Login Attempts: {getNum('max_login_attempts')}</Label>
                <Slider
                  value={[getNum('max_login_attempts')]}
                  onValueChange={([v]) => updateSetting('max_login_attempts', v.toString())}
                  onValueCommit={([v]) => saveSetting('max_login_attempts', v.toString())}
                  min={3}
                  max={20}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* Analytics */}
          <Card className="glass-morphism border-sky-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sky-400">
                <TrendingUp className="w-5 h-5" />
                Analytics & Logging
              </CardTitle>
              <CardDescription>Data collection and reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Analytics</Label>
                <Switch
                  checked={getBool('enable_analytics')}
                  onCheckedChange={(v) => {
                    updateSetting('enable_analytics', v.toString());
                    saveSetting('enable_analytics', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Log User Actions</Label>
                <Switch
                  checked={getBool('log_user_actions')}
                  onCheckedChange={(v) => {
                    updateSetting('log_user_actions', v.toString());
                    saveSetting('log_user_actions', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Log Admin Actions</Label>
                <Switch
                  checked={getBool('log_admin_actions')}
                  onCheckedChange={(v) => {
                    updateSetting('log_admin_actions', v.toString());
                    saveSetting('log_admin_actions', v.toString());
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label>Generate Daily Reports</Label>
                <Switch
                  checked={getBool('generate_daily_reports')}
                  onCheckedChange={(v) => {
                    updateSetting('generate_daily_reports', v.toString());
                    saveSetting('generate_daily_reports', v.toString());
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Analytics Retention: {getNum('analytics_retention_days')} days</Label>
                <Slider
                  value={[getNum('analytics_retention_days')]}
                  onValueChange={([v]) => updateSetting('analytics_retention_days', v.toString())}
                  onValueCommit={([v]) => saveSetting('analytics_retention_days', v.toString())}
                  min={7}
                  max={365}
                  step={7}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="glass-morphism border-fuchsia-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-fuchsia-400">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
              <CardDescription>Notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Desktop Notifications</Label>
                <Switch
                  checked={getBool('desktop_notifications')}
                  onCheckedChange={(v) => {
                    updateSetting('desktop_notifications', v.toString());
                    saveSetting('desktop_notifications', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Mobile Push</Label>
                <Switch
                  checked={getBool('mobile_push_notifications')}
                  onCheckedChange={(v) => {
                    updateSetting('mobile_push_notifications', v.toString());
                    saveSetting('mobile_push_notifications', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Notification Sounds</Label>
                <Switch
                  checked={getBool('notification_sound_enabled')}
                  onCheckedChange={(v) => {
                    updateSetting('notification_sound_enabled', v.toString());
                    saveSetting('notification_sound_enabled', v.toString());
                  }}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label>Notify on Mention</Label>
                <Switch
                  checked={getBool('notify_on_mention')}
                  onCheckedChange={(v) => {
                    updateSetting('notify_on_mention', v.toString());
                    saveSetting('notify_on_mention', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Notify Admin on Report</Label>
                <Switch
                  checked={getBool('notify_admin_on_report')}
                  onCheckedChange={(v) => {
                    updateSetting('notify_admin_on_report', v.toString());
                    saveSetting('notify_admin_on_report', v.toString());
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Advanced Content Filtering */}
          <Card className="glass-morphism border-lime-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lime-400">
                <Search className="w-5 h-5" />
                Content Filtering
              </CardTitle>
              <CardDescription>Advanced content detection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Block All-Caps Messages</Label>
                <Switch
                  checked={getBool('block_all_caps_messages')}
                  onCheckedChange={(v) => {
                    updateSetting('block_all_caps_messages', v.toString());
                    saveSetting('block_all_caps_messages', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Block Zalgo Text</Label>
                <Switch
                  checked={getBool('block_zalgo_text')}
                  onCheckedChange={(v) => {
                    updateSetting('block_zalgo_text', v.toString());
                    saveSetting('block_zalgo_text', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Block Unicode Abuse</Label>
                <Switch
                  checked={getBool('block_unicode_abuse')}
                  onCheckedChange={(v) => {
                    updateSetting('block_unicode_abuse', v.toString());
                    saveSetting('block_unicode_abuse', v.toString());
                  }}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Max Caps Percentage: {getNum('max_caps_percentage')}%</Label>
                <Slider
                  value={[getNum('max_caps_percentage')]}
                  onValueChange={([v]) => updateSetting('max_caps_percentage', v.toString())}
                  onValueCommit={([v]) => saveSetting('max_caps_percentage', v.toString())}
                  min={10}
                  max={100}
                  step={5}
                />
              </div>
            </CardContent>
          </Card>

          {/* Chat Features */}
          <Card className="glass-morphism border-slate-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-slate-400">
                <Mic className="w-5 h-5" />
                Chat Features
              </CardTitle>
              <CardDescription>Extended functionality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Private Messages</Label>
                <Switch
                  checked={getBool('enable_private_messages')}
                  onCheckedChange={(v) => {
                    updateSetting('enable_private_messages', v.toString());
                    saveSetting('enable_private_messages', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enable Voice Chat</Label>
                <Switch
                  checked={getBool('enable_voice_chat')}
                  onCheckedChange={(v) => {
                    updateSetting('enable_voice_chat', v.toString());
                    saveSetting('enable_voice_chat', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enable Video Chat</Label>
                <Switch
                  checked={getBool('enable_video_chat')}
                  onCheckedChange={(v) => {
                    updateSetting('enable_video_chat', v.toString());
                    saveSetting('enable_video_chat', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enable Polls</Label>
                <Switch
                  checked={getBool('enable_polls')}
                  onCheckedChange={(v) => {
                    updateSetting('enable_polls', v.toString());
                    saveSetting('enable_polls', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enable Bot Commands</Label>
                <Switch
                  checked={getBool('enable_bot_commands')}
                  onCheckedChange={(v) => {
                    updateSetting('enable_bot_commands', v.toString());
                    saveSetting('enable_bot_commands', v.toString());
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Experimental Features */}
          <Card className="glass-morphism border-yellow-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-yellow-400">
                <Activity className="w-5 h-5" />
                Experimental
              </CardTitle>
              <CardDescription>Beta features</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>AI Moderation</Label>
                  <p className="text-xs text-muted-foreground">Use AI for content filtering</p>
                </div>
                <Switch
                  checked={getBool('ai_moderation')}
                  onCheckedChange={(v) => {
                    updateSetting('ai_moderation', v.toString());
                    saveSetting('ai_moderation', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Sentiment Analysis</Label>
                <Switch
                  checked={getBool('sentiment_analysis')}
                  onCheckedChange={(v) => {
                    updateSetting('sentiment_analysis', v.toString());
                    saveSetting('sentiment_analysis', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Behavior Scoring</Label>
                <Switch
                  checked={getBool('behavior_scoring')}
                  onCheckedChange={(v) => {
                    updateSetting('behavior_scoring', v.toString());
                    saveSetting('behavior_scoring', v.toString());
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-yellow-400">Predictive Banning</Label>
                  <p className="text-xs text-muted-foreground">Ban users likely to violate</p>
                </div>
                <Switch
                  checked={getBool('predictive_banning')}
                  onCheckedChange={(v) => {
                    updateSetting('predictive_banning', v.toString());
                    saveSetting('predictive_banning', v.toString());
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Quick Status */}
          <Card className="glass-morphism border-purple-500/20 md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <Zap className="w-5 h-5" />
                Current Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge className={getBool('lockdown_mode') ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}>
                  {getBool('lockdown_mode') ? '🔒 Lockdown ON' : '✓ Normal Mode'}
                </Badge>
                <Badge className={getBool('maintenance_mode') ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}>
                  {getBool('maintenance_mode') ? '🔧 Maintenance' : '✓ Online'}
                </Badge>
                <Badge className={getBool('slow_mode_enabled') ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-500/20 text-gray-300'}>
                  {getBool('slow_mode_enabled') ? `⏱ Slow Mode ${getNum('slow_mode_seconds')}s` : 'Slow Mode OFF'}
                </Badge>
                <Badge className={getBool('auto_ban_enabled') ? 'bg-red-500/20 text-red-300' : 'bg-gray-500/20 text-gray-300'}>
                  {getBool('auto_ban_enabled') ? `🛡 Auto-Ban @${getNum('auto_ban_threshold')}` : 'Auto-Ban OFF'}
                </Badge>
                <Badge className={getBool('rate_limit_enabled') ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-500/20 text-gray-300'}>
                  {getBool('rate_limit_enabled') ? `📊 Rate Limit ${getNum('rate_limit_messages')}/${getNum('rate_limit_seconds')}s` : 'No Rate Limit'}
                </Badge>
                <Badge className={getBool('profanity_filter') ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-500/20 text-gray-300'}>
                  {getBool('profanity_filter') ? '🚫 Profanity Filter ON' : 'Profanity Filter OFF'}
                </Badge>
                <Badge className={getBool('links_allowed') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-red-500/20 text-red-300'}>
                  {getBool('links_allowed') ? '🔗 Links Allowed' : '🔗 Links Blocked'}
                </Badge>
                <Badge className={getBool('files_allowed') ? 'bg-orange-500/20 text-orange-300' : 'bg-red-500/20 text-red-300'}>
                  {getBool('files_allowed') ? `📁 Files ≤${getNum('file_size_limit_mb')}MB` : '📁 Files Blocked'}
                </Badge>
                <Badge className="bg-indigo-500/20 text-indigo-300">
                  🏠 Auto-Delete Rooms: {getNum('room_inactivity_cleanup_hours')}h
                </Badge>
                <Badge className="bg-pink-500/20 text-pink-300">
                  👤 Username Length: {getNum('min_username_length')}-{getNum('max_username_length')}
                </Badge>
                <Badge className={getBool('trust_score_enabled') ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}>
                  {getBool('trust_score_enabled') ? '⭐ Trust Score ON' : 'Trust Score OFF'}
                </Badge>
                <Badge className={getBool('ai_moderation') ? 'bg-yellow-500/20 text-yellow-300 animate-pulse' : 'bg-gray-500/20 text-gray-300'}>
                  {getBool('ai_moderation') ? '🤖 AI Moderation BETA' : 'AI Moderation OFF'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};

export default AdminSettings;
