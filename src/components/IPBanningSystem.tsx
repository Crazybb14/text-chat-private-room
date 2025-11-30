import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  GlobeSlash, 
  AlertTriangle, 
  Shield, 
  Ban, 
  Clock, 
  Activity, 
  MapPin, 
  Users, 
  TrendingUp,
  Search,
  Eye,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import db from '@/lib/shared/kliv-database.js';
import enhancedNotifications from '@/lib/enhancedNotifications';

interface IPBan {
  _row_id: number;
  ip_address: string;
  ban_type: 'temporary' | 'permanent';
  ban_reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  target_device_ids: string;
  ban_count: number;
  first_banned_at: number;
  last_banned_at: number;
  expires_at: number | null;
  banned_by: string;
  is_active: boolean;
  metadata: string;
}

interface IPLog {
  _row_id: number;
  ip_address: string;
  device_id: string;
  username: string | null;
  event_type: string;
  event_details: string;
  user_agent: string;
  country: string | null;
  region: string | null;
  city: string | null;
  timestamp: number;
  session_id: string | null;
}

const IPBanningSystem = () => {
  const { toast } = useToast();
  const [ipBans, setIPBans] = useState<IPBan[]>([]);
  const [ipLogs, setIPLogs] = useState<IPLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchIP, setSearchIP] = useState('');
  const [newBan, setNewBan] = useState({
    ip_address: '',
    ban_reason: '',
    ban_type: 'temporary' as const,
    severity: 'medium' as const,
    duration_hours: 24
  });
  const [stats, setStats] = useState({
    totalBans: 0,
    activeBans: 0,
    uniqueIPs: 0,
    criticalBans: 0,
    todayActivity: 0,
    topCountries: 0
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Real-time updates
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bans, logs] = await Promise.all([
        db.query('ip_bans', { order: 'last_banned_at.desc', limit: 100 }),
        db.query('ip_logs', { order: 'timestamp.desc', limit: 50 })
      ]);

      setIPBans(bans);
      setIPLogs(logs);

      // Calculate statistics
      const now = Date.now();
      const activeBans = bans.filter(ban => ban.is_active && (!ban.expires_at || ban.expires_at > now));
      const todayActivity = logs.filter(log => log.timestamp > now - 86400000);
      const uniqueCountries = new Set(logs.map(log => log.country).filter(Boolean)).size;

      setStats({
        totalBans: bans.length,
        activeBans: activeBans.length,
        uniqueIPs: new Set(bans.map(ban => ban.ip_address)).size,
        criticalBans: bans.filter(ban => ban.severity === 'critical').length,
        todayActivity: todayActivity.length,
        topCountries: uniqueCountries
      });
    } catch (error) {
      console.error('Error loading IP ban data:', error);
      toast({
        title: 'Error loading data',
        description: 'Failed to load IP banning data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addIPBan = async () => {
    if (!newBan.ip_address) {
      toast({
        title: 'IP Address required',
        description: 'Please enter an IP address to ban',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const now = Date.now();
      const expiresAt = newBan.ban_type === 'temporary' ? now + (newBan.duration_hours * 3600000) : null;

      await db.insert('ip_bans', {
        ip_address: newBan.ip_address,
        ban_type: newBan.ban_type,
        ban_reason: newBan.ban_reason || 'Administrative action',
        severity: newBan.severity,
        target_device_ids: JSON.stringify([]),
        ban_count: 1,
        first_banned_at: now,
        last_banned_at: now,
        expires_at: expiresAt,
        banned_by: 'admin',
        is_active: true,
        metadata: JSON.stringify({
          created_at: new Date().toISOString(),
          browser_info: navigator.userAgent
        })
      });

      toast({
        title: 'IP Banned Successfully',
        description: `${newBan.ip_address} has been ${newBan.ban_type === 'permanent' ? 'permanently' : `banned for ${newBan.duration_hours} hours`}`,
      });

      // Send admin notification
      await enhancedNotifications.sendAdminAnnouncement(
        'Security Alert',
        `IP Address ${newBan.ip_address} has been ${newBan.ban_type}ly banned for: ${newBan.ban_reason}`,
        newBan.severity === 'critical' ? 'urgent' : 'high'
      );

      setNewBan({
        ip_address: '',
        ban_reason: '',
        ban_type: 'temporary',
        severity: 'medium',
        duration_hours: 24
      });

      await loadData();
    } catch (error) {
      console.error('Error adding IP ban:', error);
      toast({
        title: 'Error',
        description: 'Failed to add IP ban',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const removeIPBan = async (banId: number) => {
    try {
      await db.delete('ip_bans', { _row_id: `eq.${banId}` });

      toast({
        title: 'IP Ban Removed',
        description: 'IP ban has been successfully removed',
      });

      await loadData();
    } catch (error) {
      console.error('Error removing IP ban:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove IP ban',
        variant: 'destructive',
      });
    }
  };

  const bulkIPBan = async () => {
    if (!searchIP.trim()) return;

    try {
      // Find all logs for this IP pattern
      const logs = await db.query('ip_logs', { 
        ip_address: `like.*${searchIP}*`
      });

      if (logs.length === 0) {
        toast({
          title: 'No activity found',
          description: `No activity found for IP pattern: ${searchIP}`,
          variant: 'destructive',
        });
        return;
      }

      const uniqueIPs = [...new Set(logs.map((log: IPLog) => log.ip_address))];
      
      for (const ip of uniqueIPs) {
        await db.insert('ip_bans', {
          ip_address: ip,
          ban_type: 'temporary',
          ban_reason: 'Bulk ban based on suspicious activity',
          severity: 'high',
          target_device_ids: JSON.stringify(logs.filter((log: IPLog) => log.ip_address === ip).map((log: IPLog) => log.device_id)),
          ban_count: 1,
          first_banned_at: Date.now(),
          last_banned_at: Date.now(),
          expires_at: Date.now() + (7 * 24 * 3600000), // 7 days
          banned_by: 'admin',
          is_active: true,
          metadata: JSON.stringify({
            bulk_ban: true,
            triggered_ip: searchIP
          })
        });
      }

      toast({
        title: 'Bulk IP Ban Complete',
        description: `${uniqueIPs.length} IP addresses have been banned`,
        variant: 'default',
      });

      await loadData();
    } catch (error) {
      console.error('Error performing bulk IP ban:', error);
      toast({
        title: 'Error',
        description: 'Failed to perform bulk IP ban',
        variant: 'destructive',
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      critical: 'bg-red-500/20 text-red-300 border-red-500/30'
    };
    return colors[severity as keyof typeof colors] || colors.medium;
  };

  const getEventTypeColor = (eventType: string) => {
    const colors = {
      login_attempt: 'bg-green-500/20 text-green-300',
      message_sent: 'bg-blue-500/20 text-blue-300',
      file_uploaded: 'bg-purple-500/20 text-purple-300',
      banned_attempt: 'bg-red-500/20 text-red-300',
      suspicious_activity: 'bg-orange-500/20 text-orange-300'
    };
    return colors[eventType as keyof typeof colors] || 'bg-gray-500/20 text-gray-300';
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
          IP Banning System
        </h3>
        <div className="flex gap-2">
          <Button onClick={loadData} variant="outline" size="sm">
            <Activity className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="glass-morphism border-white/10 bg-gradient-to-br from-purple-900/50 to-purple-800/30 hover:scale-105 transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-300">Total Bans</p>
                <p className="text-xl font-bold text-white">{stats.totalBans}</p>
              </div>
              <Ban className="w-6 h-6 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10 bg-gradient-to-br from-red-900/50 to-red-800/30 hover:scale-105 transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-300">Active Bans</p>
                <p className="text-xl font-bold text-white">{stats.activeBans}</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10 bg-gradient-to-br from-blue-900/50 to-blue-800/30 hover:scale-105 transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-300">Unique IPs</p>
                <p className="text-xl font-bold text-white">{stats.uniqueIPs}</p>
              </div>
              <GlobeSlash className="w-6 h-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10 bg-gradient-to-br from-orange-900/50 to-orange-800/30 hover:scale-105 transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-300">Critical</p>
                <p className="text-xl font-bold text-white">{stats.criticalBans}</p>
              </div>
              <Shield className="w-6 h-6 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10 bg-gradient-to-br from-green-900/50 to-green-800/30 hover:scale-105 transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-300">Today Activity</p>
                <p className="text-xl font-bold text-white">{stats.todayActivity}</p>
              </div>
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10 bg-gradient-to-br from-cyan-900/50 to-cyan-800/30 hover:scale-105 transition-transform">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-cyan-300">Countries</p>
                <p className="text-xl font-bold text-white">{stats.topCountries}</p>
              </div>
              <MapPin className="w-6 h-6 text-cyan-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add IP Ban Form */}
      <Card className="glass-morphism border-white/10 bg-gradient-to-br from-red-900/30 to-orange-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-300">
            <GlobeSlash className="w-5 h-5" />
            Add IP Ban
          </CardTitle>
          <CardDescription className="text-red-400/80">
            Block IP addresses from accessing the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="ip-address" className="text-red-300">IP Address</Label>
              <Input
                id="ip-address"
                placeholder="192.168.1.1"
                value={newBan.ip_address}
                onChange={(e) => setNewBan(prev => ({...prev, ip_address: e.target.value}))}
                className="bg-red-950/50 border-red-500/30 text-white placeholder-red-400"
              />
            </div>
            
            <div>
              <Label htmlFor="ban-reason" className="text-red-300">Ban Reason</Label>
              <Input
                id="ban-reason"
                placeholder="Security violation"
                value={newBan.ban_reason}
                onChange={(e) => setNewBan(prev => ({...prev, ban_reason: e.target.value}))}
                className="bg-red-950/50 border-red-500/30 text-white placeholder-red-400"
              />
            </div>

            <div>
              <Label htmlFor="ban-type" className="text-red-300">Ban Type</Label>
              <select
                id="ban-type"
                value={newBan.ban_type}
                onChange={(e) => setNewBan(prev => ({...prev, ban_type: e.target.value as 'temporary' | 'permanent'}))}
                className="w-full p-2 rounded bg-red-950/50 border border-red-500/30 text-white"
              >
                <option value="temporary">Temporary</option>
                <option value="permanent">Permanent</option>
              </select>
            </div>

            <div>
              <Label htmlFor="severity" className="text-red-300">Severity</Label>
              <select
                id="severity"
                value={newBan.severity}
                onChange={(e) => setNewBan(prev => ({...prev, severity: e.target.value as 'low' | 'medium' | 'high' | 'critical'}))}
                className="w-full p-2 rounded bg-red-950/50 border border-red-500/30 text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {newBan.ban_type === 'temporary' && (
            <div>
              <Label htmlFor="duration" className="text-red-300">Duration (Hours)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="8760"
                value={newBan.duration_hours}
                onChange={(e) => setNewBan(prev => ({...prev, duration_hours: parseInt(e.target.value) || 24}))}
                className="bg-red-950/50 border-red-500/30 text-white placeholder-red-400"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={addIPBan}
              disabled={loading}
              className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-semibold"
            >
              <Ban className="w-4 h-4 mr-2" />
              Add IP Ban
            </Button>
            
            <Button
              onClick={bulkIPBan}
              disabled={!searchIP || loading}
              variant="outline"
              className="border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
            >
              <Users className="w-4 h-4 mr-2" />
              Bulk Ban Similar IPs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* IP Bans List */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-300">
            <Eye className="w-5 h-5" />
            Active IP Bans ({ipBans.filter(ban => ban.is_active).length})
          </CardTitle>
          <CardDescription className="text-orange-400/80">
            Currently banned IP addresses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ipBans.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No IP bans found</p>
            ) : (
              ipBans.map((ban) => (
                <div key={ban._row_id} className={`
                  p-4 rounded-lg border transition-all hover:scale-[1.02]
                  ${ban.is_active 
                    ? 'bg-red-900/20 border-red-500/30' 
                    : 'bg-gray-800/20 border-gray-600/30 opacity-60'
                  }
                `}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                        <GlobeSlash className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-white">{ban.ip_address}</span>
                          <Badge className={getSeverityColor(ban.severity)}>
                            {ban.severity.toUpperCase()}
                          </Badge>
                          <Badge className={ban.ban_type === 'permanent' ? 'bg-gray-600' : 'bg-yellow-600'}>
                            {ban.ban_type === 'permanent' ? 'PERM' : 'TEMP'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-300">{ban.ban_reason}</p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                          <span>Banned: {formatRelativeTime(ban.last_banned_at)}</span>
                          <span>Count: {ban.ban_count}</span>
                          {ban.expires_at && (
                            <span>Expires: {formatRelativeTime(ban.expires_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => removeIPBan(ban._row_id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* IP Activity Logs */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-cyan-300">
            <Activity className="w-5 h-5" />
            Recent IP Activity ({ipLogs.length})
          </CardTitle>
          <CardDescription className="text-cyan-400/80">
            Real-time IP activity monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ipLogs.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No recent IP activity</p>
            ) : (
              ipLogs.map((log) => (
                <div key={log._row_id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-white">{log.ip_address}</span>
                        <Badge className={getEventTypeColor(log.event_type)}>
                          {log.event_type.replace('_', ' ')}
                        </Badge>
                        {log.username && (
                          <span className="text-sm text-blue-300">@{log.username}</span>
                        )}
                      </div>
                      {log.country && (
                        <p className="text-xs text-gray-400">
                          📍 {log.city}, {log.region}, {log.country}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IPBanningSystem;