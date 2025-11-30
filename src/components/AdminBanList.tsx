import { UserX, AlertTriangle, Clock, MapPin, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Ban {
  _row_id: number;
  username: string;
  device_id: string | null;
  room_id: number | null;
  ip_address?: string | null;
  ban_reason?: string | null;
  message_content?: string | null;
  banned_message?: string | null;
  ban_duration?: number | null;
  _created_at: number;
}

interface AdminBanListProps {
  bans: Ban[];
  onUnban: (banId: number) => void;
}

const AdminBanList = ({ bans, onUnban }: AdminBanListProps) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getBanMessage = (ban: Ban) => {
    return ban.banned_message || ban.message_content || null;
  };

  const getBanReason = (ban: Ban) => {
    return ban.ban_reason || 'Manual ban';
  };

  return (
    <Card className="glass-morphism border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="w-5 h-5 text-red-400" />
          Banned Users ({bans.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bans.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No banned users
          </p>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {bans.map((ban) => {
                const banMessage = getBanMessage(ban);
                const banReason = getBanReason(ban);
                
                return (
                  <div
                    key={ban._row_id}
                    className="p-4 rounded-lg bg-secondary/50 border border-red-500/20 space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                          <UserX className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <span className="font-bold text-lg">{ban.username}</span>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Banned: {formatDate(ban._created_at)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUnban(ban._row_id)}
                        className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                      >
                        Unban
                      </Button>
                    </div>

                    {/* Ban Reason */}
                    <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="font-semibold text-red-400">Ban Reason</span>
                      </div>
                      <p className="text-sm text-red-200">{banReason}</p>
                    </div>

                    {/* Message that got them banned */}
                    {banMessage && (
                      <div className="bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-yellow-400" />
                          <span className="font-semibold text-yellow-400">Message that caused ban</span>
                        </div>
                        <p className="text-sm text-yellow-200 italic">"{banMessage}"</p>
                      </div>
                    )}

                    {/* Additional Info */}
                    <div className="flex flex-wrap gap-2">
                      {ban.device_id && (
                        <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                          🔐 Device: {ban.device_id.substring(0, 15)}...
                        </Badge>
                      )}
                      {ban.ip_address && (
                        <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-300">
                          <MapPin className="w-3 h-3 mr-1" />
                          IP: {ban.ip_address}
                        </Badge>
                      )}
                      {ban.room_id && (
                        <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-300">
                          Room: {ban.room_id}
                        </Badge>
                      )}
                      {ban.ban_duration && ban.ban_duration > 0 && (
                        <Badge variant="outline" className="text-xs border-orange-500/30 text-orange-300">
                          <Clock className="w-3 h-3 mr-1" />
                          Duration: {Math.round(ban.ban_duration / 3600)}h
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminBanList;
