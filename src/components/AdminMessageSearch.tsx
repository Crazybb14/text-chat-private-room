import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, Loader2, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import db from "@/lib/shared/kliv-database.js";
import { useToast } from "@/hooks/use-toast";

interface RoomRow {
  _row_id: number;
  name: string;
}

interface MessageRow {
  _row_id: number;
  room_id: number;
  sender_name: string | null;
  content: string | null;
  file_name: string | null;
  _created_at: number;
}

const AdminMessageSearch = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roomRows, messageRows] = await Promise.all([
        db.query<RoomRow>("rooms", { order: "_row_id.asc" }),
        db.query<MessageRow>("messages", { order: "_created_at.desc", limit: "500" }),
      ]);
      setRooms(roomRows);
      setMessages(messageRows);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roomNames = useMemo(() => new Map(rooms.map((r) => [Number(r._row_id), r.name])), [rooms]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return messages
      .filter((m) => (m.content ?? "").toLowerCase().includes(q) || (m.sender_name ?? "").toLowerCase().includes(q))
      .slice(0, 100);
  }, [messages, query]);

  const removeMessage = async (row: MessageRow) => {
    setDeleting(row._row_id);
    try {
      await db.deleteOne("messages", { _row_id: `eq.${row._row_id}` });
      setMessages((prev) => prev.filter((m) => m._row_id !== row._row_id));
      toast({ title: "Message deleted" });
    } catch {
      toast({ title: "Couldn't delete that message", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Search className="h-4 w-4" aria-hidden /> Search every message
          </h3>
          <p className="text-xs text-muted-foreground">
            Search recent room chat by text or username, and remove anything that shouldn't be there.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type at least 2 letters…"
              className="pl-8"
            />
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Refresh"}
          </Button>
        </div>

        {query.trim().length < 2 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Start typing to search the 500 newest messages.</p>
        ) : matches.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No matches in recent messages.</p>
        ) : (
          <div className="divide-y divide-white/5 rounded-lg border border-white/10">
            {matches.map((row) => (
              <div key={row._row_id} className="flex items-start gap-3 px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      #{roomNames.get(Number(row.room_id)) ?? `room ${row.room_id}`}
                    </Badge>
                    <span className="text-sm font-medium">{row.sender_name ?? "unknown"}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden />
                      {new Date((row._created_at || 0) * 1000).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm">
                    {row.content || (row.file_name ? `📎 ${row.file_name}` : "(empty)")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Delete message"
                  className="shrink-0 text-muted-foreground hover:text-rose-400"
                  disabled={deleting === row._row_id}
                  onClick={() => void removeMessage(row)}
                >
                  {deleting === row._row_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminMessageSearch;
