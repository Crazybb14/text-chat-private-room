import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Users, AlertTriangle, RefreshCw, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import db from '@/lib/shared/kliv-database.js';

interface IPLocation {
  _row_id: number;
  ip_address: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  updated_at: number;
}

const IPLocationTracker = () => {
  const { toast } = useToast();
  const [ locations, setLocations] = useState<IPLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalIPs: 0,
    uniqueCountries: 0,
    recentLocations: 0,
    suspiciousIPs: 0
  });

  useEffect(() => {
    loadIPLocations();
  }, []);

  const loadIPLocations = async () => {
    setLoading(true);
    try {
      const data = await db.query('ip_locations', { 
        order: 'updated_at.desc',
        limit: 100
      });
      
      const ips = await db.query('users', {});
      const uniqueCountryCount = new Set(data.map((loc: IPLocation) => loc.country)).size;
      const recentLocations = data.filter((loc: IPLocation) => 
        loc.updated_at > Date.now() - 86400000
      ).length;

      setLocations(data);
      setStats({
        totalIPs: data.length,
        uniqueCountries: uniqueCountryCount || 0,
        recentLocations,
        suspiciousIPs: 0 // TODO: Implement suspicious IP detection
      });
    } catch (error) {
      console.error('Error loading IP locations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load IP location data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getLocationIcon = (country?: string) => {
    if (!country) return <MapPin className="w-4 h-4 text-gray-400" />;
    return <Globe className="w-4 h-4 text-blue-400" />;
  };

  const getTimeFromUpdate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
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
        <h3 className="text-xl font-semibold text-white">IP Location Tracking</h3>
        <Button onClick={loadIPLocations} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-morphism border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total IPs</p>
                <p className="text-2xl font-bold text-white">{stats.totalIPs}</p>
              </div>
              <MapPin className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Countries</p>
                <p className="text-2xl font-bold text-white">{stats.uniqueCountries}</p>
              </div>
              <Globe className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Recent</p>
                <p className="text-2xl font-bold text-white">{stats.recentLocations}</p>
              </div>
              <Users className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-morphism border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Suspicious</p>
                <p className="text-2xl font-bold text-white">{stats.suspiciousIPs}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* IP Locations List */}
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            IP Location Data
          </CardTitle>
          <CardDescription>Geographic location tracking for connected users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {locations.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No IP location data available</p>
            ) : (
              locations.map((location) => (
                <div key={location._row_id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getLocationIcon(location.country)}
                    <div>
                      <p className="font-medium text-white">{location.ip_address}</p>
                      {(location.city || location.country) && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-gray-300">
                            {location.city && `${location.city}, `}{location.country || 'Unknown'}
                          </span>
                          {location.timezone && (
                            <Badge className="bg-gray-600 text-gray-200 text-xs">
                              {location.timezone}
                            </Badge>
                          )}
                        </div>
                      )}
                      {location.region && (
                        <p className="text-xs text-gray-500">{location.region}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {getTimeFromUpdate(location.updated_at)}
                    </span>
                    {(location.latitude && location.longitude) && (
                      <Badge className="bg-blue-500/20 text-blue-300 text-xs">
                        {location.latitude.toFixed(2)}, {location.longitude.toFixed(2)}
                      </Badge>
                    )}
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

export default IPLocationTracker;