import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Ban as BanIcon,
  CheckCircle2,
  Download,
  Flag,
  Lightbulb,
  Loader2,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { type UserRow } from "@/lib/userManagement";

interface RoomRow {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
  [key: string]: unknown;
}

interface BanRow {
  _row_id: number;
  username: string;
  device_id: string | null;
  room_id: number | null;
  [key: string]: unknown;
}

interface ReportRow {
  _row_id: number;
  reported_username: string;
  reporter_username: string;
  report_reason: string;
  custom_reason: string | null;
  status: string;
  _created_at: number;
  [key: string]: unknown;
}

interface SuggestionRow {
  _row_id: number;
  content: string;
  username: string;
  _created_at: number;
  [key: string]: unknown;
}

interface MessageRow {
  _row_id: number;
  room_id: number;
  sender_name: string;
  content: string;
  _created_at: number;
  [key: string]: unknown;
}

interface DowntimeRow {
  _row_id: number;
  start_time: number;
  end_time: number;
  reason: string | null;
  is_active: number;
  [key: string]: unknown;
}

const WEBSITE_SNAPSHOT_DATE = "August 31, 2026";

const generateRoomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const fmtTime = (value: number) =>
  value
    ? new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "unknown";

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [downtimes, setDowntimes] = useState<DowntimeRow[]>([]);
  const [messageRoom, setMessageRoom] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("public");
  const [banInput, setBanInput] = useState("");
  const [downtimeHours, setDowntimeHours] = useState("2");
  const [downtimeReason, setDowntimeReason] = useState("");

  useEffect(() => {
    setAuthorized(localStorage.getItem("isAdmin") === "true");
  }, []);

  useEffect(() => {
    if (authorized === false) {
      navigate("/admin");
    }
  }, [authorized, navigate]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [roomRows, userRows, banRows, reportRows, suggestionRows, downtimeRows] = await Promise.all([
        db.query<RoomRow>("rooms", { order: "_row_id.asc" }),
        db.query<UserRow>("users", { order: "last_active.desc" }),
        db.query<BanRow>("bans", { order: "_created_at.desc" }),
        db.query<ReportRow>("user_reports", { order: "_created_at.desc" }),
        db.query<SuggestionRow>("suggestions", { order: "_created_at.desc" }),
        db.query<DowntimeRow>("downtime_schedules", { order: "start_time.desc" }),
      ]);
      setRooms(roomRows);
      setUsers(userRows);
      setBans(banRows);
      setReports(reportRows);
      setSuggestions(suggestionRows);
      setDowntimes(downtimeRows);
    } catch (error) {
      console.error("Admin load failed:", error);
      toast({ title: "Couldn't load admin data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authorized) {
      loadAll();
    }
  }, [authorized, loadAll]);

  const loadMessages = useCallback(async () => {
    try {
      const rows = await db.query<MessageRow>("messages", { order: "_created_at.desc" });
      setMessages(rows.slice(0, 100));
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, []);

  useEffect(() => {
    if (authorized) {
      loadMessages();
    }
  }, [authorized, loadMessages]);

  const roomName = (id: number) => rooms.find((r) => r._row_id === id)?.name ?? `Room #${id}`;
  const bannedUsernames = new Set(bans.map((b) => b.username));

  const handleCreateRoom = async () => {
    const name = newRoomName.trim();
    if (!name) return;
    const type = newRoomType === "private" ? "private" : "public";
    const code = type === "private" ? generateRoomCode() : null;
    await db.insert("rooms", { name, code, type });
    toast({
      title: "Room created",
      description: type === "private" ? `Private room code: ${code}` : undefined,
    });
    setNewRoomName("");
    setNewRoomType("public");
    loadAll();
  };

  const handleDeleteRoom = async (room: RoomRow) => {
    await db.delete("messages", { room_id: `eq.${room._row_id}` });
    await db.delete("rooms", { _row_id: `eq.${room._row_id}` });
    toast({ title: `Deleted "${room.name}" and its messages` });
    loadAll();
    loadMessages();
  };

  const handleDeleteMessage = async (row: MessageRow) => {
    await db.deleteOne("messages", { _row_id: `eq.${row._row_id}` });
    loadMessages();
  };

  const handleBanUser = async (usernameRaw: string) => {
    const username = usernameRaw.trim().toLowerCase();
    if (!username) return;
    const user = users.find((u) => u.username === username);
    await db.insert("bans", {
      username,
      device_id: user?.device_id ?? null,
      room_id: null,
    });
    toast({ title: "Banned", description: `${username} is now banned from the site.` });
    loadAll();
  };

  const handleUnban = async (username: string) => {
    await db.delete("bans", { username: `eq.${username}` });
    toast({ title: "Unbanned", description: `${username} can use the site again.` });
    loadAll();
  };

  const handleResolveReport = async (row: ReportRow) => {
    await db.update("user_reports", { _row_id: `eq.${row._row_id}` }, { status: "resolved" });
    toast({ title: "Report resolved" });
    loadAll();
  };

  const handleDeleteReport = async (row: ReportRow) => {
    await db.deleteOne("user_reports", { _row_id: `eq.${row._row_id}` });
    loadAll();
  };

  const handleDeleteSuggestion = async (row: SuggestionRow) => {
    await db.deleteOne("suggestions", { _row_id: `eq.${row._row_id}` });
    loadAll();
  };

  const handleStartDowntime = async () => {
    const hours = Number(downtimeHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      toast({ title: "Enter a valid number of hours", variant: "destructive" });
      return;
    }
    const now = Date.now();
    await db.insert("downtime_schedules", {
      start_time: now,
      end_time: now + hours * 3600000,
      reason: downtimeReason.trim() || null,
      is_active: 1,
    });
    toast({ title: "Downtime enabled", description: `The site will be down for ${hours} hour(s).` });
    setDowntimeReason("");
    loadAll();
  };

  const handleEndDowntime = async () => {
    await db.update("downtime_schedules", { is_active: "eq.1" }, { is_active: 0, end_time: Date.now() });
    toast({ title: "Downtime ended", description: "The site is back up." });
    loadAll();
  };

  const handleAdminSignOut = () => {
    localStorage.removeItem("isAdmin");
    navigate("/admin");
  };

  if (authorized !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const now = Date.now();
  const activeDowntime = downtimes.find((d) => d.is_active === 1 && now >= d.start_time && now < d.end_time);
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const filteredMessages =
    messageRoom === "all" ? messages : messages.filter((m) => String(m.room_id) === messageRoom);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="font-bold">Admin Panel</h1>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Site
            </Button>
            <Button variant="ghost" size="sm" onClick={handleAdminSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="bans">Bans</TabsTrigger>
            <TabsTrigger value="reports">
              Reports {pendingReports > 0 && <Badge className="ml-1 h-4 px-1.5">{pendingReports}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            <TabsTrigger value="downtime">Downtime</TabsTrigger>
            <TabsTrigger value="download">Download</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Rooms", value: rooms.length, icon: MessageSquare },
                { label: "Users", value: users.length, icon: Users },
                { label: "Messages (last 100)", value: messages.length, icon: MessageSquare },
                { label: "Active bans", value: bans.length, icon: BanIcon },
              ].map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="py-4 flex items-center gap-3">
                    <stat.icon className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold">Website code</p>
                  <p className="text-xs text-muted-foreground">
                    Download a ZIP of this site's source code (snapshot from {WEBSITE_SNAPSHOT_DATE}).
                  </p>
                </div>
                <a href="/website-source.zip" download>
                  <Button>
                    <Download className="w-4 h-4 mr-2" /> Download Website
                  </Button>
                </a>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold">Reload data</p>
                  <p className="text-xs text-muted-foreground">Refresh every list on this page.</p>
                </div>
                <Button variant="outline" onClick={loadAll} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ROOMS */}
          <TabsContent value="rooms" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create a room</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <Input
                    placeholder="Room name"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="flex-1 min-w-48"
                  />
                  <Select value={newRoomType} onValueChange={setNewRoomType}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleCreateRoom} disabled={!newRoomName.trim()}>
                    <Plus className="w-4 h-4 mr-2" /> Create
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-2">
              {rooms.map((room) => (
                <Card key={room._row_id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{room.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {room.type === "private" ? `Private — code ${room.code}` : "Public"} · Room #
                        {room._row_id}
                      </p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteRoom(room)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {rooms.length === 0 && <p className="text-sm text-muted-foreground">No rooms yet.</p>}
            </div>
          </TabsContent>

          {/* MESSAGES */}
          <TabsContent value="messages" className="space-y-4 mt-4">
            <Card>
              <CardContent className="py-4 space-y-3">
                <Label>Filter by room</Label>
                <div className="flex gap-2 flex-wrap items-center">
                  <Select value={messageRoom} onValueChange={setMessageRoom}>
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All rooms</SelectItem>
                      {rooms.map((room) => (
                        <SelectItem key={room._row_id} value={String(room._row_id)}>
                          {room.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={loadMessages}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-2">
              {filteredMessages.map((message) => (
                <Card key={message._row_id}>
                  <CardContent className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{message.sender_name}</span> in{" "}
                        {roomName(message.room_id)} · {fmtTime(message._created_at)}
                      </p>
                      <p className="text-sm break-words">{message.content}</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteMessage(message)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {filteredMessages.length === 0 && (
                <p className="text-sm text-muted-foreground">No messages found.</p>
              )}
            </div>
          </TabsContent>

          {/* USERS */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <div className="space-y-2">
              {users.map((user) => (
                <Card key={user._row_id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        @{user.username}{" "}
                        {bannedUsernames.has(user.username) && <Badge variant="destructive">banned</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last active {fmtTime(user.last_active)} · First seen {fmtTime(user.first_seen)}
                      </p>
                    </div>
                    {bannedUsernames.has(user.username) ? (
                      <Button variant="outline" size="sm" onClick={() => handleUnban(user.username)}>
                        Unban
                      </Button>
                    ) : (
                      <Button variant="destructive" size="sm" onClick={() => handleBanUser(user.username)}>
                        Ban
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              {users.length === 0 && <p className="text-sm text-muted-foreground">No users yet.</p>}
            </div>
          </TabsContent>

          {/* BANS */}
          <TabsContent value="bans" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ban a user by username</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="username"
                    value={banInput}
                    onChange={(e) => setBanInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleBanUser(banInput)}
                  />
                  <Button variant="destructive" onClick={() => handleBanUser(banInput)} disabled={!banInput.trim()}>
                    <BanIcon className="w-4 h-4 mr-2" /> Ban
                  </Button>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-2">
              {bans.map((ban) => (
                <Card key={ban._row_id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">@{ban.username}</p>
                      <p className="text-xs text-muted-foreground">
                        Banned {fmtTime(Number(ban._created_at))}
                        {ban.room_id !== null && typeof ban.room_id === "number"
                          ? ` · Room #${ban.room_id}`
                          : " · Site-wide"}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleUnban(ban.username)}>
                      Unban
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {bans.length === 0 && <p className="text-sm text-muted-foreground">No active bans.</p>}
            </div>
          </TabsContent>

          {/* REPORTS */}
          <TabsContent value="reports" className="space-y-4 mt-4">
            <div className="space-y-2">
              {reports.map((report) => (
                <Card key={report._row_id}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm">
                          <Flag className="w-4 h-4 inline mr-1 text-destructive" />
                          <span className="font-semibold">@{report.reported_username}</span> reported by @
                          {report.reporter_username}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Reason: {report.report_reason}
                          {report.custom_reason ? ` — ${report.custom_reason}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{fmtTime(report._created_at)}</p>
                      </div>
                      <Badge variant={report.status === "resolved" ? "secondary" : "destructive"}>
                        {report.status}
                      </Badge>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {report.status !== "resolved" && (
                        <Button variant="outline" size="sm" onClick={() => handleResolveReport(report)}>
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Resolve
                        </Button>
                      )}
                      {!bannedUsernames.has(report.reported_username) && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleBanUser(report.reported_username)}
                        >
                          <BanIcon className="w-4 h-4 mr-2" /> Ban @{report.reported_username}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {reports.length === 0 && <p className="text-sm text-muted-foreground">No reports.</p>}
            </div>
          </TabsContent>

          {/* SUGGESTIONS */}
          <TabsContent value="suggestions" className="space-y-4 mt-4">
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <Card key={suggestion._row_id}>
                  <CardContent className="py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm break-words">
                        <Lightbulb className="w-4 h-4 inline mr-1 text-yellow-500" />
                        {suggestion.content}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        From @{suggestion.username} · {fmtTime(suggestion._created_at)}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSuggestion(suggestion)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {suggestions.length === 0 && <p className="text-sm text-muted-foreground">No suggestions.</p>}
            </div>
          </TabsContent>

          {/* DOWNTIME */}
          <TabsContent value="downtime" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {activeDowntime ? "Downtime is currently ENABLED" : "Schedule downtime"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeDowntime && (
                  <p className="text-sm text-muted-foreground">
                    Until {fmtTime(activeDowntime.end_time)}
                    {activeDowntime.reason ? ` — ${activeDowntime.reason}` : ""}
                  </p>
                )}
                <div className="flex gap-2 flex-wrap items-end">
                  <div className="space-y-1">
                    <Label htmlFor="dt-hours">Hours</Label>
                    <Input
                      id="dt-hours"
                      type="number"
                      min="0.1"
                      step="0.5"
                      value={downtimeHours}
                      onChange={(e) => setDowntimeHours(e.target.value)}
                      className="w-24"
                    />
                  </div>
                  <div className="space-y-1 flex-1 min-w-48">
                    <Label htmlFor="dt-reason">Reason (optional)</Label>
                    <Input
                      id="dt-reason"
                      placeholder="Scheduled maintenance"
                      value={downtimeReason}
                      onChange={(e) => setDowntimeReason(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleStartDowntime}>Start downtime</Button>
                  {activeDowntime && (
                    <Button variant="destructive" onClick={handleEndDowntime}>
                      End downtime now
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  While downtime is on, every visitor sees a full-screen maintenance page with a
                  countdown until it ends.
                </p>
              </CardContent>
            </Card>
            <div className="space-y-2">
              {downtimes.slice(0, 10).map((row) => (
                <Card key={row._row_id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm">
                        {fmtTime(row.start_time)} → {fmtTime(row.end_time)}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.reason || "No reason given"}</p>
                    </div>
                    <Badge variant={row.is_active === 1 ? "destructive" : "secondary"}>
                      {row.is_active === 1 ? "active" : "ended"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
              {downtimes.length === 0 && <p className="text-sm text-muted-foreground">No downtime history.</p>}
            </div>
          </TabsContent>

          {/* DOWNLOAD */}
          <TabsContent value="download" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Download website code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This downloads a ZIP file with this website's complete source code — every page,
                  component, style, and the database setup.
                </p>
                <a href="/website-source.zip" download>
                  <Button size="lg">
                    <Download className="w-4 h-4 mr-2" /> Download Website (.zip)
                  </Button>
                </a>
                <p className="text-xs text-muted-foreground">
                  Snapshot generated {WEBSITE_SNAPSHOT_DATE}. If the site changes after that, ask for
                  a fresh snapshot and this button will download the newest code.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPanel;
