import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Ban {
  _row_id: number;
  username: string;
  device_id: string | null;
  room_id: number | null;
  _created_at: number;
}

interface AdminBanListProps {
  bans: Ban[];
  onUnban: (banId: number) => void;
}

const AdminBanList = ({ bans, onUnban }: AdminBanListProps) => {
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
          <div className="space-y-2">
            {bans.map((ban) => {
              const bannedDate = new Date(ban._created_at * 1000).toLocaleDateString();
              
              return (
                <div
                  key={ban._row_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div>
                    <span className="font-medium">{ban.username}</span>
                    <span className="text-xs text-muted-foreground ml-3">
                      Banned on {bannedDate}
                    </span>
                    {ban.device_id && (
                      <span className="block text-xs text-red-400 mt-1">
                        Device ID: {ban.device_id.substring(0, 20)}...
                      </span>
                    )}
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
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminBanList;
