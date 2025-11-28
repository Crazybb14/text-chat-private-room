import { Users, Lock, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Room {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
  _created_at: number;
}

interface AdminRoomCardProps {
  room: Room;
  isSelected: boolean;
  onView: () => void;
  onDelete: () => void;
}

const AdminRoomCard = ({ room, isSelected, onView, onDelete }: AdminRoomCardProps) => {
  const isPrivate = room.type === "private";
  const isPublic = room.type === "public";
  const createdDate = new Date(room._created_at * 1000).toLocaleDateString();

  return (
    <Card
      className={`glass-morphism border-white/10 transition-all ${
        isSelected ? "border-purple-500/50 bg-purple-500/10" : "hover:border-white/20"
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                isPrivate ? "bg-purple-500/20" : "bg-green-500/20"
              }`}
            >
              {isPrivate ? (
                <Lock className="w-4 h-4 text-purple-400" />
              ) : (
                <Users className="w-4 h-4 text-green-400" />
              )}
            </div>
            <div>
              <h3 className="font-medium">{room.name}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{isPrivate ? "Private" : "Public"}</span>
                {room.code && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-purple-400">{room.code}</span>
                  </>
                )}
                <span>•</span>
                <span>{createdDate}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onView}
              className="text-muted-foreground hover:text-foreground"
            >
              <Eye className="w-4 h-4" />
            </Button>
            {!isPublic && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="text-muted-foreground hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminRoomCard;
