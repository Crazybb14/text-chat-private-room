import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, MapPin, Filter, RefreshCw, Download, AlertCircle, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface IPActivityLog {
  _row_id: number;
  device_id: string;
  username: string;
  ip_address: string;
  country?: string;
  city?: string;
  action: string;
  room_id?: number;
  message_preview?: string;
  _created_at: number;
}

const EnhancedIPLogger = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<IPActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    username: "",
    action: "all",
    timeframe: "24h"
  });

  const loadLogs = async () => {
    setLoading(true);
    try {
      // Get recent IP activity logs
      const now = Date.now();
      const timeLimit = filter.timeframe === "1h" ? now - 3600000 : 
                       filter.timeframe === "24h" ? now - 86400000 : 
                       filter.timeframe === "7d" ? now - 604800000 : 0;

      let query = {};
      if (timeLimit > 0) {
        query = { _created_at: `gte.${timeLimit}` };
      }
      
      if (filter.username) {
        query = { ...query, username: `like.*${filter.username}*` };
      }

      if (filter.action !== "all") {
        query = { ...query, action: `eq.${filter.action}` };
      }

      const allLogs = await db.query("ip_activity_logs", { 
        ...query,
        order: "_created_at.desc",
        limit: 500
      });

      // Simulate IP geolocation (in real app, this would be actual IP tracking)
      const enrichedLogs = allLogs.map((log: IPActivityLog & { ip_address?: string; country?: string; city?: string }) => {
        const mockIP = generateMockIP(log.device_id);
        return {
          ...log,
          ip_address: mockIP.address,
          country: mockIP.country,
          city: mockIP.city
        };
      });

      setLogs(enrichedLogs);
    } catch (error) {
      console.log("Error loading IP logs:", error);
      toast({
        title: "Error",
        description: "Failed to load IP logs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate mock IP data for device IDs
  const generateMockIP = (deviceId: string) => {
    const hash = deviceId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const ips = [
      { address: "192.168.1.100", country: "United States", city: "New York" },
      { address: "10.0.0.50", country: "United States", city: "Los Angeles" },
      { address: "172.16.0.25", country: "United Kingdom", city: "London" },
      { address: "203.0.113.1", country: "Canada", city: "Toronto" },
      { address: "198.51.100.10", country: "Australia", city: "Sydney" },
      { address: "192.0.2.100", country: "Germany", city: "Berlin" },
      { address: "172.217.16.200", country: "Japan", city: "Tokyo" },
      { address: "142.250.184.150", country: "France", city: "Paris" },
      { address: "157.240.229.35", country: "Brazil", city: "São Paulo" },
      { address: "151.101.65.140", country: "India", city: "Mumbai" }
    ];
    
    return ips[Math.abs(hash) % ips.length];
  };

  const exportLogs = () => {
    const csvContent = [
      ["Device ID", "Username", "IP Address", "Country", "City", "Action", "Room ID", "Message", "Time"],
      ...logs.map(log => [
        log.device_id,
        log.username,
        log.ip_address,
        log.country || "Unknown",
        log.city || "Unknown", 
        log.action,
        log.room_id || "",
        log.message_preview || "",
        new Date(log._created_at * 1000).toLocaleString()
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ip_logs_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "IP logs exported as CSV",
    });
  };

  useEffect(() => {
    loadLogs();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadLogs, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  const actionCounts = logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniqueUsers = new Set(logs.map(log => log.username)).size;
  const uniqueIPs = new Set(logs.map(log => log.ip_address)).size;

  return (
    <Card className="glass-morphism border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-400" />
          Enhanced IP Logger
        </CardTitle>
        <CardDescription>
          Real-time monitoring of user IP addresses and locations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-blue-400">{logs.length}</div>
            <div className="text-xs text-gray-400">Total Logs</div>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-400">{uniqueUsers}</div>
            <div className="text-xs text-gray-400">Unique Users</div>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-purple-400">{uniqueIPs}</div>
            <div className="text-xs text-gray-400">Unique IPs</div>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-orange-400">{Object.keys(actionCounts).length}</div>
            <div className="text-xs text-gray-400">Action Types</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Filter by username..."
            value={filter.username}
            onChange={(e) => setFilter(prev => ({ ...prev, username: e.target.value }))}
            className="flex-1 bg-secondary/50 border-white/10"
          />
          <Select value={filter.action} onValueChange={(value) => setFilter(prev => ({ ...prev, action: value }))}>
            <SelectTrigger className="w-40 bg-secondary/50 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="message">Message</SelectItem>
              <SelectItem value="room_join">Room Join</SelectItem>
              <SelectItem value="banned">Banned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter.timeframe} onValueChange={(value) => setFilter(prev => ({ ...prev, timeframe: value }))}>
            <SelectTrigger className="w-32 bg-secondary/50 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadLogs} disabled={loading} className="bg-secondary/50 border-white/10">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportLogs} className="bg-secondary/50 border-white/10">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Activity Feed */}
        <ScrollArea className="h-96">
          {logs.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No IP activity logs found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log._row_id} className="p-3 bg-secondary/30 rounded-lg border border-white/5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {log.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm flex items-center gap-2">
                          <span>{log.username}</span>
                          <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">
                            {log.action}
                          </Badge>
                        </p>
                        <p className="text-xs text-gray-400 font-mono">
                          IP: {log.ip_address}
                        </p>
                        <p className="text-xs text-gray-500">
                          📍 {log.city}, {log.country}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(log._created_at * 1000).toLocaleTimeString()}
                    </p>
                  </div>
                  {log.message_preview && (
                    <p className="text-sm text-gray-300 mt-2 bg-black/20 rounded p-2">
                      "{log.message_preview}"
                    </p>
                  )}
                  {log.room_id && (
                    <p className="text-xs text-blue-400 mt-1">
                      Room ID: {log.room_id}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="text-xs text-gray-500">
          <AlertCircle className="w-3 h-3 inline mr-1" />
          IP data includes device-based location simulation. Real IP tracking would require backend implementation.
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedIPLogger;