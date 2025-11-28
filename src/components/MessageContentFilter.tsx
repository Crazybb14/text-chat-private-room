import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Ban, Flag, Plus, Trash2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import db from '@/lib/shared/kliv-database.js';

interface FilterRule {
  _row_id: number;
  pattern: string;
  filter_type: 'blocked_word' | 'suspicious_pattern' | 'spam_detection';
  action: 'block' | 'flag' | 'auto_ban';
  created_at: number;
  created_by: string;
  is_active: boolean;
}

const MessageContentFilter = () => {
  const { toast } = useToast();
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFilter, setNewFilter] = useState({
    pattern: '',
    filter_type: 'blocked_word' as const,
    action: 'block' as const
  });

  useEffect(() => {
    loadFilters();
  }, []);

  const loadFilters = async () => {
    try {
      const data = await db.query('message_filters', { 
        is_active: 'eq.true',
        order: 'created_at.desc'
      });
      setFilters(data);
    } catch (error) {
      console.error('Error loading filters:', error);
      toast({
        title: 'Error',
        description: 'Failed to load content filters',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addFilter = async () => {
    if (!newFilter.pattern.trim()) {
      toast({
        title: 'Pattern required',
        description: 'Please enter a pattern to filter',
        variant: 'destructive',
      });
      return;
    }

    try {
      await db.insert('message_filters', {
        pattern: newFilter.pattern,
        filter_type: newFilter.filter_type,
        action: newFilter.action,
        created_at: Date.now(),
        created_by: 'admin',
        is_active: true
      });

      toast({
        title: 'Filter added',
        description: `Content filter "${newFilter.pattern}" has been added`,
      });

      setNewFilter({
        pattern: '',
        filter_type: 'blocked_word',
        action: 'block'
      });

      await loadFilters();
    } catch (error) {
      console.error('Error adding filter:', error);
      toast({
        title: 'Error',
        description: 'Failed to add filter',
        variant: 'destructive',
      });
    }
  };

  const removeFilter = async (id: number) => {
    try {
      await db.update('message_filters', { _row_id: `eq.${id}` }, { is_active: false });

      toast({
        title: 'Filter removed',
        description: 'Content filter has been deactivated',
      });

      await loadFilters();
    } catch (error) {
      console.error('Error removing filter:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove filter',
        variant: 'destructive',
      });
    }
  };

  const getFilterTypeColor = (type: string) => {
    switch (type) {
      case 'blocked_word': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'suspicious_pattern': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'spam_detection': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'block': return 'bg-red-600';
      case 'flag': return 'bg-yellow-600';
      case 'auto_ban': return 'bg-red-800';
      default: return 'bg-gray-600';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'block': return <Ban className="w-4 h-4" />;
      case 'flag': return <Flag className="w-4 h-4" />;
      case 'auto_ban': return <AlertTriangle className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
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
      <h3 className="text-xl font-semibold text-white">Message Content Filters</h3>

      {/* Add New Filter */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-green-400" />
            Add Content Filter
          </CardTitle>
          <CardDescription>Automatically filter messages based on content patterns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="filter-pattern">Pattern</Label>
            <Input
              id="filter-pattern"
              placeholder="Enter word or regex pattern to filter (e.g., swear words, spam patterns)"
              value={newFilter.pattern}
              onChange={(e) => setNewFilter(prev => ({...prev, pattern: e.target.value}))}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="filter-type">Filter Type</Label>
              <select
                id="filter-type"
                value={newFilter.filter_type}
                onChange={(e) => setNewFilter(prev => ({...prev, filter_type: e.target.value as any}))}
                className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white"
              >
                <option value="blocked_word">Blocked Word</option>
                <option value="suspicious_pattern">Suspicious Pattern</option>
                <option value="spam_detection">Spam Detection</option>
              </select>
            </div>
            <div>
              <Label htmlFor="filter-action">Action</Label>
              <select
                id="filter-action"
                value={newFilter.action}
                onChange={(e) => setNewFilter(prev => ({...prev, action: e.target.value as any}))}
                className="w-full p-2 rounded bg-gray-800 border border-gray-700 text-white"
              >
                <option value="block">Block Message</option>
                <option value="flag">Flag for Review</option>
                <option value="auto_ban">Auto Ban User</option>
              </select>
            </div>
          </div>

          <Button 
            onClick={addFilter}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Content Filter
          </Button>
        </CardContent>
      </Card>

      {/* Active Filters */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Active Filters ({filters.length})
          </CardTitle>
          <CardDescription>Manage your content filtering rules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filters.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No active content filters</p>
            ) : (
              filters.map((filter) => (
                <div key={filter._row_id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getActionColor(filter.action)}`}>
                      {getActionIcon(filter.action)}
                    </div>
                    <div>
                      <p className="font-medium text-white">{filter.pattern}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getFilterTypeColor(filter.filter_type)}>
                          {filter.filter_type.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-gray-400">
                          Action: {filter.action.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {new Date(filter.created_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFilter(filter._row_id)}
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
    </div>
  );
};

export default MessageContentFilter;