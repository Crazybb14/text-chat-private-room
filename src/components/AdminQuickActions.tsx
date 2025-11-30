import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Zap, Trash2, Ban, Clock, Users, MessageSquare, Shield, 
  Eye, Volume2, VolumeX, Lock, Unlock, Download,
  RefreshCw, Search, AlertTriangle, CheckCircle2,
  XCircle, Globe, Bell, Settings, Database,
  Activity, TrendingUp, BarChart3, PieChart, Archive,
  Copy, Clipboard, FileText, UserX, UserPlus, Timer,
  Flame, Snowflake, Scale, Bomb, Filter, Eraser, Star,
  Heart, Home, RotateCcw, Key
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import db from '@/lib/shared/kliv-database.js';

interface QuickStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalBans: number;
  activeBans: number;
  pendingAppeals: number;
  totalRooms: number;
  publicRooms: number;
  privateRooms: number;
  suggestionsCount: number;
  filesShared: number;
  threatAlerts: number;
}

interface Setting {
  setting_key: string;
  setting_value: string;
}

const AdminQuickActions = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<QuickStats>({
    totalUsers: 0, activeUsers: 0, totalMessages: 0, totalBans: 0,
    activeBans: 0, pendingAppeals: 0, totalRooms: 0, publicRooms: 0,
    privateRooms: 0, suggestionsCount: 0, filesShared: 0, threatAlerts: 0
  });
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadStats();
    loadSettings();
    const interval = setInterval(() => {
      loadStats();
      loadSettings();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      const data = await db.query('admin_settings', {});
      const map: Record<string, string> = {};
      data.forEach((s: Setting) => { map[s.setting_key] = s.setting_value; });
      setSettings(map);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const updateSetting = async (key: string, value: string) => {
    await db.update('admin_settings', { setting_key: `eq.${key}` }, { setting_value: value });
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const loadStats = async () => {
    try {
      const [users, messages, bans, appeals, rooms, suggestions, files, threats] = await Promise.all([
        db.query('users', {}),
        db.query('messages', {}),
        db.query('bans', {}),
        db.query('appeals', { status: 'eq.pending' }),
        db.query('rooms', {}),
        db.query('suggestions', {}),
        db.query('uploaded_files', {}),
        db.query('threat_levels', { threat_score: 'gte.50' })
      ]);

      const now = Date.now();
      const activeUsers = users.filter((u: { last_active: number }) => now - u.last_active < 300000);
      const activeBans = bans.filter((b: { expires_at: number | null }) => !b.expires_at || b.expires_at > now);
      const publicRooms = rooms.filter((r: { type: string }) => r.type === 'public');

      setStats({
        totalUsers: users.length,
        activeUsers: activeUsers.length,
        totalMessages: messages.length,
        totalBans: bans.length,
        activeBans: activeBans.length,
        pendingAppeals: appeals.length,
        totalRooms: rooms.length,
        publicRooms: publicRooms.length,
        privateRooms: rooms.length - publicRooms.length,
        suggestionsCount: suggestions.length,
        filesShared: files.length,
        threatAlerts: threats.length
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const getBool = (key: string) => settings[key] === 'true';

  // All 100 Quick Actions with REAL functionality
  const quickActions = [
    // SETTINGS TOGGLES (1-20)
    { id: 1, name: getBool('lockdown_mode') ? '🔓 Disable Lockdown' : '🔒 Enable Lockdown', icon: Lock, color: 'red', action: async () => {
      const newVal = (!getBool('lockdown_mode')).toString();
      await updateSetting('lockdown_mode', newVal);
      toast({ title: newVal === 'true' ? '🔒 LOCKDOWN ON' : '🔓 Lockdown Off', description: newVal === 'true' ? 'All messages blocked' : 'Normal mode restored' });
    }},
    { id: 2, name: getBool('maintenance_mode') ? '✓ End Maintenance' : '🔧 Maintenance Mode', icon: Settings, color: 'yellow', action: async () => {
      const newVal = (!getBool('maintenance_mode')).toString();
      await updateSetting('maintenance_mode', newVal);
      toast({ title: newVal === 'true' ? '🔧 Maintenance ON' : '✓ Back Online' });
    }},
    { id: 3, name: getBool('slow_mode_enabled') ? '⚡ Disable Slow Mode' : '🐢 Enable Slow Mode', icon: Clock, color: 'orange', action: async () => {
      const newVal = (!getBool('slow_mode_enabled')).toString();
      await updateSetting('slow_mode_enabled', newVal);
      toast({ title: newVal === 'true' ? '🐢 Slow Mode ON' : '⚡ Slow Mode Off' });
    }},
    { id: 4, name: 'Slow Mode 5s', icon: Timer, color: 'orange', action: async () => {
      await updateSetting('slow_mode_enabled', 'true');
      await updateSetting('slow_mode_seconds', '5');
      toast({ title: 'Slow Mode', description: '5 second delay set' });
    }},
    { id: 5, name: 'Slow Mode 30s', icon: Timer, color: 'orange', action: async () => {
      await updateSetting('slow_mode_enabled', 'true');
      await updateSetting('slow_mode_seconds', '30');
      toast({ title: 'Slow Mode', description: '30 second delay set' });
    }},
    { id: 6, name: 'Slow Mode 60s', icon: Timer, color: 'red', action: async () => {
      await updateSetting('slow_mode_enabled', 'true');
      await updateSetting('slow_mode_seconds', '60');
      toast({ title: 'Slow Mode', description: '60 second delay set' });
    }},
    { id: 7, name: getBool('rate_limit_enabled') ? '🚀 Disable Rate Limit' : '📊 Enable Rate Limit', icon: BarChart3, color: 'blue', action: async () => {
      const newVal = (!getBool('rate_limit_enabled')).toString();
      await updateSetting('rate_limit_enabled', newVal);
      toast({ title: newVal === 'true' ? '📊 Rate Limit ON' : '🚀 Rate Limit Off' });
    }},
    { id: 8, name: 'Rate: 5 msg/min', icon: Zap, color: 'blue', action: async () => {
      await updateSetting('rate_limit_enabled', 'true');
      await updateSetting('rate_limit_messages', '5');
      await updateSetting('rate_limit_seconds', '60');
      toast({ title: 'Rate Limit', description: '5 messages per minute' });
    }},
    { id: 9, name: 'Rate: 10 msg/min', icon: Zap, color: 'cyan', action: async () => {
      await updateSetting('rate_limit_enabled', 'true');
      await updateSetting('rate_limit_messages', '10');
      await updateSetting('rate_limit_seconds', '60');
      toast({ title: 'Rate Limit', description: '10 messages per minute' });
    }},
    { id: 10, name: 'Rate: 20 msg/min', icon: Zap, color: 'green', action: async () => {
      await updateSetting('rate_limit_enabled', 'true');
      await updateSetting('rate_limit_messages', '20');
      await updateSetting('rate_limit_seconds', '60');
      toast({ title: 'Rate Limit', description: '20 messages per minute' });
    }},
    { id: 11, name: getBool('profanity_filter') ? '🗣 Disable Filter' : '🚫 Enable Filter', icon: Filter, color: 'purple', action: async () => {
      const newVal = (!getBool('profanity_filter')).toString();
      await updateSetting('profanity_filter', newVal);
      toast({ title: newVal === 'true' ? '🚫 Profanity Filter ON' : '🗣 Filter Disabled' });
    }},
    { id: 12, name: getBool('spam_detection') ? '📧 Disable Spam Det' : '🛡 Enable Spam Det', icon: Shield, color: 'red', action: async () => {
      const newVal = (!getBool('spam_detection')).toString();
      await updateSetting('spam_detection', newVal);
      toast({ title: newVal === 'true' ? '🛡 Spam Detection ON' : '📧 Spam Detection Off' });
    }},
    { id: 13, name: getBool('auto_ban_enabled') ? '🔓 Disable Auto-Ban' : '⚔️ Enable Auto-Ban', icon: Ban, color: 'red', action: async () => {
      const newVal = (!getBool('auto_ban_enabled')).toString();
      await updateSetting('auto_ban_enabled', newVal);
      toast({ title: newVal === 'true' ? '⚔️ Auto-Ban ON' : '🔓 Auto-Ban Off' });
    }},
    { id: 14, name: 'Ban Threshold 50', icon: AlertTriangle, color: 'orange', action: async () => {
      await updateSetting('auto_ban_threshold', '50');
      toast({ title: 'Ban Threshold', description: 'Set to 50 (strict)' });
    }},
    { id: 15, name: 'Ban Threshold 100', icon: AlertTriangle, color: 'yellow', action: async () => {
      await updateSetting('auto_ban_threshold', '100');
      toast({ title: 'Ban Threshold', description: 'Set to 100 (normal)' });
    }},
    { id: 16, name: 'Ban Threshold 200', icon: AlertTriangle, color: 'green', action: async () => {
      await updateSetting('auto_ban_threshold', '200');
      toast({ title: 'Ban Threshold', description: 'Set to 200 (relaxed)' });
    }},
    { id: 17, name: getBool('links_allowed') ? '🔗 Block Links' : '🔗 Allow Links', icon: Globe, color: 'cyan', action: async () => {
      const newVal = (!getBool('links_allowed')).toString();
      await updateSetting('links_allowed', newVal);
      toast({ title: newVal === 'true' ? '🔗 Links Allowed' : '🔗 Links Blocked' });
    }},
    { id: 18, name: getBool('files_allowed') ? '📁 Block Files' : '📁 Allow Files', icon: FileText, color: 'orange', action: async () => {
      const newVal = (!getBool('files_allowed')).toString();
      await updateSetting('files_allowed', newVal);
      toast({ title: newVal === 'true' ? '📁 Files Allowed' : '📁 Files Blocked' });
    }},
    { id: 19, name: getBool('guest_mode') ? '👤 Disable Guests' : '👥 Enable Guests', icon: Users, color: 'green', action: async () => {
      const newVal = (!getBool('guest_mode')).toString();
      await updateSetting('guest_mode', newVal);
      toast({ title: newVal === 'true' ? '👥 Guest Mode ON' : '👤 Guests Disabled' });
    }},
    { id: 20, name: getBool('announcements_enabled') ? '🔕 Mute Announce' : '📢 Enable Announce', icon: Bell, color: 'purple', action: async () => {
      const newVal = (!getBool('announcements_enabled')).toString();
      await updateSetting('announcements_enabled', newVal);
      toast({ title: newVal === 'true' ? '📢 Announcements ON' : '🔕 Announcements Muted' });
    }},

    // MESSAGE LENGTH SETTINGS (21-25)
    { id: 21, name: 'Max Length: 100', icon: MessageSquare, color: 'red', action: async () => {
      await updateSetting('max_message_length', '100');
      toast({ title: 'Message Length', description: 'Max 100 characters (strict)' });
    }},
    { id: 22, name: 'Max Length: 250', icon: MessageSquare, color: 'orange', action: async () => {
      await updateSetting('max_message_length', '250');
      toast({ title: 'Message Length', description: 'Max 250 characters' });
    }},
    { id: 23, name: 'Max Length: 500', icon: MessageSquare, color: 'yellow', action: async () => {
      await updateSetting('max_message_length', '500');
      toast({ title: 'Message Length', description: 'Max 500 characters (default)' });
    }},
    { id: 24, name: 'Max Length: 1000', icon: MessageSquare, color: 'green', action: async () => {
      await updateSetting('max_message_length', '1000');
      toast({ title: 'Message Length', description: 'Max 1000 characters' });
    }},
    { id: 25, name: 'Max Length: 2000', icon: MessageSquare, color: 'cyan', action: async () => {
      await updateSetting('max_message_length', '2000');
      toast({ title: 'Message Length', description: 'Max 2000 characters (relaxed)' });
    }},

    // FILE SIZE SETTINGS (26-30)
    { id: 26, name: 'Files: 1MB Max', icon: FileText, color: 'red', action: async () => {
      await updateSetting('file_size_limit_mb', '1');
      toast({ title: 'File Limit', description: '1MB max' });
    }},
    { id: 27, name: 'Files: 5MB Max', icon: FileText, color: 'orange', action: async () => {
      await updateSetting('file_size_limit_mb', '5');
      toast({ title: 'File Limit', description: '5MB max' });
    }},
    { id: 28, name: 'Files: 10MB Max', icon: FileText, color: 'yellow', action: async () => {
      await updateSetting('file_size_limit_mb', '10');
      toast({ title: 'File Limit', description: '10MB max (default)' });
    }},
    { id: 29, name: 'Files: 25MB Max', icon: FileText, color: 'green', action: async () => {
      await updateSetting('file_size_limit_mb', '25');
      toast({ title: 'File Limit', description: '25MB max' });
    }},
    { id: 30, name: 'Files: 50MB Max', icon: FileText, color: 'cyan', action: async () => {
      await updateSetting('file_size_limit_mb', '50');
      toast({ title: 'File Limit', description: '50MB max' });
    }},

    // BAN MANAGEMENT (31-40)
    { id: 31, name: 'Clear All Bans', icon: Unlock, color: 'green', action: async () => {
      const bans = await db.query('bans', {});
      for (const ban of bans) await db.delete('bans', { _row_id: `eq.${ban._row_id}` });
      toast({ title: 'All Unbanned', description: `${bans.length} bans removed` });
    }},
    { id: 32, name: 'Clear Expired Bans', icon: Trash2, color: 'orange', action: async () => {
      const bans = await db.query('bans', {});
      const now = Date.now();
      let cleared = 0;
      for (const ban of bans) {
        if (ban.expires_at && ban.expires_at < now) {
          await db.delete('bans', { _row_id: `eq.${ban._row_id}` });
          cleared++;
        }
      }
      toast({ title: 'Cleanup', description: `${cleared} expired bans removed` });
    }},
    { id: 33, name: 'Ban High Threats', icon: AlertTriangle, color: 'red', action: async () => {
      const threats = await db.query('threat_levels', { threat_score: 'gte.100' });
      let banned = 0;
      for (const t of threats) {
        const existing = await db.query('bans', { username: `eq.${t.username}` });
        if (existing.length === 0 && t.username) {
          await db.insert('bans', { username: t.username, device_id: t.device_id });
          banned++;
        }
      }
      toast({ title: 'Banned', description: `${banned} high-threat users banned` });
    }},
    { id: 34, name: 'Export Bans', icon: Download, color: 'blue', action: async () => {
      const bans = await db.query('bans', {});
      const blob = new Blob([JSON.stringify(bans, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bans-${Date.now()}.json`;
      a.click();
      toast({ title: 'Exported', description: `${bans.length} bans exported` });
    }},
    { id: 35, name: 'Reset Threats', icon: RefreshCw, color: 'cyan', action: async () => {
      const threats = await db.query('threat_levels', {});
      for (const t of threats) await db.update('threat_levels', { _row_id: `eq.${t._row_id}` }, { threat_score: 0, warning_count: 0 });
      toast({ title: 'Reset', description: `${threats.length} threat scores cleared` });
    }},
    { id: 36, name: 'Half All Threats', icon: Snowflake, color: 'cyan', action: async () => {
      const threats = await db.query('threat_levels', {});
      for (const t of threats) await db.update('threat_levels', { _row_id: `eq.${t._row_id}` }, { threat_score: Math.floor(t.threat_score / 2) });
      toast({ title: 'Cool Down', description: 'All threat scores halved' });
    }},
    { id: 37, name: 'Double All Threats', icon: Flame, color: 'red', action: async () => {
      const threats = await db.query('threat_levels', {});
      for (const t of threats) await db.update('threat_levels', { _row_id: `eq.${t._row_id}` }, { threat_score: Math.min(t.threat_score * 2, 200) });
      toast({ title: 'Heat Up', description: 'All threat scores doubled', variant: 'destructive' });
    }},
    { id: 38, name: 'View Ban Count', icon: Eye, color: 'purple', action: async () => {
      const bans = await db.query('bans', {});
      const now = Date.now();
      const active = bans.filter((b: { expires_at?: number }) => !b.expires_at || b.expires_at > now);
      toast({ title: 'Ban Stats', description: `${active.length} active / ${bans.length} total` });
    }},
    { id: 39, name: 'Random Unban', icon: Star, color: 'yellow', action: async () => {
      const bans = await db.query('bans', {});
      if (bans.length > 0) {
        const random = bans[Math.floor(Math.random() * bans.length)];
        await db.delete('bans', { _row_id: `eq.${random._row_id}` });
        toast({ title: 'Lucky Unban', description: `${random.username} randomly unbanned!` });
      } else toast({ title: 'No Bans' });
    }},
    { id: 40, name: 'Copy Banned Names', icon: Copy, color: 'gray', action: async () => {
      const bans = await db.query('bans', {});
      navigator.clipboard.writeText(bans.map((b: { username: string }) => b.username).join(', '));
      toast({ title: 'Copied', description: `${bans.length} banned names copied` });
    }},

    // MESSAGE MANAGEMENT (41-50)
    { id: 41, name: 'Delete All Messages', icon: Trash2, color: 'red', action: async () => {
      const msgs = await db.query('messages', {});
      for (const m of msgs) await db.delete('messages', { _row_id: `eq.${m._row_id}` });
      toast({ title: 'Cleared', description: `${msgs.length} messages deleted`, variant: 'destructive' });
    }},
    { id: 42, name: 'Delete Old (24h)', icon: Clock, color: 'orange', action: async () => {
      const cutoff = Date.now() - 86400000;
      const msgs = await db.query('messages', {});
      let deleted = 0;
      for (const m of msgs) { if (m._created_at < cutoff) { await db.delete('messages', { _row_id: `eq.${m._row_id}` }); deleted++; } }
      toast({ title: 'Cleanup', description: `${deleted} old messages deleted` });
    }},
    { id: 43, name: 'Delete Old (7d)', icon: Clock, color: 'yellow', action: async () => {
      const cutoff = Date.now() - 604800000;
      const msgs = await db.query('messages', {});
      let deleted = 0;
      for (const m of msgs) { if (m._created_at < cutoff) { await db.delete('messages', { _row_id: `eq.${m._row_id}` }); deleted++; } }
      toast({ title: 'Cleanup', description: `${deleted} week-old messages deleted` });
    }},
    { id: 44, name: 'Export Messages', icon: Download, color: 'green', action: async () => {
      const msgs = await db.query('messages', { order: '_created_at.desc', limit: 1000 });
      const blob = new Blob([JSON.stringify(msgs, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `messages-${Date.now()}.json`; a.click();
      toast({ title: 'Exported', description: `${msgs.length} messages exported` });
    }},
    { id: 45, name: 'Message Count', icon: MessageSquare, color: 'blue', action: async () => {
      const msgs = await db.query('messages', {});
      const today = msgs.filter((m: { _created_at: number }) => Date.now() - m._created_at < 86400000);
      toast({ title: 'Messages', description: `${today.length} today / ${msgs.length} total` });
    }},
    { id: 46, name: 'Find Spam', icon: Search, color: 'orange', action: async () => {
      const msgs = await db.query('messages', {});
      const spam = msgs.filter((m: { content: string }) => m.content.length > 300 || /(.)\1{8,}/.test(m.content));
      toast({ title: 'Spam Found', description: `${spam.length} potential spam messages` });
    }},
    { id: 47, name: 'Delete Spam', icon: Eraser, color: 'red', action: async () => {
      const msgs = await db.query('messages', {});
      let deleted = 0;
      for (const m of msgs) { if (m.content.length > 500 || /(.)\1{10,}/.test(m.content)) { await db.delete('messages', { _row_id: `eq.${m._row_id}` }); deleted++; } }
      toast({ title: 'Spam Removed', description: `${deleted} spam messages deleted` });
    }},
    { id: 48, name: 'Top Chatter', icon: TrendingUp, color: 'purple', action: async () => {
      const msgs = await db.query('messages', {});
      const counts = new Map();
      msgs.forEach((m: { sender_name: string }) => counts.set(m.sender_name, (counts.get(m.sender_name) || 0) + 1));
      const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (top) toast({ title: 'Top Chatter', description: `${top[0]}: ${top[1]} messages` });
    }},
    { id: 49, name: 'Most Active Room', icon: Home, color: 'cyan', action: async () => {
      const msgs = await db.query('messages', {});
      const rooms = await db.query('rooms', {});
      const counts = new Map();
      msgs.forEach((m: { room_id: number }) => counts.set(m.room_id, (counts.get(m.room_id) || 0) + 1));
      const topId = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (topId) {
        const room = rooms.find((r: { _row_id: number }) => r._row_id === topId[0]);
        toast({ title: 'Most Active', description: `${room?.name || 'Unknown'}: ${topId[1]} messages` });
      }
    }},
    { id: 50, name: 'Avg Msg Length', icon: BarChart3, color: 'blue', action: async () => {
      const msgs = await db.query('messages', {});
      if (msgs.length === 0) return toast({ title: 'No Messages' });
      const avg = msgs.reduce((a: number, m: { content: string }) => a + m.content.length, 0) / msgs.length;
      toast({ title: 'Average Length', description: `${Math.round(avg)} characters` });
    }},

    // ROOM MANAGEMENT (51-60)
    { id: 51, name: 'Create Public Room', icon: Globe, color: 'green', action: async () => {
      const name = `Public-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      await db.insert('rooms', { name, type: 'public', code: null });
      toast({ title: 'Created', description: name });
    }},
    { id: 52, name: 'Create Private Room', icon: Lock, color: 'purple', action: async () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await db.insert('rooms', { name: `Private-${code}`, type: 'private', code });
      toast({ title: 'Created', description: `Code: ${code}` });
    }},
    { id: 53, name: 'Delete Empty Rooms', icon: Trash2, color: 'orange', action: async () => {
      const rooms = await db.query('rooms', { type: 'eq.private' });
      let deleted = 0;
      for (const room of rooms) {
        const msgs = await db.query('messages', { room_id: `eq.${room._row_id}` });
        if (msgs.length === 0) { await db.delete('rooms', { _row_id: `eq.${room._row_id}` }); deleted++; }
      }
      toast({ title: 'Cleanup', description: `${deleted} empty rooms deleted` });
    }},
    { id: 54, name: 'Delete Old Rooms', icon: Archive, color: 'gray', action: async () => {
      const rooms = await db.query('rooms', { type: 'eq.private' });
      const cutoff = Date.now() - 604800000;
      let deleted = 0;
      for (const room of rooms) {
        const msgs = await db.query('messages', { room_id: `eq.${room._row_id}`, order: '_created_at.desc', limit: 1 });
        if (msgs.length === 0 || msgs[0]._created_at < cutoff) { await db.delete('rooms', { _row_id: `eq.${room._row_id}` }); deleted++; }
      }
      toast({ title: 'Cleanup', description: `${deleted} inactive rooms deleted` });
    }},
    { id: 55, name: 'Room Count', icon: PieChart, color: 'blue', action: async () => {
      const rooms = await db.query('rooms', {});
      const pub = rooms.filter((r: { type: string }) => r.type === 'public').length;
      toast({ title: 'Rooms', description: `${pub} public / ${rooms.length - pub} private` });
    }},
    { id: 56, name: 'Copy Room Codes', icon: Key, color: 'cyan', action: async () => {
      const rooms = await db.query('rooms', { type: 'eq.private' });
      navigator.clipboard.writeText(rooms.map((r: { name: string; code: string }) => `${r.name}: ${r.code}`).join('\n'));
      toast({ title: 'Copied', description: `${rooms.length} room codes copied` });
    }},
    { id: 57, name: 'Export Rooms', icon: Download, color: 'green', action: async () => {
      const rooms = await db.query('rooms', {});
      const blob = new Blob([JSON.stringify(rooms, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `rooms-${Date.now()}.json`; a.click();
      toast({ title: 'Exported', description: `${rooms.length} rooms exported` });
    }},
    { id: 58, name: 'Delete All Private', icon: Trash2, color: 'red', action: async () => {
      const rooms = await db.query('rooms', { type: 'eq.private' });
      for (const room of rooms) {
        const msgs = await db.query('messages', { room_id: `eq.${room._row_id}` });
        for (const m of msgs) await db.delete('messages', { _row_id: `eq.${m._row_id}` });
        await db.delete('rooms', { _row_id: `eq.${room._row_id}` });
      }
      toast({ title: 'Deleted', description: `${rooms.length} private rooms deleted`, variant: 'destructive' });
    }},
    { id: 59, name: 'Regenerate Codes', icon: RefreshCw, color: 'purple', action: async () => {
      const rooms = await db.query('rooms', { type: 'eq.private' });
      for (const room of rooms) {
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        await db.update('rooms', { _row_id: `eq.${room._row_id}` }, { code: newCode });
      }
      toast({ title: 'Regenerated', description: `${rooms.length} room codes changed` });
    }},
    { id: 60, name: 'View Room Stats', icon: Activity, color: 'blue', action: async () => {
      const rooms = await db.query('rooms', {});
      const msgs = await db.query('messages', {});
      toast({ title: 'Stats', description: `${rooms.length} rooms, ${msgs.length} total messages` });
    }},

    // USER MANAGEMENT (61-70)
    { id: 61, name: 'User Count', icon: Users, color: 'blue', action: async () => {
      const users = await db.query('users', {});
      const now = Date.now();
      const active = users.filter((u: { last_active: number }) => now - u.last_active < 300000);
      toast({ title: 'Users', description: `${active.length} online / ${users.length} total` });
    }},
    { id: 62, name: 'Export Users', icon: Download, color: 'green', action: async () => {
      const users = await db.query('users', {});
      const blob = new Blob([JSON.stringify(users, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `users-${Date.now()}.json`; a.click();
      toast({ title: 'Exported', description: `${users.length} users exported` });
    }},
    { id: 63, name: 'Copy Online Users', icon: Clipboard, color: 'cyan', action: async () => {
      const users = await db.query('users', {});
      const online = users.filter((u: { last_active: number }) => Date.now() - u.last_active < 300000);
      navigator.clipboard.writeText(online.map((u: { username: string }) => u.username).join(', '));
      toast({ title: 'Copied', description: `${online.length} online users copied` });
    }},
    { id: 64, name: 'New Users Today', icon: UserPlus, color: 'green', action: async () => {
      const users = await db.query('users', {});
      const newUsers = users.filter((u: { first_seen: number }) => Date.now() - u.first_seen < 86400000);
      toast({ title: 'New Today', description: `${newUsers.length} new users` });
    }},
    { id: 65, name: 'Inactive Users', icon: UserX, color: 'gray', action: async () => {
      const users = await db.query('users', {});
      const inactive = users.filter((u: { last_active: number }) => Date.now() - u.last_active > 604800000);
      toast({ title: 'Inactive (7d+)', description: `${inactive.length} users` });
    }},
    { id: 66, name: 'Purge Inactive', icon: Flame, color: 'red', action: async () => {
      const users = await db.query('users', {});
      const cutoff = Date.now() - 2592000000;
      let deleted = 0;
      for (const u of users) { if (u.last_active < cutoff) { await db.delete('users', { _row_id: `eq.${u._row_id}` }); deleted++; } }
      toast({ title: 'Purged', description: `${deleted} inactive users deleted` });
    }},
    { id: 67, name: 'VIP Count', icon: Star, color: 'yellow', action: async () => {
      const users = await db.query('users', { is_vip: 'eq.1' });
      toast({ title: 'VIP Users', description: `${users.length} VIP users` });
    }},
    { id: 68, name: 'Muted Count', icon: VolumeX, color: 'red', action: async () => {
      const users = await db.query('users', { is_muted: 'eq.1' });
      toast({ title: 'Muted Users', description: `${users.length} muted users` });
    }},
    { id: 69, name: 'Unmute All', icon: Volume2, color: 'green', action: async () => {
      const users = await db.query('users', { is_muted: 'eq.1' });
      for (const u of users) await db.update('users', { _row_id: `eq.${u._row_id}` }, { is_muted: 0 });
      toast({ title: 'Unmuted', description: `${users.length} users unmuted` });
    }},
    { id: 70, name: 'Clear Warnings', icon: CheckCircle2, color: 'green', action: async () => {
      const users = await db.query('users', {});
      for (const u of users) await db.update('users', { _row_id: `eq.${u._row_id}` }, { warning_count: 0 });
      toast({ title: 'Cleared', description: 'All user warnings reset' });
    }},

    // APPEALS & SUGGESTIONS (71-80)
    { id: 71, name: 'Approve All Appeals', icon: CheckCircle2, color: 'green', action: async () => {
      const appeals = await db.query('appeals', { status: 'eq.pending' });
      for (const a of appeals) {
        await db.update('appeals', { _row_id: `eq.${a._row_id}` }, { status: 'approved' });
        await db.delete('bans', { username: `eq.${a.banned_username}` });
      }
      toast({ title: 'Approved', description: `${appeals.length} appeals approved` });
    }},
    { id: 72, name: 'Deny All Appeals', icon: XCircle, color: 'red', action: async () => {
      const appeals = await db.query('appeals', { status: 'eq.pending' });
      for (const a of appeals) await db.update('appeals', { _row_id: `eq.${a._row_id}` }, { status: 'denied' });
      toast({ title: 'Denied', description: `${appeals.length} appeals denied` });
    }},
    { id: 73, name: 'Clear Appeals', icon: Trash2, color: 'orange', action: async () => {
      const appeals = await db.query('appeals', {});
      for (const a of appeals) await db.delete('appeals', { _row_id: `eq.${a._row_id}` });
      toast({ title: 'Cleared', description: `${appeals.length} appeals deleted` });
    }},
    { id: 74, name: 'Appeal Count', icon: Scale, color: 'blue', action: async () => {
      const appeals = await db.query('appeals', {});
      const pending = appeals.filter((a: { status: string }) => a.status === 'pending').length;
      toast({ title: 'Appeals', description: `${pending} pending / ${appeals.length} total` });
    }},
    { id: 75, name: 'Clear Suggestions', icon: Trash2, color: 'orange', action: async () => {
      const suggestions = await db.query('suggestions', {});
      for (const s of suggestions) await db.delete('suggestions', { _row_id: `eq.${s._row_id}` });
      toast({ title: 'Cleared', description: `${suggestions.length} suggestions deleted` });
    }},
    { id: 76, name: 'Suggestion Count', icon: Heart, color: 'pink', action: async () => {
      const suggestions = await db.query('suggestions', {});
      toast({ title: 'Suggestions', description: `${suggestions.length} total suggestions` });
    }},
    { id: 77, name: 'Export Appeals', icon: Download, color: 'green', action: async () => {
      const appeals = await db.query('appeals', {});
      const blob = new Blob([JSON.stringify(appeals, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `appeals-${Date.now()}.json`; a.click();
      toast({ title: 'Exported', description: `${appeals.length} appeals exported` });
    }},
    { id: 78, name: 'Export Suggestions', icon: Download, color: 'green', action: async () => {
      const suggestions = await db.query('suggestions', {});
      const blob = new Blob([JSON.stringify(suggestions, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `suggestions-${Date.now()}.json`; a.click();
      toast({ title: 'Exported', description: `${suggestions.length} suggestions exported` });
    }},
    { id: 79, name: 'Mark All Read', icon: Eye, color: 'blue', action: async () => {
      const suggestions = await db.query('suggestions', {});
      for (const s of suggestions) await db.update('suggestions', { _row_id: `eq.${s._row_id}` }, { is_read: 1 });
      toast({ title: 'Marked Read', description: `${suggestions.length} marked` });
    }},
    { id: 80, name: 'Pending Count', icon: Clock, color: 'yellow', action: async () => {
      const appeals = await db.query('appeals', { status: 'eq.pending' });
      toast({ title: 'Pending', description: `${appeals.length} appeals waiting` });
    }},

    // FILE MANAGEMENT (81-85)
    { id: 81, name: 'File Count', icon: FileText, color: 'blue', action: async () => {
      const files = await db.query('uploaded_files', {});
      const total = files.reduce((a: number, f: { file_size: number }) => a + (f.file_size || 0), 0);
      toast({ title: 'Files', description: `${files.length} files (${(total / 1024 / 1024).toFixed(1)} MB)` });
    }},
    { id: 82, name: 'Delete All Files', icon: Trash2, color: 'red', action: async () => {
      const files = await db.query('uploaded_files', {});
      for (const f of files) await db.delete('uploaded_files', { _row_id: `eq.${f._row_id}` });
      toast({ title: 'Deleted', description: `${files.length} file records removed` });
    }},
    { id: 83, name: 'Export Files List', icon: Download, color: 'green', action: async () => {
      const files = await db.query('uploaded_files', {});
      const blob = new Blob([JSON.stringify(files, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `files-${Date.now()}.json`; a.click();
      toast({ title: 'Exported', description: `${files.length} file records exported` });
    }},
    { id: 84, name: 'Large Files', icon: AlertTriangle, color: 'orange', action: async () => {
      const files = await db.query('uploaded_files', {});
      const large = files.filter((f: { file_size: number }) => f.file_size > 5000000);
      toast({ title: 'Large Files', description: `${large.length} files over 5MB` });
    }},
    { id: 85, name: 'Files Today', icon: Clock, color: 'cyan', action: async () => {
      const files = await db.query('uploaded_files', {});
      const today = files.filter((f: { _created_at: number }) => Date.now() - f._created_at < 86400000);
      toast({ title: 'Today', description: `${today.length} files uploaded today` });
    }},

    // SYSTEM & DATABASE (86-95)
    { id: 86, name: 'Full Export', icon: Database, color: 'green', action: async () => {
      const data = { rooms: await db.query('rooms', {}), messages: await db.query('messages', {}), users: await db.query('users', {}), bans: await db.query('bans', {}), settings: await db.query('admin_settings', {}), exported: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `full-backup-${Date.now()}.json`; a.click();
      toast({ title: 'Full Backup', description: 'Complete database exported' });
    }},
    { id: 87, name: 'DB Stats', icon: Database, color: 'blue', action: async () => {
      const [r, m, u, b] = await Promise.all([db.query('rooms', {}), db.query('messages', {}), db.query('users', {}), db.query('bans', {})]);
      toast({ title: 'Database', description: `R:${r.length} M:${m.length} U:${u.length} B:${b.length}` });
    }},
    { id: 88, name: 'Clear LocalStorage', icon: Eraser, color: 'orange', action: () => {
      const admin = localStorage.getItem('isAdmin');
      localStorage.clear();
      if (admin) localStorage.setItem('isAdmin', admin);
      toast({ title: 'Cleared', description: 'Local storage cleared (kept admin login)' });
    }},
    { id: 89, name: 'Memory Usage', icon: Activity, color: 'cyan', action: () => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      if (mem) toast({ title: 'Memory', description: `${Math.round(mem.usedJSHeapSize / 1024 / 1024)}MB / ${Math.round(mem.totalJSHeapSize / 1024 / 1024)}MB` });
      else toast({ title: 'Memory', description: 'Not available' });
    }},
    { id: 90, name: 'Uptime', icon: Clock, color: 'green', action: () => {
      toast({ title: 'Session Uptime', description: `${Math.round(performance.now() / 60000)} minutes` });
    }},
    { id: 91, name: 'Refresh Page', icon: RefreshCw, color: 'blue', action: () => window.location.reload() },
    { id: 92, name: 'Console Log', icon: FileText, color: 'gray', action: () => {
      console.log('Admin action at', new Date().toISOString(), { settings, stats });
      toast({ title: 'Logged', description: 'Check browser console (F12)' });
    }},
    { id: 93, name: 'Test Toast', icon: Bell, color: 'purple', action: () => toast({ title: '🎉 Test', description: 'Everything working!' }) },
    { id: 94, name: 'Copy Stats', icon: Copy, color: 'cyan', action: () => { navigator.clipboard.writeText(JSON.stringify(stats, null, 2)); toast({ title: 'Copied', description: 'Stats copied' }); } },
    { id: 95, name: 'Copy Settings', icon: Copy, color: 'purple', action: () => { navigator.clipboard.writeText(JSON.stringify(settings, null, 2)); toast({ title: 'Copied', description: 'Settings copied' }); } },

    // SPECIAL ACTIONS (96-100)
    { id: 96, name: 'Reset All Settings', icon: RotateCcw, color: 'red', action: async () => {
      const defaults: Record<string, string> = { slow_mode_enabled: 'false', slow_mode_seconds: '5', max_message_length: '500', links_allowed: 'true', images_allowed: 'true', files_allowed: 'true', guest_mode: 'false', profanity_filter: 'true', auto_ban_enabled: 'true', auto_ban_threshold: '100', rate_limit_enabled: 'false', rate_limit_messages: '10', rate_limit_seconds: '60', maintenance_mode: 'false', announcements_enabled: 'true', file_size_limit_mb: '10', lockdown_mode: 'false', new_user_cooldown: '0', spam_detection: 'true', vip_bypass_limits: 'true' };
      for (const [k, v] of Object.entries(defaults)) await db.update('admin_settings', { setting_key: `eq.${k}` }, { setting_value: v });
      setSettings(defaults);
      toast({ title: 'Reset', description: 'All settings restored to defaults' });
    }},
    { id: 97, name: 'Strict Mode', icon: Shield, color: 'red', action: async () => {
      await updateSetting('slow_mode_enabled', 'true'); await updateSetting('slow_mode_seconds', '30');
      await updateSetting('rate_limit_enabled', 'true'); await updateSetting('rate_limit_messages', '5');
      await updateSetting('profanity_filter', 'true'); await updateSetting('spam_detection', 'true');
      await updateSetting('max_message_length', '200'); await updateSetting('links_allowed', 'false');
      toast({ title: '🛡️ STRICT MODE', description: 'All restrictions enabled' });
    }},
    { id: 98, name: 'Relaxed Mode', icon: Heart, color: 'green', action: async () => {
      await updateSetting('slow_mode_enabled', 'false'); await updateSetting('rate_limit_enabled', 'false');
      await updateSetting('max_message_length', '2000'); await updateSetting('links_allowed', 'true');
      await updateSetting('files_allowed', 'true'); await updateSetting('file_size_limit_mb', '50');
      toast({ title: '💚 RELAXED MODE', description: 'Restrictions minimized' });
    }},
    { id: 99, name: 'Party Mode 🎉', icon: Star, color: 'yellow', action: async () => {
      await updateSetting('slow_mode_enabled', 'false'); await updateSetting('rate_limit_enabled', 'false');
      await updateSetting('announcements_enabled', 'true'); await updateSetting('files_allowed', 'true');
      toast({ title: '🎉 PARTY MODE', description: "Let's have fun!" });
    }},
    { id: 100, name: '💥 CRASH ALL', icon: Bomb, color: 'red', action: async () => {
      localStorage.setItem('admin_crash_command', JSON.stringify({ active: true, timestamp: Date.now(), duration: 1000 }));
      if ('BroadcastChannel' in window) { const channel = new BroadcastChannel('admin_commands'); channel.postMessage({ type: 'CRASH_ALL', duration: 1000 }); }
      toast({ title: '💥 CRASH INITIATED', description: 'All users crashed for 1 second', variant: 'destructive' });
      setTimeout(() => window.dispatchEvent(new CustomEvent('admin_crash', { detail: { duration: 1000 } })), 100);
    }},
  ];

  const getColorClass = (color: string) => {
    const colors: Record<string, string> = {
      red: 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border-red-500/30',
      orange: 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 border-orange-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 border-yellow-500/30',
      green: 'bg-green-500/20 text-green-300 hover:bg-green-500/30 border-green-500/30',
      cyan: 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border-cyan-500/30',
      blue: 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border-blue-500/30',
      purple: 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border-purple-500/30',
      pink: 'bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 border-pink-500/30',
      gray: 'bg-gray-500/20 text-gray-300 hover:bg-gray-500/30 border-gray-500/30',
    };
    return colors[color] || colors.gray;
  };

  const filteredActions = searchQuery ? quickActions.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase())) : quickActions;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border-blue-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-blue-300">Users</p><p className="text-xl font-bold text-white">{stats.totalUsers}</p></div>
              <Users className="w-5 h-5 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-green-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-green-300">Online</p><p className="text-xl font-bold text-white">{stats.activeUsers}</p></div>
              <Activity className="w-5 h-5 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-purple-300">Messages</p><p className="text-xl font-bold text-white">{stats.totalMessages}</p></div>
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border-red-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-red-300">Bans</p><p className="text-xl font-bold text-white">{stats.activeBans}</p></div>
              <Ban className="w-5 h-5 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-600/20 to-amber-600/20 border-yellow-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-yellow-300">Appeals</p><p className="text-xl font-bold text-white">{stats.pendingAppeals}</p></div>
              <Scale className="w-5 h-5 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-600/20 to-red-600/20 border-orange-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-orange-300">Rooms</p><p className="text-xl font-bold text-white">{stats.totalRooms}</p></div>
              <Home className="w-5 h-5 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Settings Status */}
      <Card className="glass-morphism border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            <Badge className={getBool('lockdown_mode') ? 'bg-red-500/30 text-red-200' : 'bg-green-500/30 text-green-200'}>
              {getBool('lockdown_mode') ? '🔒 LOCKDOWN' : '✓ Normal'}
            </Badge>
            <Badge className={getBool('maintenance_mode') ? 'bg-yellow-500/30 text-yellow-200' : 'bg-green-500/30 text-green-200'}>
              {getBool('maintenance_mode') ? '🔧 Maintenance' : '✓ Online'}
            </Badge>
            <Badge className={getBool('slow_mode_enabled') ? 'bg-orange-500/30 text-orange-200' : 'bg-gray-500/30 text-gray-200'}>
              {getBool('slow_mode_enabled') ? `🐢 Slow ${settings.slow_mode_seconds}s` : '⚡ No Delay'}
            </Badge>
            <Badge className={getBool('rate_limit_enabled') ? 'bg-blue-500/30 text-blue-200' : 'bg-gray-500/30 text-gray-200'}>
              {getBool('rate_limit_enabled') ? `📊 ${settings.rate_limit_messages}/min` : '🚀 No Limit'}
            </Badge>
            <Badge className={getBool('profanity_filter') ? 'bg-purple-500/30 text-purple-200' : 'bg-gray-500/30 text-gray-200'}>
              {getBool('profanity_filter') ? '🚫 Filter ON' : '🗣 Filter OFF'}
            </Badge>
            <Badge className={getBool('auto_ban_enabled') ? 'bg-red-500/30 text-red-200' : 'bg-gray-500/30 text-gray-200'}>
              {getBool('auto_ban_enabled') ? `⚔️ Auto-Ban @${settings.auto_ban_threshold}` : '🔓 Auto-Ban OFF'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search 100 quick actions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-white/5 border-white/10" />
        </div>
        <Button onClick={() => { loadStats(); loadSettings(); }} variant="outline" size="icon">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Quick Actions Grid */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400" />100 Quick Actions</CardTitle>
          <CardDescription>One-click admin tools - settings changes take effect immediately</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {filteredActions.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  className={`h-auto py-2 px-2 flex flex-col items-center gap-1 transition-all hover:scale-105 ${getColorClass(action.color)}`}
                  onClick={async () => {
                    setLoading(true);
                    try { await action.action(); await loadStats(); await loadSettings(); }
                    catch (error) { console.error('Action error:', error); toast({ title: 'Error', description: 'Action failed', variant: 'destructive' }); }
                    finally { setLoading(false); }
                  }}
                >
                  <action.icon className="w-4 h-4" />
                  <span className="text-[10px] text-center leading-tight">{action.name}</span>
                  <Badge variant="outline" className="text-[8px] px-1 py-0">#{action.id}</Badge>
                </Button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminQuickActions;
