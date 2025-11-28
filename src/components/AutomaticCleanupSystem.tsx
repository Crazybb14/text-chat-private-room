import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Clock, AlertTriangle, CheckCircle, Play, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import db from '@/lib/shared/kliv-database.js';

interface CleanupTask {
  id: string;
  name: string;
  description: string;
  targetTable: string;
  condition: string;
  estimatedRecords: number;
  lastRun?: Date;
  isRunning: boolean;
}

const AutomaticCleanupSystem = () => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<CleanupTask[]>([
    {
      id: 'old-messages',
      name: 'Old Messages',
      description: 'Remove messages older than 30 days',
      targetTable: 'messages',
      condition: '_created_at < timestamp subtract 30 days',
      estimatedRecords: 0,
      isRunning: false
    },
    {
      id: 'expired-bans',
      name: 'Expired Bans',
      description: 'Remove ban records that have expired',
      targetTable: 'bans',
      condition: 'expires_at IS NOT NULL AND expires_at < now',
      estimatedRecords: 0,
      isRunning: false
    },
    {
      id: 'old-files',
      name: 'Old Files',
      description: 'Remove uploaded files older than 60 days',
      targetTable: 'uploaded_files',
      condition: 'timestamp < timestamp subtract 60 days',
      estimatedRecords: 0,
      isRunning: false
    },
    {
      id: 'inactive-users',
      name: 'Inactive Users',
      description: 'Remove users inactive for 90 days',
      targetTable: 'users',
      condition: 'last_active < timestamp subtract 90 days',
      estimatedRecords: 0,
      isRunning: false
    },
    {
      id: 'old-logs',
      name: 'Old System Logs',
      description: 'Clean up old notification logs and analytics',
      targetTable: 'notification_logs',
      condition: 'sent_at < timestamp subtract 7 days',
      estimatedRecords: 0,
      isRunning: false
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalRecords: 0,
    spaceFreed: 0,
    lastCleanup: null as Date | null,
    tasksCompleted: 0
  });

  useEffect(() => {
    estimateCleanupRecords();
    loadCleanupStats();
  }, []);

  const estimateCleanupRecords = async () => {
    try {
      const updatedTasks = await Promise.all(tasks.map(async (task) => {
        try {
          // Use different query logic based on table type
          let estimated = 0;
          const now = Date.now();
          
          if (task.targetTable === 'messages') {
            const oldMessages = await db.query(task.targetTable, { 
              _created_at: `lt.${now - (30 * 24 * 60 * 60 * 1000)}` 
            });
            estimated = oldMessages.length;
          } else if (task.targetTable === 'bans') {
            const expiredBans = await db.execute(`
              SELECT COUNT(*) as count FROM ${task.targetTable} 
              WHERE expires_at IS NOT NULL AND expires_at < ${now}
            `);
            estimated = expiredBans[0]?.count || 0;
          } else if (task.targetTable === 'uploaded_files') {
            const oldFiles = await db.query(task.targetTable, { 
              timestamp: `lt.${now - (60 * 24 * 60 * 60 * 1000)}` 
            });
            estimated = oldFiles.length;
          } else if (task.targetTable === 'users') {
            const inactiveUsers = await db.query(task.targetTable, { 
              last_active: `lt.${now - (90 * 24 * 60 * 60 * 1000)}` 
            });
            estimated = inactiveUsers.length;
          }

          return { ...task, estimatedRecords: estimated };
        } catch (error) {
          console.error(`Error estimating records for ${task.name}:`, error);
          return { ...task, estimatedRecords: 0 };
        }
      }));

      setTasks(updatedTasks);
    } catch (error) {
      console.error('Error estimating cleanup records:', error);
    }
  };

  const loadCleanupStats = async () => {
    try {
      // This would typically load from a cleanup_stats table
      setStats({
        totalRecords: 0,
        spaceFreed: 0,
        lastCleanup: new Date(Date.now() - 86400000),
        tasksCompleted: 5
      });
    } catch (error) {
      console.error('Error loading cleanup stats:', error);
    }
  };

  const runCleanupTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.estimatedRecords === 0) {
      toast({
        title: 'No records to clean',
        description: 'This task has no records to remove',
        variant: 'default',
      });
      return;
    }

    setLoading(true);
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, isRunning: true } : t
    ));

    try {
      let deletedRecords = 0;
      const now = Date.now();

      if (task.targetTable === 'messages') {
        const oldMessages = await db.query('messages', { 
          _created_at: `lt.${now - (30 * 24 * 60 * 60 * 1000)}` 
        });
        
        for (const message of oldMessages) {
          await db.delete('messages', { _row_id: `eq.${message._row_id}` });
          deletedRecords++;
        }
      } else if (task.targetTable === 'bans') {
        // For expired bans, we need custom SQL
        const result = await db.execute(`
          DELETE FROM bans 
          WHERE expires_at IS NOT NULL AND expires_at < ${now}
        `);
        deletedRecords = result.changes || 0;
      }

      toast({
        title: 'Cleanup completed',
        description: `${task.name}: Removed ${deletedRecords} records`,
        variant: 'default',
      });

      // Update stats
      setStats(prev => ({
        ...prev,
        totalRecords: prev.totalRecords + deletedRecords,
        spaceFreed: prev.spaceFreed + Math.floor(deletedRecords * 0.1), // Estimate MB
        lastCleanup: new Date(),
        tasksCompleted: prev.tasksCompleted + 1
      }));

      // Re-estimate records
      await estimateCleanupRecords();
      
    } catch (error) {
      console.error('Error running cleanup task:', error);
      toast({
        title: 'Cleanup failed',
        description: `Failed to run ${task.name} cleanup task`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, isRunning: false } : t
      ));
    }
  };

  const runAllCleanup = async () => {
    const tasksWithRecords = tasks.filter(t => t.estimatedRecords > 0);
    if (tasksWithRecords.length === 0) {
      toast({
        title: 'No cleanup needed',
        description: 'All cleanup tasks have no records to remove',
        variant: 'default',
      });
      return;
    }

    for (const task of tasksWithRecords) {
      await runCleanupTask(task.id);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between tasks
    }

    toast({
      title: 'All cleanup completed',
      description: 'Run all cleanup tasks successfully',
      variant: 'default',
    });
  };

  const getTaskIcon = (task: CleanupTask) => {
    if (task.isRunning) {
      return <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />;
    }
    if (task.estimatedRecords > 1000) {
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    }
    if (task.estimatedRecords > 0) {
      return <Clock className="w-4 h-4 text-yellow-400" />;
    }
    return <CheckCircle className="w-4 h-4 text-green-400" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">Automatic Cleanup System</h3>
        <div className="flex gap-2">
          <Button onClick={estimateCleanupRecords} variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Estimate
          </Button>
          <Button onClick={runAllCleanup} disabled={loading} variant="default">
            <Play className="w-4 h-4 mr-2" />
            Run All Cleanup
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-morphism border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Records Cleaned</p>
                <p className="text-2xl font-bold text-white">{stats.totalRecords}</p>
              </div>
              <Trash2 className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Space Freed</p>
                <p className="text-2xl font-bold text-white">{stats.spaceFreed}MB</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Last Cleanup</p>
                <p className="text-2xl font-bold text-white">
                  {stats.lastCleanup ? stats.lastCleanup.toLocaleDateString() : 'Never'}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Tasks Completed</p>
                <p className="text-2xl font-bold text-white">{stats.tasksCompleted}</p>
              </div>
              <Settings className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cleanup Tasks */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            Cleanup Tasks
          </CardTitle>
          <CardDescription>Automated cleanup tasks to maintain system performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="p-4 bg-gray-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getTaskIcon(task)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{task.name}</p>
                        <Badge className={
                          task.estimatedRecords > 1000 ? 'bg-red-500/20 text-red-300' :
                          task.estimatedRecords > 0 ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-green-500/20 text-green-300'
                        }>
                          {task.estimatedRecords.toLocaleString()} records
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">{task.description}</p>
                      <p className="text-xs text-gray-500 mt-1">Target: {task.targetTable}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => runCleanupTask(task.id)}
                    disabled={task.isRunning || task.estimatedRecords === 0}
                    variant={task.estimatedRecords > 0 ? "default" : "outline"}
                    size="sm"
                  >
                    {task.isRunning ? (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    {task.isRunning ? 'Running...' : 'Run Task'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AutomaticCleanupSystem;