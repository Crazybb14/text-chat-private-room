import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessagesSquare, RefreshCw, Search, Trash2 } from "lucide-react";
import db from "@/lib/shared/kliv-database.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { filterConversations, groupDirectMessages, type DmConversation } from "@/lib/dmConversations";
import type { DirectMessageRow } from "@/lib/friends";
import { usernameHue } from "@/components/MessageBubble";

const fmtTime = (value: number) =>
  value
    ? new Date(value * (value > 1e11 ? 1 : 1000)).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "unknown";

/**
 * Every direct message on the site, organized as one folder per conversation.
 */
const AdminDirectMessages = () => {
  const [rows, setRows] = useState<DirectMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const fetched = await db.query<DirectMessageRow>("direct_messages", {
        order: "_created_at.desc",
        limit: "3000",
      });
      setRows(fetched);
    } catch {
      // best-effort — panel shows its own error state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const conversations = useMemo(() => groupDirectMessages(rows), [rows]);
  const visible = useMemo(() => filterConversations(conversations, search), [conversations, search]);

  // Keep a valid selection when the list changes
  const selected: DmConversation | null =
    visible.find((c) => c.key === selectedKey) ?? visible[0] ?? null;

  const handleDelete = async (row: DirectMessageRow) => {
    await db.deleteOne("direct_messages", { _row_id: `eq.${row._row_id}` });
    load();
  };

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="py-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Every private conversation between members, one folder per pair of people. Auto-refreshes
            every 15 seconds.
          </p>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by username or message text…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No direct messages have been sent yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px,1fr]">
          <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
            {visible.map((conversation) => {
              const active = selected?.key === conversation.key;
              const last = conversation.messages[conversation.messages.length - 1];
              return (
                <button
                  key={conversation.key}
                  type="button"
                  onClick={() => setSelectedKey(conversation.key)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-white/5 bg-card hover:border-primary/30"
                  }`}
                >
                  <p className="text-sm font-semibold truncate">
                    {conversation.a} <span className="text-muted-foreground">↔</span> {conversation.b}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {last ? `${last.sender_username}: ${last.content}` : "No messages"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {conversation.count} message{conversation.count === 1 ? "" : "s"} ·{" "}
                    {fmtTime(conversation.lastAt)}
                  </p>
                </button>
              );
            })}
            {visible.length === 0 && (
              <p className="text-sm text-muted-foreground">No conversations match that search.</p>
            )}
          </div>

          <Card className="self-start">
            <CardContent className="py-4">
              {selected ? (
                <>
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                    <p className="font-semibold flex items-center gap-2">
                      <MessagesSquare className="w-4 h-4 text-primary" />
                      {selected.a} ↔ {selected.b}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{selected.count} messages</Badge>
                      <Button variant="outline" size="sm" onClick={load}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {selected.messages.map((message) => {
                      const isA = message.sender_username === selected.a || message.recipient_username === selected.a;
                      const hue = usernameHue(message.sender_username);
                      return (
                        <div
                          key={message._row_id}
                          className={`flex items-start gap-2 ${isA ? "" : "flex-row-reverse"}`}
                        >
                          <div
                            className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                              isA
                                ? "bg-secondary text-secondary-foreground rounded-bl-md"
                                : "bg-primary/15 text-foreground rounded-br-md"
                            }`}
                          >
                            <p className="text-xs font-semibold" style={{ color: `hsl(${hue} 65% 65%)` }}>
                              {message.sender_username}
                              <span className="text-muted-foreground font-normal"> → {message.recipient_username}</span>
                            </p>
                            <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {fmtTime(message._created_at)} · {Number(message.is_read) === 1 ? "read" : "unread"}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            aria-label={`Delete message from ${message.sender_username}`}
                            onClick={() => handleDelete(message)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Pick a conversation to read it.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default AdminDirectMessages;
