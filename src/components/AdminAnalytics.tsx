import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, MessageSquare, Activity, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import db from '@/lib/shared/kliv-database.js';

const AdminAnalytics = () => {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState({
    dailyStats: [],
    userGrowth: [],
    messageStats: [],
    roomActivity: [],
    fileTypeStats: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // Get daily users, messages, and files for last 30 days
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const [users, messages, files, rooms] = await Promise.all([
        db.query('users', { last_active: `gte.${thirtyDaysAgo}` }),
        db.query('messages', { _created_at: `gte.${thirtyDaysAgo}` }),
        db.query('uploaded_files', { timestamp: `gte.${thirtyDaysAgo}` }),
        db.query('rooms', {})
      ]);

      // Process daily statistics
      const dailyStats = processDailyStats(users, messages, files);
      const userGrowth = processUserGrowth(users);
      const messageStats = processMessageStats(messages);
      const roomActivity = processRoomActivity(rooms, messages);
      const fileTypeStats = processFileTypeStats(files);

      setAnalytics({
        dailyStats,
        userGrowth,
        messageStats,
        roomActivity,
        fileTypeStats
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const processDailyStats = (users: unknown[], messages: unknown[], files: unknown[]) => {
    const dailyData: Record<string, Record<string, number>> = {};
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyData[dateKey] = { date: dateKey, users: 0, messages: 0, files: 0 };
    }

    // Count users by day
    users.forEach(user => {
      const date = new Date(user.last_active).toISOString().split('T')[0];
      if (dailyData[date]) {
        dailyData[date].users++;
      }
    });

    // Count messages by day
    messages.forEach(message => {
      const date = new Date(message._created_at).toISOString().split('T')[0];
      if (dailyData[date]) {
        dailyData[date].messages++;
      }
    });

    // Count files by day
    files.forEach(file => {
      const date = new Date(file.timestamp).toISOString().split('T')[0];
      if (dailyData[date]) {
        dailyData[date].files++;
      }
    });

    return Object.values(dailyData);
  };

  const processUserGrowth = (users: any[]) => {
    const growth = users.reduce((acc: Record<string, number>, user: any) => {
      const date = new Date(user.first_seen).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(growth).map(([date, count]) => ({
      date,
      users: count
    })).slice(-30); // Last 30 days
  };

  const processMessageStats = (messages: any[]) => {
    const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({
      hour: `${hour}:00`,
      messages: 0
    }));

    messages.forEach(message => {
      const hour = new Date(message._created_at).getHours();
      hourlyStats[hour].messages++;
    });

    return hourlyStats;
  };

  const processRoomActivity = (rooms: any[], messages: any[]) => {
    return rooms.map(room => {
      const roomMessages = messages.filter(msg => msg.room_id === room._row_id);
      return {
        name: room.name,
        messages: roomMessages.length,
        type: room.type
      };
    }).sort((a, b) => b.messages - a.messages);
  };

  const processFileTypeStats = (files: any[]) => {
    const typeStats: Record<string, number> = {};
    
    files.forEach(file => {
      const category = getFileCategory(file.file_type);
      typeStats[category] = (typeStats[category] || 0) + 1;
    });

    const COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'];
    
    return Object.entries(typeStats).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      percentage: Math.round((value / files.length) * 100)
    }));
  };

  const getFileCategory = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'documents';
    if (mimeType.includes('text')) return 'text';
    return 'other';
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
        <h3 className="text-xl font-semibold text-white">Analytics Dashboard</h3>
        <Button onClick={loadAnalyticsData} variant="outline">
          <TrendingUp className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      {/* Daily Activity Chart */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            Daily Activity (Last 7 Days)
          </CardTitle>
          <CardDescription>Users, messages, and files uploaded per day</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Line type="monotone" dataKey="users" stroke="#8b5cf6" strokeWidth={2} />
              <Line type="monotone" dataKey="messages" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="files" stroke="#f59e0b" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* User Growth and Message Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-morphism border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              User Growth (30 Days)
            </CardTitle>
            <CardDescription>New users registered over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="users" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-400" />
              Message Activity by Hour
            </CardTitle>
            <CardDescription>Message volume throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.messageStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="messages" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Room Activity and File Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-morphism border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Room Activity
            </CardTitle>
            <CardDescription>Most active chat rooms</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.roomActivity.slice(0, 5).map((room: any, index: number) => (
                <div key={room.name} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                    <div>
                      <p className="font-medium text-white">{room.name}</p>
                      <p className="text-sm text-gray-400">{room.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-purple-400">{room.messages}</p>
                    <p className="text-xs text-gray-400">messages</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="w-5 h-5 text-orange-400" />
              File Type Distribution
            </CardTitle>
            <CardDescription>Types of files uploaded</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analytics.fileTypeStats}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                >
                  {analytics.fileTypeStats.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={['#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b'][index % 5]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;