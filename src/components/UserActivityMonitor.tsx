import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Eye, Clock, MessageCircle, FileText, AlertTriangle, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import db from '@/lib/shared/kliv-database.js';

interface UserActivity {
  _row_id: number;
  device_id: string;
  username: string;
  event_type: string;
  event_data: string;
  timestamp: number;
  ip_address: string;
  user_agent: string;
}

const UserActivityMonitor = () => {
  const { toast } = useToast();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadUserActivities();
    // Refresh every 30 seconds for real-time monitoring
    const interval = setInterval(loadUserActivities, 30000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadUserActivities = async () => {
    try {
      let query = 'user_analytics';
      if (filter !== 'all') {
        query = `user_analytics?event_type=eq.${filter}`;
      }
      
      const data = await db.query(query, { 
        order: 'timestamp.desc',
        limit: 100
      });
      
      setActivities(data);
    } catch (error) {
      console.error('Error loading user activities:', error);
      toast({
        title: 'Error',
        description: 'Failed to load user activities',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'login': return <Eye className="w-4 h-4 text-blue-400" />;
      case 'message_sent': return <MessageCircle className="w-4 h-4 text-green-400" />;
      case 'file_uploaded': return <FileText className="w-4 h-4 text-purple-400" />;
      case 'room_joined': return <Users className="w-4 h-4 text-cyan-400" />;
      case 'room_created': return <Shield className="w-4 h-4 text-yellow-400" />;
      case 'warning_triggered': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'login': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'message_sent': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'file_uploaded': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'room_joined': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'room_created': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'warning_triggered': return 'bg-red-500/20 text-red-300 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
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

  const parseEventData = (eventData: string) => {
    try {
      return JSON.parse(eventData);
    } catch {
      return {};
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">Real-time User Activity</h3>
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          <Button
            variant={filter === 'login' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('login')}
          >
            Logins
          </Button>
          <Button
            variant={filter === 'message_sent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('message_sent')}
          >
            Messages
          </Button>
          <Button
            variant={filter === 'file_uploaded' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('file_uploaded')}
          >
            Files
          </Button>
        </div>
      </div>

      {/* Activity Feed */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Live Activity Feed
          </CardTitle>
          <CardDescription>Real-time user actions and events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No recent activity</p>
            ) : (
              activities.map((activity) => (
                <div key={activity._row_id} className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors">
                  {/* Event Icon */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-900/50 flex items-center justify-center">
                    {getEventIcon(activity.event_type)}
                  </div>

                  {/* Activity Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white">{activity.username || 'Anonymous'}</span>
                      <Badge className={getEventColor(activity.event_type)}>
                        {activity.event_type.replace('_', ' ')}
                      </Badge>
                      <span className="text-sm text-gray-400">{formatRelativeTime(activity.timestamp)}</span>
                    </div>
                    
                    <div className="text-sm text-gray-300">
                      {activity.event_type === 'message_sent' && <span>Sent a message</span>}
                      {activity.event_type === 'file_uploaded' && <span>Uploaded a file</span>}
                      {activity.event_type === 'login' && <span>Logged in</span>}
                      {activity.event_type === 'room_joined' && <span>Joined a room</span>}
                      {activity.event_type === 'room_created' && <span>Created a room</span>}
                      {activity.event_type === 'warning_triggered' && <span>Triggered a warning</span>}
                    </div>

                    {activity.ip_address && (
                      <div className="text-xs text-gray-500 mt-1">
                        IP: {activity.ip_address}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <div className="text-right text-xs text-gray-400 hidden sm:block">
                    <div>{formatTimestamp(activity.timestamp).split(',')[1]}</div>
                    <div>{formatTimestamp(activity.timestamp).split(',')[0]}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserActivityMonitor;