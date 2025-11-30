import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Zap, Trash2, Ban, Clock, Users, MessageSquare, Shield, 
  Eye, EyeOff, Volume2, VolumeX, Lock, Unlock, Download,
  RefreshCw, Search, AlertTriangle, CheckCircle2,
  XCircle, Globe, Bell, Settings, Database,
  Activity, TrendingUp, BarChart3, PieChart, Archive,
  Copy, Clipboard, FileText, UserX, UserPlus, Timer,
  Flame, Snowflake, Moon, Sun, Scale, Bomb
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

const AdminQuickActions = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<QuickStats>({
    totalUsers: 0, activeUsers: 0, totalMessages: 0, totalBans: 0,
    activeBans: 0, pendingAppeals: 0, totalRooms: 0, publicRooms: 0,
    privateRooms: 0, suggestionsCount: 0, filesShared: 0, threatAlerts: 0
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
    // Real-time updates - refresh every 2 seconds
    const interval = setInterval(loadStats, 2000);
    return () => clearInterval(interval);
  }, []);

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

  // Quick action functions
  const quickActions = [
    // User Management (1-10)
    { id: 1, name: 'Ban Last Active User', icon: Ban, color: 'red', action: async () => {
      const users = await db.query('users', { order: 'last_active.desc', limit: 1 });
      if (users.length > 0) {
        toast({ title: 'User found', description: `Last active: ${users[0].username}` });
      }
    }},
    { id: 2, name: 'Clear Expired Bans', icon: Trash2, color: 'orange', action: async () => {
      const bans = await db.query('bans', {});
      const now = Date.now();
      let cleared = 0;
      for (const ban of bans) {
        if (ban.expires_at && ban.expires_at < now) {
          await db.delete('bans', { _row_id: `eq.${ban._row_id}` });
          cleared++;
        }
      }
      toast({ title: 'Cleared expired bans', description: `${cleared} bans removed` });
    }},
    { id: 3, name: 'Export User List', icon: Download, color: 'blue', action: async () => {
      const users = await db.query('users', {});
      const data = JSON.stringify(users, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-${Date.now()}.json`;
      a.click();
      toast({ title: 'Exported', description: `${users.length} users exported` });
    }},
    { id: 4, name: 'Find Duplicate Devices', icon: Copy, color: 'purple', action: async () => {
      const users = await db.query('users', {});
      const deviceMap = new Map();
      users.forEach((u: { device_id: string; username: string }) => {
        if (!deviceMap.has(u.device_id)) deviceMap.set(u.device_id, []);
        deviceMap.get(u.device_id).push(u.username);
      });
      const duplicates = Array.from(deviceMap.entries()).filter(([, users]) => users.length > 1);
      toast({ title: 'Duplicate Devices', description: `Found ${duplicates.length} devices with multiple accounts` });
    }},
    { id: 5, name: 'Mass Unban All', icon: Unlock, color: 'green', action: async () => {
      const bans = await db.query('bans', {});
      for (const ban of bans) {
        await db.delete('bans', { _row_id: `eq.${ban._row_id}` });
      }
      toast({ title: 'Mass Unban', description: `${bans.length} users unbanned` });
    }},
    { id: 6, name: 'View Inactive Users', icon: UserX, color: 'gray', action: async () => {
      const users = await db.query('users', {});
      const inactive = users.filter((u: { last_active: number }) => Date.now() - u.last_active > 86400000 * 7);
      toast({ title: 'Inactive Users', description: `${inactive.length} users inactive for 7+ days` });
    }},
    { id: 7, name: 'New Users Today', icon: UserPlus, color: 'cyan', action: async () => {
      const today = Date.now() - 86400000;
      const users = await db.query('users', { first_seen: `gte.${today}` });
      toast({ title: 'New Users Today', description: `${users.length} new users` });
    }},
    { id: 8, name: 'Reset Threat Scores', icon: Shield, color: 'yellow', action: async () => {
      const threats = await db.query('threat_levels', {});
      for (const t of threats) {
        await db.update('threat_levels', { _row_id: `eq.${t._row_id}` }, { threat_score: 0, warning_count: 0 });
      }
      toast({ title: 'Reset Complete', description: `${threats.length} threat scores reset` });
    }},
    { id: 9, name: 'Ban High-Risk Users', icon: AlertTriangle, color: 'red', action: async () => {
      const threats = await db.query('threat_levels', { threat_score: 'gte.100' });
      let banned = 0;
      for (const t of threats) {
        const existing = await db.query('bans', { username: `eq.${t.username}` });
        if (existing.length === 0) {
          await db.insert('bans', { username: t.username, device_id: t.device_id, ban_reason: 'High threat score auto-ban', created_at: Date.now(), expires_at: Date.now() + 86400000 });
          banned++;
        }
      }
      toast({ title: 'High-Risk Ban', description: `${banned} users banned` });
    }},
    { id: 10, name: 'Copy Active Users', icon: Clipboard, color: 'blue', action: async () => {
      const now = Date.now();
      const users = await db.query('users', {});
      const active = users.filter((u: { last_active: number }) => now - u.last_active < 300000);
      navigator.clipboard.writeText(active.map((u: { username: string }) => u.username).join(', '));
      toast({ title: 'Copied', description: `${active.length} active usernames copied` });
    }},

    // Message Management (11-20)
    { id: 11, name: 'Delete All Messages', icon: Trash2, color: 'red', action: async () => {
      const messages = await db.query('messages', {});
      for (const m of messages) {
        await db.delete('messages', { _row_id: `eq.${m._row_id}` });
      }
      toast({ title: 'Cleared', description: `${messages.length} messages deleted` });
    }},
    { id: 12, name: 'Export Messages', icon: Download, color: 'green', action: async () => {
      const messages = await db.query('messages', { order: '_created_at.desc', limit: 1000 });
      const data = JSON.stringify(messages, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `messages-${Date.now()}.json`;
      a.click();
      toast({ title: 'Exported', description: `Messages exported` });
    }},
    { id: 13, name: 'Find Spam Messages', icon: Search, color: 'orange', action: async () => {
      const messages = await db.query('messages', {});
      const spam = messages.filter((m: { content: string }) => m.content.length > 500 || /(.)\1{10,}/.test(m.content));
      toast({ title: 'Spam Found', description: `${spam.length} potential spam messages` });
    }},
    { id: 14, name: 'Clear Old Messages', icon: Archive, color: 'gray', action: async () => {
      const cutoff = Date.now() - 86400000 * 30; // 30 days
      const messages = await db.query('messages', { _created_at: `lt.${cutoff}` });
      for (const m of messages) {
        await db.delete('messages', { _row_id: `eq.${m._row_id}` });
      }
      toast({ title: 'Cleared', description: `${messages.length} old messages deleted` });
    }},
    { id: 15, name: 'Message Stats', icon: BarChart3, color: 'blue', action: async () => {
      const messages = await db.query('messages', {});
      const today = messages.filter((m: { _created_at: number }) => Date.now() - m._created_at < 86400000);
      const avgLength = messages.reduce((acc: number, m: { content: string }) => acc + m.content.length, 0) / messages.length;
      toast({ title: 'Message Stats', description: `Today: ${today.length}, Avg length: ${Math.round(avgLength)} chars` });
    }},
    { id: 16, name: 'Find Links', icon: Globe, color: 'cyan', action: async () => {
      const messages = await db.query('messages', {});
      const withLinks = messages.filter((m: { content: string }) => /(https?:\/\/|www\.)/i.test(m.content));
      toast({ title: 'Links Found', description: `${withLinks.length} messages contain links` });
    }},
    { id: 17, name: 'Most Active Room', icon: TrendingUp, color: 'green', action: async () => {
      const messages = await db.query('messages', {});
      const roomCounts = new Map();
      messages.forEach((m: { room_id: number }) => roomCounts.set(m.room_id, (roomCounts.get(m.room_id) || 0) + 1));
      const sorted = Array.from(roomCounts.entries()).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        toast({ title: 'Most Active Room', description: `Room #${sorted[0][0]} with ${sorted[0][1]} messages` });
      }
    }},
    { id: 18, name: 'Top Posters', icon: Users, color: 'purple', action: async () => {
      const messages = await db.query('messages', {});
      const userCounts = new Map();
      messages.forEach((m: { sender_name: string }) => userCounts.set(m.sender_name, (userCounts.get(m.sender_name) || 0) + 1));
      const sorted = Array.from(userCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
      toast({ title: 'Top 5 Posters', description: sorted.map(([u, c]) => `${u}: ${c}`).join(', ') });
    }},
    { id: 19, name: 'Delete by User', icon: UserX, color: 'red', action: async () => {
      setSelectedAction('delete_user_messages');
      toast({ title: 'Action Pending', description: 'Enter username in search' });
    }},
    { id: 20, name: 'Broadcast Alert', icon: Bell, color: 'yellow', action: async () => {
      setSelectedAction('broadcast');
      toast({ title: 'Broadcast Mode', description: 'Enter message in search' });
    }},

    // Room Management (21-30)
    { id: 21, name: 'Create Public Room', icon: Globe, color: 'green', action: async () => {
      const name = `Public-${Date.now().toString(36)}`;
      await db.insert('rooms', { name, type: 'public', code: null });
      toast({ title: 'Room Created', description: `${name} created` });
    }},
    { id: 22, name: 'Create Private Room', icon: Lock, color: 'purple', action: async () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const name = `Private-${code}`;
      await db.insert('rooms', { name, type: 'private', code });
      toast({ title: 'Room Created', description: `${name} (Code: ${code})` });
    }},
    { id: 23, name: 'Delete Empty Rooms', icon: Trash2, color: 'orange', action: async () => {
      const rooms = await db.query('rooms', { type: 'eq.private' });
      let deleted = 0;
      for (const room of rooms) {
        const messages = await db.query('messages', { room_id: `eq.${room._row_id}` });
        if (messages.length === 0) {
          await db.delete('rooms', { _row_id: `eq.${room._row_id}` });
          deleted++;
        }
      }
      toast({ title: 'Cleanup', description: `${deleted} empty rooms deleted` });
    }},
    { id: 24, name: 'Room Statistics', icon: PieChart, color: 'blue', action: async () => {
      const rooms = await db.query('rooms', {});
      const pub = rooms.filter((r: { type: string }) => r.type === 'public').length;
      toast({ title: 'Room Stats', description: `${pub} public, ${rooms.length - pub} private` });
    }},
    { id: 25, name: 'Copy All Codes', icon: Copy, color: 'cyan', action: async () => {
      const rooms = await db.query('rooms', { type: 'eq.private' });
      const codes = rooms.map((r: { code: string; name: string }) => `${r.name}: ${r.code}`).join('\n');
      navigator.clipboard.writeText(codes);
      toast({ title: 'Copied', description: `${rooms.length} room codes copied` });
    }},
    { id: 26, name: 'Archive Old Rooms', icon: Archive, color: 'gray', action: async () => {
      const rooms = await db.query('rooms', { type: 'eq.private' });
      const cutoff = Date.now() - 86400000 * 7;
      let archived = 0;
      for (const room of rooms) {
        const messages = await db.query('messages', { room_id: `eq.${room._row_id}`, order: '_created_at.desc', limit: 1 });
        if (messages.length === 0 || messages[0]._created_at < cutoff) {
          await db.delete('rooms', { _row_id: `eq.${room._row_id}` });
          archived++;
        }
      }
      toast({ title: 'Archived', description: `${archived} inactive rooms removed` });
    }},
    { id: 27, name: 'Rename Public Room', icon: FileText, color: 'blue', action: async () => {
      setSelectedAction('rename_room');
      toast({ title: 'Rename Mode', description: 'Enter new name in search' });
    }},
    { id: 28, name: 'Lock All Private', icon: Lock, color: 'red', action: async () => {
      const rooms = await db.query('rooms', { type: 'eq.private' });
      for (const room of rooms) {
        await db.update('rooms', { _row_id: `eq.${room._row_id}` }, { locked: true });
      }
      toast({ title: 'Locked', description: `${rooms.length} rooms locked` });
    }},
    { id: 29, name: 'Unlock All Private', icon: Unlock, color: 'green', action: async () => {
      const rooms = await db.query('rooms', { type: 'eq.private' });
      for (const room of rooms) {
        await db.update('rooms', { _row_id: `eq.${room._row_id}` }, { locked: false });
      }
      toast({ title: 'Unlocked', description: `${rooms.length} rooms unlocked` });
    }},
    { id: 30, name: 'Generate Room Report', icon: FileText, color: 'purple', action: async () => {
      const rooms = await db.query('rooms', {});
      let report = 'Room Report\n==========\n\n';
      for (const room of rooms) {
        const messages = await db.query('messages', { room_id: `eq.${room._row_id}` });
        report += `${room.name} (${room.type}): ${messages.length} messages\n`;
      }
      navigator.clipboard.writeText(report);
      toast({ title: 'Report Generated', description: 'Copied to clipboard' });
    }},

    // System & Database (31-40)
    { id: 31, name: 'Database Stats', icon: Database, color: 'blue', action: async () => {
      const [users, messages, bans, rooms] = await Promise.all([
        db.query('users', {}), db.query('messages', {}), db.query('bans', {}), db.query('rooms', {})
      ]);
      toast({ title: 'Database', description: `Users: ${users.length}, Messages: ${messages.length}, Bans: ${bans.length}, Rooms: ${rooms.length}` });
    }},
    { id: 32, name: 'Clear Cache', icon: RefreshCw, color: 'orange', action: () => {
      localStorage.clear();
      sessionStorage.clear();
      toast({ title: 'Cache Cleared', description: 'Local storage cleared' });
    }},
    { id: 33, name: 'Export All Data', icon: Download, color: 'green', action: async () => {
      const data = {
        users: await db.query('users', {}),
        messages: await db.query('messages', {}),
        bans: await db.query('bans', {}),
        rooms: await db.query('rooms', {}),
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `full-export-${Date.now()}.json`;
      a.click();
      toast({ title: 'Exported', description: 'Full database exported' });
    }},
    { id: 34, name: 'System Health', icon: Activity, color: 'green', action: () => {
      const memory = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
      const used = memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : 'N/A';
      const total = memory ? Math.round(memory.totalJSHeapSize / 1024 / 1024) : 'N/A';
      toast({ title: 'System Health', description: `Memory: ${used}MB / ${total}MB` });
    }},
    { id: 35, name: 'Clear Notifications', icon: Bell, color: 'gray', action: async () => {
      const notifs = await db.query('notifications', {});
      for (const n of notifs) {
        await db.delete('notifications', { _row_id: `eq.${n._row_id}` });
      }
      toast({ title: 'Cleared', description: `${notifs.length} notifications deleted` });
    }},
    { id: 36, name: 'Approve All Appeals', icon: CheckCircle2, color: 'green', action: async () => {
      const appeals = await db.query('appeals', { status: 'eq.pending' });
      for (const a of appeals) {
        await db.update('appeals', { _row_id: `eq.${a._row_id}` }, { status: 'approved' });
        await db.delete('bans', { username: `eq.${a.banned_username}` });
      }
      toast({ title: 'Approved', description: `${appeals.length} appeals approved` });
    }},
    { id: 37, name: 'Deny All Appeals', icon: XCircle, color: 'red', action: async () => {
      const appeals = await db.query('appeals', { status: 'eq.pending' });
      for (const a of appeals) {
        await db.update('appeals', { _row_id: `eq.${a._row_id}` }, { status: 'denied' });
      }
      toast({ title: 'Denied', description: `${appeals.length} appeals denied` });
    }},
    { id: 38, name: 'Mark Suggestions Read', icon: Eye, color: 'blue', action: async () => {
      const suggestions = await db.query('suggestions', {});
      for (const s of suggestions) {
        await db.update('suggestions', { _row_id: `eq.${s._row_id}` }, { is_read: true });
      }
      toast({ title: 'Marked Read', description: `${suggestions.length} suggestions marked` });
    }},
    { id: 39, name: 'Delete All Files', icon: Trash2, color: 'red', action: async () => {
      const files = await db.query('uploaded_files', {});
      for (const f of files) {
        await db.delete('uploaded_files', { _row_id: `eq.${f._row_id}` });
      }
      toast({ title: 'Deleted', description: `${files.length} file records removed` });
    }},
    { id: 40, name: 'Backup Settings', icon: Settings, color: 'purple', action: () => {
      const settings = {
        adminLoggedIn: localStorage.getItem('isAdmin'),
        timestamp: new Date().toISOString()
      };
      navigator.clipboard.writeText(JSON.stringify(settings));
      toast({ title: 'Backup', description: 'Settings copied to clipboard' });
    }},

    // Moderation Tools (41-50)
    { id: 41, name: 'Slow Mode (5s)', icon: Timer, color: 'yellow', action: async () => {
      const rooms = await db.query('rooms', {});
      for (const room of rooms) {
        await db.update('rooms', { _row_id: `eq.${room._row_id}` }, { slow_mode: 5000 });
      }
      toast({ title: 'Slow Mode', description: '5 second delay enabled' });
    }},
    { id: 42, name: 'Disable Slow Mode', icon: Zap, color: 'green', action: async () => {
      const rooms = await db.query('rooms', {});
      for (const room of rooms) {
        await db.update('rooms', { _row_id: `eq.${room._row_id}` }, { slow_mode: 0 });
      }
      toast({ title: 'Slow Mode Off', description: 'No delay' });
    }},
    { id: 43, name: 'Mute All Rooms', icon: VolumeX, color: 'red', action: async () => {
      const rooms = await db.query('rooms', {});
      for (const room of rooms) {
        await db.update('rooms', { _row_id: `eq.${room._row_id}` }, { muted: true });
      }
      toast({ title: 'Muted', description: 'All rooms muted' });
    }},
    { id: 44, name: 'Unmute All Rooms', icon: Volume2, color: 'green', action: async () => {
      const rooms = await db.query('rooms', {});
      for (const room of rooms) {
        await db.update('rooms', { _row_id: `eq.${room._row_id}` }, { muted: false });
      }
      toast({ title: 'Unmuted', description: 'All rooms unmuted' });
    }},
    { id: 45, name: 'Night Mode', icon: Moon, color: 'indigo', action: () => {
      document.body.classList.add('dark-mode-enhanced');
      toast({ title: 'Night Mode', description: 'Enhanced dark mode enabled' });
    }},
    { id: 46, name: 'Day Mode', icon: Sun, color: 'yellow', action: () => {
      document.body.classList.remove('dark-mode-enhanced');
      toast({ title: 'Day Mode', description: 'Normal mode' });
    }},
    { id: 47, name: 'Emergency Lockdown', icon: Shield, color: 'red', action: async () => {
      const rooms = await db.query('rooms', {});
      for (const room of rooms) {
        await db.update('rooms', { _row_id: `eq.${room._row_id}` }, { locked: true, muted: true });
      }
      toast({ title: '🚨 LOCKDOWN', description: 'All rooms locked and muted', variant: 'destructive' });
    }},
    { id: 48, name: 'Lift Lockdown', icon: Unlock, color: 'green', action: async () => {
      const rooms = await db.query('rooms', {});
      for (const room of rooms) {
        await db.update('rooms', { _row_id: `eq.${room._row_id}` }, { locked: false, muted: false });
      }
      toast({ title: 'Lockdown Lifted', description: 'All rooms restored' });
    }},
    { id: 49, name: 'Purge Inactive', icon: Flame, color: 'orange', action: async () => {
      const cutoff = Date.now() - 86400000 * 30;
      const users = await db.query('users', { last_active: `lt.${cutoff}` });
      for (const u of users) {
        await db.delete('users', { _row_id: `eq.${u._row_id}` });
      }
      toast({ title: 'Purged', description: `${users.length} inactive users removed` });
    }},
    { id: 50, name: 'Cool Down Mode', icon: Snowflake, color: 'cyan', action: async () => {
      const threats = await db.query('threat_levels', { threat_score: 'gte.50' });
      for (const t of threats) {
        await db.update('threat_levels', { _row_id: `eq.${t._row_id}` }, { 
          threat_score: Math.floor(t.threat_score * 0.5) 
        });
      }
      toast({ title: 'Cool Down', description: `${threats.length} threat scores reduced by 50%` });
    }},
    
    // Special Actions (51+)
    { id: 51, name: '💥 CRASH ALL', icon: Bomb, color: 'red', action: async () => {
      // Set crash flag in database that all clients will check
      try {
        await db.insert('system_commands', {
          command: 'crash_all',
          created_at: Date.now(),
          expires_at: Date.now() + 10000, // 10 second crash
        });
      } catch {
        // Table might not exist, create a localStorage flag instead
        localStorage.setItem('admin_crash_command', JSON.stringify({
          active: true,
          timestamp: Date.now(),
          duration: 10000
        }));
      }
      
      // Broadcast crash command via multiple channels
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('admin_commands');
        channel.postMessage({ type: 'CRASH_ALL', duration: 10000 });
      }
      
      // Also store in sessionStorage for page refreshes
      sessionStorage.setItem('crash_broadcast', 'true');
      
      toast({ 
        title: '💥 CRASH INITIATED', 
        description: 'All users will be crashed for 10 seconds',
        variant: 'destructive'
      });
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
      indigo: 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border-indigo-500/30',
      gray: 'bg-gray-500/20 text-gray-300 hover:bg-gray-500/30 border-gray-500/30',
    };
    return colors[color] || colors.gray;
  };

  const filteredActions = searchQuery 
    ? quickActions.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : quickActions;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border-blue-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-300">Users</p>
                <p className="text-xl font-bold text-white">{stats.totalUsers}</p>
              </div>
              <Users className="w-5 h-5 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-green-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-300">Active</p>
                <p className="text-xl font-bold text-white">{stats.activeUsers}</p>
              </div>
              <Activity className="w-5 h-5 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-300">Messages</p>
                <p className="text-xl font-bold text-white">{stats.totalMessages}</p>
              </div>
              <MessageSquare className="w-5 h-5 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-600/20 to-orange-600/20 border-red-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-300">Bans</p>
                <p className="text-xl font-bold text-white">{stats.activeBans}</p>
              </div>
              <Ban className="w-5 h-5 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-yellow-600/20 to-amber-600/20 border-yellow-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-yellow-300">Appeals</p>
                <p className="text-xl font-bold text-white">{stats.pendingAppeals}</p>
              </div>
              <Scale className="w-5 h-5 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-600/20 to-red-600/20 border-orange-500/30">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-300">Threats</p>
                <p className="text-xl font-bold text-white">{stats.threatAlerts}</p>
              </div>
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search quick actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/5 border-white/10"
          />
        </div>
        <Button onClick={loadStats} variant="outline" size="icon">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Quick Actions Grid */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            50 Quick Actions
          </CardTitle>
          <CardDescription>
            One-click admin tools for fast moderation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {filteredActions.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  className={`h-auto py-3 px-3 flex flex-col items-center gap-2 transition-all hover:scale-105 ${getColorClass(action.color)}`}
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await action.action();
                      await loadStats();
                    } catch (error) {
                      toast({ title: 'Error', description: 'Action failed', variant: 'destructive' });
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="text-xs text-center leading-tight">{action.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1">
                    #{action.id}
                  </Badge>
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
