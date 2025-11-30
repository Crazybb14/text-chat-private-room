import React, { useState, useEffect } from "react";
import { AlertTriangle, TrendingUp, Users, Activity, Ban, Warning } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import db from "@/lib/shared/kliv-database.js";

interface ThreatLevel {
  _row_id: number;
  username: string;
  threat_score: number;
  last_activity: number;
  warning_count: number;
  device_fingerprint: string;
}

interface BanPattern {
  _row_id: number;
  pattern_name: string;
  regex_pattern: string;
  ban_reason: string;
  severity_level: number;
  is_active: number;
}

interface AdminThreatMonitorProps {
  onBanUser: (username: string) => void;
}

const AdminThreatMonitor = ({ onBanUser }: AdminThreatMonitorProps) => {
  const [highRiskUsers, setHighRiskUsers] = useState<ThreatLevel[]>([]);
  const [banPatterns, setBanPatterns] = useState<BanPattern[]>([]);
  const [analytics, setAnalytics] = useState({
    totalMessages: 0,
    bannedUsers: 0,
    fileUploads: 0,
    uniqueUsers: 0,
  });

  useEffect(() => {
    loadData();
    // Real-time updates - refresh every 1 second
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [threats, patterns, analyticsData] = await Promise.all([
        db.query("threat_levels", { threat_score: `gte.50`, order: "threat_score.desc", limit: 10 }),
        db.query("ban_patterns", {}),
        db.query("chat_analytics", { 
          date_key: `eq.${new Date().toISOString().split('T')[0]}` 
        }),
      ]);

      setHighRiskUsers(threats);
      setBanPatterns(patterns);
      
      if (analyticsData.length > 0) {
        setAnalytics(analyticsData[0]);
      }
    } catch (error) {
      console.error("Error loading threat data:", error);
    }
  };

  const getThreatLevelColor = (score: number) => {
    if (score >= 100) return "bg-red-500";
    if (score >= 75) return "bg-orange-500";
    if (score >= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getThreatLevelText = (score: number) => {
    if (score >= 100) return "Extreme";
    if (score >= 75) return "High";
    if (score >= 50) return "Medium";
    return "Low";
  };

  const banHighRiskUser = async (username: string) => {
    if (confirm(`Ban ${username}? This will permanently prevent them from accessing the chat.`)) {
      await onBanUser(username);
      loadData(); // Refresh data
    }
  };

  return (
    <div className="space-y-6">
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-morphism border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalMessages}</div>
          </CardContent>
        </Card>
        
        <Card className="glass-morphism border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Banned Users</CardTitle>
            <Ban className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{analytics.bannedUsers}</div>
          </CardContent>
        </Card>
        
        <Card className="glass-morphism border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">File Uploads</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.fileUploads}</div>
          </CardContent>
        </Card>
        
        <Card className="glass-morphism border-white/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.uniqueUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* High Risk Users */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            High Risk Users
          </CardTitle>
          <CardDescription>
            Users with elevated threat scores based on behavior patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          {highRiskUsers.length === 0 ? (
            <p className="text-muted-foreground">No high risk users detected</p>
          ) : (
            <div className="space-y-3">
              {highRiskUsers.map((user) => (
                <div key={user._row_id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${getThreatLevelColor(user.threat_score)}`} />
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-sm text-muted-foreground">
                        Threat Score: {user.threat_score} • Warnings: {user.warning_count}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last Activity: {new Date(user.last_activity).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={user.threat_score >= 75 ? "destructive" : "secondary"}>
                      {getThreatLevelText(user.threat_score)}
                    </Badge>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => banHighRiskUser(user.username)}
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      Ban
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Ban Patterns */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warning className="w-5 h-5 text-yellow-400" />
            Active Detection Patterns
          </CardTitle>
          <CardDescription>
            Automated content filtering patterns and their severity levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {banPatterns
              .filter(p => p.is_active === 1)
              .sort((a, b) => b.severity_level - a.severity_level)
              .map((pattern) => (
                <div key={pattern._row_id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{pattern.pattern_name}</p>
                    <p className="text-xs text-muted-foreground">{pattern.ban_reason}</p>
                  </div>
                  <Badge variant={
                    pattern.severity_level >= 5 ? "destructive" :
                    pattern.severity_level >= 3 ? "secondary" : "outline"
                  }>
                    Level {pattern.severity_level}
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminThreatMonitor;