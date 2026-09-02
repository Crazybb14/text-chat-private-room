import { useState } from "react";
import { Eraser, Loader2, Mic, MicOff, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { useAdminData } from "./useAdminData";

interface RoomEditRow {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
  is_voice: number | null;
  [key: string]: unknown;
}

interface StatMessage {
  room_id: number;
  _created_at: number;
  [key: string]: unknown;
}

const generateRoomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

/** Rename rooms, flip voice on/off, and regenerate private room codes. */
const AdminRoomEditor = () => {
  const { toast } = useToast();
  const { data, loading, error, refresh } = useAdminData(
    () => db.query<RoomEditRow>("rooms", { order: "_row_id.asc" }),
    30000,
  );
  const [names, setNames] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const rooms = data ?? [];

  const nameFor = (room: RoomEditRow) => names[room._row_id] ?? room.name;

  const handleRename = async (room: RoomEditRow) => {
    const name = nameFor(room).trim();
    if (!name || name === room.name) return;
    setBusyId(room._row_id);
    try {
      await db.updateOne("rooms", { _row_id: `eq.${room._row_id}` }, { name: name.slice(0, 60) });
      toast({ title: "Room renamed" });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleVoice = async (room: RoomEditRow) => {
    setBusyId(room._row_id);
    try {
      const isVoice = Number(room.is_voice) === 1 ? 0 : 1;
      await db.updateOne("rooms", { _row_id: `eq.${room._row_id}` }, { is_voice: isVoice });
      toast({ title: isVoice ? "Voice room enabled" : "Voice room turned off" });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleRegenCode = async (room: RoomEditRow) => {
    setBusyId(room._row_id);
    try {
      const code = generateRoomCode();
      await db.updateOne("rooms", { _row_id: `eq.${room._row_id}` }, { code });
      toast({ title: "New room code", description: code });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Edit rooms</CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && rooms.length === 0 && (
          <p className="text-sm text-muted-foreground">No rooms yet.</p>
        )}
        {rooms.map((room) => (
          <div key={room._row_id} className="rounded-lg border border-white/10 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Name for ${room.name}`}
                value={nameFor(room)}
                maxLength={60}
                onChange={(e) => setNames((prev) => ({ ...prev, [room._row_id]: e.target.value }))}
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={busyId === room._row_id || !nameFor(room).trim() || nameFor(room) === room.name}
                onClick={() => handleRename(room)}
              >
                <Save className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <Badge variant={room.type === "private" ? "secondary" : "outline"}>
                {room.type === "private" ? `private · ${room.code ?? "no code"}` : "public"}
              </Badge>
              <Button variant="outline" size="sm" disabled={busyId === room._row_id} onClick={() => handleToggleVoice(room)}>
                {Number(room.is_voice) === 1 ? <MicOff className="w-4 h-4 mr-1" /> : <Mic className="w-4 h-4 mr-1" />}
                {Number(room.is_voice) === 1 ? "Voice on" : "Voice off"}
              </Button>
              {room.type === "private" && (
                <Button variant="outline" size="sm" disabled={busyId === room._row_id} onClick={() => handleRegenCode(room)}>
                  New code
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

/** Find rooms nobody uses anymore and delete them in one sweep. */
const AdminEmptyRooms = () => {
  const { toast } = useToast();
  const { data, loading, error, refresh } = useAdminData(async () => {
    const [rooms, messages] = await Promise.all([
      db.query<RoomEditRow>("rooms", { order: "_row_id.asc" }),
      db.query<StatMessage>("messages", { order: "_created_at.desc", limit: "2000" }),
    ]);
    return { rooms, messages };
  }, 30000);
  const [busyId, setBusyId] = useState<number | null>(null);

  const rooms = data?.rooms ?? [];
  const messages = data?.messages ?? [];
  const counts = new Map<number, number>();
  for (const message of messages) {
    const id = Number(message.room_id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const emptyRooms = rooms
    .filter((room) => (counts.get(room._row_id) ?? 0) === 0)
    .map((room) => ({ ...room, recent: messages.some((m) => m.room_id === room._row_id) }));

  const handleDelete = async (room: RoomEditRow) => {
    if (!window.confirm(`Delete "${room.name}"? This can't be undone.`)) return;
    setBusyId(room._row_id);
    try {
      await db.delete("messages", { room_id: `eq.${room._row_id}` });
      await db.delete("rooms", { _row_id: `eq.${room._row_id}` });
      toast({ title: `Deleted "${room.name}"` });
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eraser className="w-4 h-4 text-primary" /> Empty rooms
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Rooms with zero messages in recent history. Deleting also clears anything left in them.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && emptyRooms.length === 0 && (
          <p className="text-sm text-muted-foreground">Every room has activity — nothing to clean.</p>
        )}
        {emptyRooms.map((room) => (
          <div key={room._row_id} className="rounded-lg border border-white/10 p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{room.name}</p>
              <p className="text-xs text-muted-foreground">
                {room.type === "private" ? "private" : "public"} · no messages
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-destructive border-destructive/40"
              disabled={busyId === room._row_id}
              onClick={() => handleDelete(room)}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export { AdminRoomEditor, AdminEmptyRooms };
