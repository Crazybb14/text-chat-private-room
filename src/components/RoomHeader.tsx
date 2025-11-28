import { ArrowLeft, Copy, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Room {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
}

interface RoomHeaderProps {
  room: Room;
  onCopyCode: () => void;
  onBack: () => void;
}

const RoomHeader = ({ room, onCopyCode, onBack }: RoomHeaderProps) => {
  const isPrivate = room.type === "private";

  return (
    <header className="border-b border-white/10 p-4 relative z-10 bg-background/80 backdrop-blur-lg">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
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
              <h1 className="font-semibold">{room.name}</h1>
              <p className="text-xs text-muted-foreground">
                {isPrivate ? "Private Room" : "Public Room"}
              </p>
            </div>
          </div>
        </div>

        {isPrivate && room.code && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCopyCode}
            className="border-purple-500/30 hover:bg-purple-500/10"
          >
            <Copy className="w-4 h-4 mr-2" />
            {room.code}
          </Button>
        )}
      </div>
    </header>
  );
};

export default RoomHeader;
