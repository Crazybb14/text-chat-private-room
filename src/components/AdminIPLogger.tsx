import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MapPin, Clock, User, MessageSquare, Search, 
  RefreshCw, Ban, Smartphone, Globe
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import db from '@/lib/shared/kliv-database.js';

interface IPLog {
  _row_id: number;
  device_id: string;
  username: string | null;
  ip_address: string | null;
  user_agent: string | null;
  action: string | null;
  room_id: number | null;
  message_preview: string | null;
  _created_at: number;
}

const AdminIPLogger = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<IPLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'today' | 'hour'>('all');

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadLogs = async () => {
    try {
      const query: Record<string, string> = { order: '_created_at.desc' };
      
      if (filter === 'today') {
        const today = Math.floor(Date.now() / 1000) - 86400;
        query._created_at = `gte.${today}`;
      } else if (filter === 'hour') {
        const hourAgo = Math.floor(Date.now() / 1000) - 3600;
        query._created_at = `gte.${hourAgo}`;
      }
      
      const data = await db.query('ip_activity_logs', query);
      setLogs(data);
    } catch (error) {
      console.error('Error loading IP logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const banByIP = async (ip: string, username: string) => {
    try {
      // Find device IDs with this IP
      const logsWithIP = logs.filter(l => l.ip_address === ip);
      
      for (const log of logsWithIP) {
        await db.insert('bans', {
          username: log.username || 'Unknown',
          device_id: log.device_id,
          ip_address: ip,
          ban_reason: `Banned by IP: ${ip}`,
        });
      }
      
      toast({ title: '🚫 IP Banned', description: `Banned all users from IP ${ip}` });
      loadLogs();
    } catch (error) {
      console.error('Error banning IP:', error);
      toast({ title: 'Error', description: 'Failed to ban IP', variant: 'destructive' });
    }
  };

  const banDevice = async (deviceId: string, username: string) => {
    try {
      await db.insert('bans', {
        username: username || 'Unknown',
        device_id: deviceId,
        ban_reason: `Banned by device ID`,
      });
      
      toast({ title: '🔐 Device Banned', description: `Device has been banned` });
    } catch (error) {
      console.error('Error banning device:', error);
      toast({ title: 'Error', description: 'Failed to ban device', variant: 'destructive' });
    }
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (log.username?.toLowerCase().includes(search)) ||
      (log.ip_address?.includes(search)) ||
      (log.device_id?.toLowerCase().includes(search)) ||
      (log.message_preview?.toLowerCase().includes(search))
    );
  });

  // Group logs by IP
  const ipCounts: Record<string, number> = {};
  logs.forEach(log => {
    if (log.ip_address) {
      ipCounts[log.ip_address] = (ipCounts[log.ip_address] || 0) + 1;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20">
            <MapPin className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">IP Activity Logger</h2>
            <p className="text-sm text-muted-foreground">Track user locations and activity</p>
          </div>
        </div>
        <Button onClick={loadLogs} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-morphism border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              <span className="text-2xl font-bold">{Object.keys(ipCounts).length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Unique IPs</p>
          </CardContent>
        </Card>
        <Card className="glass-morphism border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-purple-400" />
              <span className="text-2xl font-bold">{new Set(logs.map(l => l.device_id)).size}</span>
            </div>
            <p className="text-xs text-muted-foreground">Devices</p>
          </CardContent>
        </Card>
        <Card className="glass-morphism border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-green-400" />
              <span className="text-2xl font-bold">{new Set(logs.filter(l => l.username).map(l => l.username)).size}</span>
            </div>
            <p className="text-xs text-muted-foreground">Users</p>
          </CardContent>
        </Card>
        <Card className="glass-morphism border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-yellow-400" />
              <span className="text-2xl font-bold">{logs.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total Logs</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by username, IP, or device..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          {(['all', 'today', 'hour'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={filter === f ? 'bg-cyan-600' : ''}
            >
              {f === 'all' ? 'All Time' : f === 'today' ? 'Today' : 'Last Hour'}
            </Button>
          ))}
        </div>
      </div>

      {/* Logs List */}
      <ScrollArea className="h-[400px]">
        {filteredLogs.length === 0 ? (
          <Card className="glass-morphism border-white/10">
            <CardContent className="p-8 text-center">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No activity logs yet</h3>
              <p className="text-muted-foreground">User activity will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <Card key={log._row_id} className="glass-morphism border-white/10 hover:border-cyan-500/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-purple-500/20 text-purple-300">
                          <User className="w-3 h-3 mr-1" />
                          {log.username || 'Anonymous'}
                        </Badge>
                        {log.ip_address && (
                          <Badge className="bg-cyan-500/20 text-cyan-300">
                            <MapPin className="w-3 h-3 mr-1" />
                            {log.ip_address}
                          </Badge>
                        )}
                        {log.action && (
                          <Badge className="bg-green-500/20 text-green-300">
                            {log.action}
                          </Badge>
                        )}
                      </div>
                      
                      {log.message_preview && (
                        <p className="text-sm text-muted-foreground truncate">
                          "{log.message_preview}"
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(log._created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Smartphone className="w-3 h-3" />
                          {log.device_id.substring(0, 12)}...
                        </span>
                        {log.room_id && (
                          <span>Room #{log.room_id}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      {log.ip_address && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => banByIP(log.ip_address!, log.username || 'Unknown')}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          title="Ban IP"
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => banDevice(log.device_id, log.username || 'Unknown')}
                        className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                        title="Ban Device"
                      >
                        <Smartphone className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default AdminIPLogger;
