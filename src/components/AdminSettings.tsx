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
  MapPin, CreditCard, Globe, Eye, Video
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
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};

export default AdminSettings;
