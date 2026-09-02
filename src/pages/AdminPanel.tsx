import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Ban as BanIcon,
  CheckCircle2,
  Copy,
  DoorOpen,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Flag,
  KeyRound,
  Lightbulb,
  Loader2,
  Lock,
  LockOpen,
  LogIn,
  LogOut,
  MessageSquare,
  MicOff,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Trash2,
  UserCog,
  Video as VideoIcon,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import auth from "@/lib/shared/kliv-auth.js";
import { functions } from "@/lib/shared/kliv-functions.js";
import { downloadWebsiteZip } from "@/lib/websiteZip";
import UserManager, { type SessionInfo } from "@/lib/userManagement";
import {
  SETTING_DEFS,
  SETTING_GROUPS,
  suggestPassword,
  useAppSettings,
  settingBool,
  type SettingValue,
} from "@/lib/appSettings";
import { isPresenceOnline, parseSeen, type PresenceRow } from "@/lib/presence";
import CallStage from "@/components/CallStage";
import UserDiagnostics from "@/components/UserDiagnostics";
import {
  endCall,
  getActiveCalls,
  splitPairKey,
  type CallParticipantRow,
  type CallSessionRow,
} from "@/lib/calls";
import { isOwnerSession } from "@/lib/owner";
import AdminDirectMessages from "@/components/AdminDirectMessages";
import AdminFiles from "@/components/AdminFiles";
import AdminNotifications from "@/components/AdminNotifications";
import AdminVersionNotices from "@/components/AdminVersionNotices";
import AdminTheme from "@/components/AdminTheme";
import AdminOnlineNow from "@/components/AdminOnlineNow";
import AdminHealth from "@/components/AdminHealth";
import AdminManagers, { MakeAdminDialog } from "@/components/AdminManagers";
import {
  getActiveLocks,
  isActiveLock,
  kickAccount,
  lockAccount,
  unlockAccount,
  type AccountLockRow,
} from "@/lib/siteNotices";
import AdminAI from "@/components/AdminAI";
import AdminModeration from "@/components/AdminModeration";
import AdminWordList from "@/components/AdminWordList";
import AdminAppeals from "@/components/AdminAppeals";
import AdminAnalytics from "@/components/AdminAnalytics";
import AdminAuditLog from "@/components/AdminAuditLog";
import AdminMessageSearch from "@/components/AdminMessageSearch";
import AdminPolls from "@/components/admin/AdminPolls";
import AdminImportantNotices from "@/components/admin/AdminImportantNotices";
import {
  AdminTopChatters,
  AdminRoomInsights,
  AdminSignupTrends,
} from "@/components/admin/AdminInsights";
import {
  AdminUserSearch,
  AdminLocksTable,
  AdminKickLog,
  AdminDataExport,
} from "@/components/admin/AdminAccountTools";
import { AdminFriendsManager, AdminBios } from "@/components/admin/AdminSocialTabs";
import { AdminRoomEditor, AdminEmptyRooms } from "@/components/admin/AdminRoomTools";
import { AdminMessageCleanup, AdminWordTester } from "@/components/admin/AdminMessageTools";
import {
  AdminAnnouncementStats,
  AdminCallHistory,
  AdminDmStats,
  AdminIpInsights,
  AdminActivityFeed,
} from "@/components/admin/AdminNotifTools";
import {
  AdminSiteInfo,
  AdminTermsEditor,
  AdminMaintenance,
} from "@/components/admin/AdminSiteTools";
import { formatDuration } from "@/lib/moderation";

// still referenced by ban-history formatting below
void formatDuration;
import {
  canDo,
  clearAdminSession,
  getAdminSession,
  type AdminSession,
  type PermissionKey,
} from "@/lib/adminAccounts";

interface RoomRow {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
  is_voice?: number | null;
  [key: string]: unknown;
}

interface BanRow {
  _row_id: number;
  username: string;
  room_id: number | null;
  ban_duration?: number | null;
  reason?: string | null;
  tier?: number | null;
  source?: string | null;
  device_id?: string | null;
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
  status: string;
  admin_reply: string | null;
  replied_at: number | null;
  replied_by: string | null;
  _created_at: number;
  [key: string]: unknown;
}

interface MessageRow {
  _row_id: number;
  room_id: number;
  sender_name: string;
  content: string;
  _created_at: number;
  impersonated_by?: string | null;
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

interface ProfileAccountRow {
  _row_id: number;
  user_id: string;
  username: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  _created_at: number;
  [key: string]: unknown;
}

interface CredentialRow {
  _row_id: number;
  user_id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password?: string;
  _created_at: number;
  [key: string]: unknown;
}

interface IpRow {
  _row_id: number;
  user_id: string | null;
  username: string | null;
  email: string | null;
  ip: string;
  user_agent: string | null;
  _created_at: number;
  [key: string]: unknown;
}

interface TypingRow {
  _row_id: number;
  room_id: number;
  username: string;
  draft: string;
  updated_at: number;
  [key: string]: unknown;
}

interface AuditRow {
  _row_id: number;
  action: string;
  actor_email: string | null;
  target: string | null;
  detail: string | null;
  _created_at: number;
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
    ? new Date(value * (value > 1e11 ? 1 : 1000)).toLocaleString([], {
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
  const [session, setSession] = useState<SessionInfo | null | undefined>(undefined);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [downtimes, setDowntimes] = useState<DowntimeRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileAccountRow[]>([]);
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());
  const [ips, setIps] = useState<IpRow[]>([]);
  const [presence, setPresence] = useState<PresenceRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [ownerDataError, setOwnerDataError] = useState<string | null>(null);
  const [messageRoom, setMessageRoom] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomType, setNewRoomType] = useState("public");
  const [newRoomVoice, setNewRoomVoice] = useState(false);
  const [banInput, setBanInput] = useState("");
  const [banAmount, setBanAmount] = useState("30");
  const [banUnit, setBanUnit] = useState("minutes");
  const [banReason, setBanReason] = useState("");
  const [downtimeHours, setDowntimeHours] = useState("2");
  const [downtimeReason, setDowntimeReason] = useState("");
  const [ipFilter, setIpFilter] = useState("");

  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [liveRoom, setLiveRoom] = useState<string>("");
  const [liveMessages, setLiveMessages] = useState<MessageRow[]>([]);
  const [liveTyping, setLiveTyping] = useState<TypingRow[]>([]);
  const [asUser, setAsUser] = useState("");
  const [asText, setAsText] = useState("");
  const [asBusy, setAsBusy] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<string | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [makeAdminTarget, setMakeAdminTarget] = useState<string | null>(null);

  // Account locks (owner locks someone out while fixing their account)
  const [locks, setLocks] = useState<AccountLockRow[]>([]);
  const [lockTarget, setLockTarget] = useState<string | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [lockBusy, setLockBusy] = useState(false);

  // Kick: force a user to sign in again
  const [kickingUser, setKickingUser] = useState<string | null>(null);

  // Settings + cleanup
  const { settings, loaded: settingsLoaded, update: updateSetting, reload: reloadSettings } = useAppSettings();
  const [purgeInfo, setPurgeInfo] = useState<{ at: number; count: number } | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);

  // Testing mode (owner): site open only to owner + chosen admins while testing
  const [testingAdmins, setTestingAdmins] = useState("");
  const [testingSaving, setTestingSaving] = useState(false);

  useEffect(() => {
    if (settingsLoaded) setTestingAdmins(String(settings.testing_allowed_admins ?? ""));
  }, [settingsLoaded, settings.testing_allowed_admins]);

  // Password reset
  const [pwTarget, setPwTarget] = useState<{ userId: string; username: string } | null>(null);
  const [pwValue, setPwValue] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState<string | null>(null);

  // Live calls + per-account diagnostics (owner tools)
  const [calls, setCalls] = useState<CallSessionRow[]>([]);
  const [callParts, setCallParts] = useState<CallParticipantRow[]>([]);
  const [watchCall, setWatchCall] = useState<{ callId: number; label: string } | null>(null);
  const [diagUser, setDiagUser] = useState<string | null>(null);
  const [endingCallId, setEndingCallId] = useState<number | null>(null);

  useEffect(() => {
    setAuthorized(localStorage.getItem("isAdmin") === "true");
    setAdminSession(getAdminSession());
  }, []);

  useEffect(() => {
    if (authorized === false) {
      navigate("/admin");
    }
  }, [authorized, navigate]);

  useEffect(() => {
    if (authorized !== true) return;
    let cancelled = false;
    UserManager.getSession()
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authorized]);

  const isOwner = isOwnerSession(session ?? null);

  // What this admin may do: owners get everything, invited admins only what
  // the owner checked for them.
  const adminPerms = adminSession?.permissions ?? {};
  const can = (key: PermissionKey) => canDo(adminPerms, key, isOwner);

  // Keep the live-calls list fresh
  useEffect(() => {
    if (authorized !== true) return;
    let stopped = false;
    const loadCalls = async () => {
      try {
        const [sessionCalls, parts] = await Promise.all([
          getActiveCalls(),
          db.query<CallParticipantRow>("call_participants", { order: "_row_id.desc" }),
        ]);
        if (!stopped) {
          setCalls(sessionCalls);
          setCallParts(parts);
        }
      } catch {
        // best-effort
      }
    };
    void loadCalls();
    const timer = setInterval(loadCalls, 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [authorized]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [roomRows, banRows, reportRows, suggestionRows, downtimeRows, profileRows, presenceRows, lockRows] =
        await Promise.all([
          db.query<RoomRow>("rooms", { order: "_row_id.asc" }),
          db.query<BanRow>("bans", { order: "_created_at.desc" }),
          db.query<ReportRow>("user_reports", { order: "_created_at.desc" }),
          db.query<SuggestionRow>("suggestions", { order: "_created_at.desc" }),
          db.query<DowntimeRow>("downtime_schedules", { order: "start_time.desc" }),
          db.query<ProfileAccountRow>("user_profiles", { order: "_created_at.desc" }),
          db.query<PresenceRow>("online_users", { order: "last_seen.desc" }),
          db.query<AccountLockRow>("account_locks", { order: "locked_at.desc" }),
        ]);
      setRooms(roomRows);
      setBans(banRows);
      setReports(reportRows);
      setSuggestions(suggestionRows);
      setDowntimes(downtimeRows);
      setProfiles(profileRows);
      setPresence(presenceRows);
      setLocks(lockRows);
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

  // Keep online/offline status fresh while the panel is open
  useEffect(() => {
    if (!authorized) return;
    const loadPresence = async () => {
      try {
        setPresence(await db.query<PresenceRow>("online_users", { order: "last_seen.desc" }));
      } catch {
        // best-effort
      }
    };
    const timer = setInterval(loadPresence, 30000);
    return () => clearInterval(timer);
  }, [authorized]);

  const loadMessages = useCallback(async () => {
    try {
      const rows = await db.query<MessageRow>("messages", { order: "_created_at.desc" });
      setMessages(rows.slice(0, 100));
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, []);

  useEffect(() => {
    if (authorized && session) {
      loadMessages();
    }
  }, [authorized, session, loadMessages]);

  const loadPurgeInfo = useCallback(async () => {
    try {
      const rows = await db.query<{ setting_key: string; setting_value: string }>("admin_settings");
      const at = Number(rows.find((r) => r.setting_key === "last_purge_at")?.setting_value ?? 0);
      const count = Number(rows.find((r) => r.setting_key === "last_purge_count")?.setting_value ?? 0);
      setPurgeInfo(at > 0 ? { at, count } : null);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    if (authorized) {
      loadPurgeInfo();
    }
  }, [authorized, loadPurgeInfo]);

  const loadOwnerData = useCallback(async () => {
    setOwnerDataError(null);
    try {
      const [credRows, ipRows, auditRows] = await Promise.all([
        db.query<CredentialRow>("account_credentials", { order: "_created_at.desc" }),
        db.query<IpRow>("ip_logs", { order: "_created_at.desc" }),
        db.query<AuditRow>("admin_audit", { order: "_created_at.desc", limit: "20" }),
      ]);
      setCredentials(credRows);
      setIps(ipRows);
      setAudit(auditRows);
    } catch {
      setOwnerDataError("Couldn't load account and IP data.");
    }
  }, []);

  useEffect(() => {
    if (session?.isPrimaryTeam) {
      loadOwnerData();
    }
  }, [session, loadOwnerData]);

  const loadLive = useCallback(async () => {
    if (!liveRoom) return;
    try {
      const [msgRows, typingRows] = await Promise.all([
        db.query<MessageRow>("messages", {
          room_id: `eq.${liveRoom}`,
          order: "_created_at.desc",
          limit: "50",
        }),
        db.query<TypingRow>("typing_status", { room_id: `eq.${liveRoom}` }),
      ]);
      setLiveMessages(msgRows);
      setLiveTyping(
        typingRows.filter((t) => t.draft && Date.now() - Number(t.updated_at) < 15000)
      );
    } catch {
      // best-effort live view
    }
  }, [liveRoom]);

  useEffect(() => {
    if (!authorized || !session || !liveRoom) return;
    loadLive();
    const timer = setInterval(loadLive, 2500);
    return () => clearInterval(timer);
  }, [authorized, session, liveRoom, loadLive]);

  useEffect(() => {
    if (!liveRoom && rooms.length > 0) {
      setLiveRoom(String(rooms[0]._row_id));
    }
  }, [rooms, liveRoom]);

  const roomName = (id: number) => rooms.find((r) => r._row_id === id)?.name ?? `Room #${id}`;
  const togglePassword = (username: string) =>
    setRevealedPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  const bannedUsernames = new Set(bans.map((b) => b.username));
  const lockedUsernames = new Set(locks.filter(isActiveLock).map((l) => l.username));

  const refreshLocks = async () => {
    setLocks(await getActiveLocks());
  };

  const handleLockAccount = async (target: string) => {
    setLockBusy(true);
    try {
      const result = await lockAccount(target, lockReason);
      if (result.error) {
        toast({ title: "Couldn't lock that account", description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: `@${target} is locked out`,
        description: "They'll see a temporarily-locked screen until you unlock the account.",
      });
      setLockTarget(null);
      setLockReason("");
      await refreshLocks();
    } finally {
      setLockBusy(false);
    }
  };

  const handleUnlockAccount = async (target: string) => {
    setLockBusy(true);
    try {
      const result = await unlockAccount(target);
      if (result.error) {
        toast({ title: "Couldn't unlock that account", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: `@${target} can sign back in`, description: "The lock is lifted." });
      await refreshLocks();
    } finally {
      setLockBusy(false);
    }
  };

  const handleKickAccount = async (target: string) => {
    setKickingUser(target);
    try {
      const result = await kickAccount(target);
      if (result.error) {
        toast({ title: "Couldn't kick that account", description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: `@${target} was kicked`,
        description: "They're signed out and will need to log in again.",
      });
    } finally {
      setKickingUser(null);
    }
  };

  const handleCreateRoom = async () => {
    const name = newRoomName.trim();
    if (!name) return;
    const type = newRoomType === "private" ? "private" : "public";
    const code = type === "private" ? generateRoomCode() : null;
    await db.insert("rooms", { name, code, type, is_voice: newRoomVoice ? 1 : 0 });
    toast({
      title: newRoomVoice ? "Voice room created" : "Room created",
      description: type === "private" ? `Private room code: ${code}` : undefined,
    });
    setNewRoomName("");
    setNewRoomType("public");
    setNewRoomVoice(false);
    loadAll();
  };

  const handleDeleteRoom = async (room: RoomRow) => {
    await db.delete("messages", { room_id: `eq.${room._row_id}` });
    await db.delete("rooms", { _row_id: `eq.${room._row_id}` });
    toast({ title: `Deleted "${room.name}" and its messages` });
    loadAll();
    loadMessages();
  };

  const openRoomById = (id: number) => {
    sessionStorage.setItem(`room_unlocked_${id}`, "1");
    navigate(`/chat/${id}`);
  };

  const handleOpenRoom = (room: RoomRow) => {
    // Admins skip the private-room code gate
    openRoomById(room._row_id);
  };

  const handleDeleteMessage = async (row: MessageRow) => {
    await db.deleteOne("messages", { _row_id: `eq.${row._row_id}` });
    loadMessages();
    loadLive();
  };

  const handleBanUser = async (usernameRaw: string) => {
    const username = usernameRaw.trim().toLowerCase();
    if (!username) return;
    const amount = Math.max(0, Math.floor(Number(banAmount) || 0));
    const factor =
      banUnit === "seconds" ? 1 : banUnit === "minutes" ? 60 : banUnit === "hours" ? 3600 : 86400;
    const seconds = banUnit === "forever" || amount <= 0 ? 0 : amount * factor;
    const humanText =
      seconds <= 0 ? "permanently" : `for ${amount} ${seconds === 1 ? banUnit.replace(/s$/, "") : banUnit}`;
    await db.insert("bans", {
      username,
      device_id: null,
      room_id: null,
      ban_duration: seconds,
      reason: banReason.trim() || `Banned by an admin ${humanText}`,
      tier: null,
      source: "admin",
    });
    toast({
      title: "Banned",
      description: `@${username} is banned ${humanText}.`,
    });
    setBanInput("");
    setBanReason("");
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

  // Suggestions: admin replies tell the sender what was done
  const [replyDraft, setReplyDraft] = useState<Record<number, string>>({});
  const [replyBusy, setReplyBusy] = useState<number | null>(null);

  const handleReplySuggestion = async (row: SuggestionRow) => {
    const text = (replyDraft[row._row_id] ?? "").trim();
    if (!text) {
      toast({ title: "Write a reply first", description: "Tell them what you did with the idea." });
      return;
    }
    setReplyBusy(row._row_id);
    try {
      await db.updateOne(
        "suggestions",
        { _row_id: `eq.${row._row_id}` },
        {
          status: "replied",
          admin_reply: text,
          replied_at: Math.floor(Date.now() / 1000),
          replied_by: isOwner ? "the owner" : adminSession?.username ?? "an admin",
        }
      );
      try {
        await db.insert("notifications", {
          type: "suggestion",
          recipient_username: row.username,
          title: "Reply to your suggestion",
          message: text.slice(0, 200),
          link: "/suggestions",
        });
      } catch {
        // notification is best-effort — the reply itself already saved
      }
      setSuggestions((prev) =>
        prev.map((s) =>
          s._row_id === row._row_id
            ? { ...s, status: "replied", admin_reply: text, replied_at: Math.floor(Date.now() / 1000), replied_by: isOwner ? "the owner" : adminSession?.username ?? "an admin" }
            : s
        )
      );
      setReplyDraft((prev) => ({ ...prev, [row._row_id]: "" }));
      toast({ title: "Reply sent", description: `@${row.username} was notified.` });
    } catch {
      toast({ title: "Couldn't send the reply", variant: "destructive" });
    } finally {
      setReplyBusy(null);
    }
  };

  const handleDeleteSuggestion = async (row: SuggestionRow) => {
    await db.deleteOne("suggestions", { _row_id: `eq.${row._row_id}` });
    loadAll();
  };

  const handleSendAs = async () => {
    if (!liveRoom || !asUser.trim() || !asText.trim()) return;
    setAsBusy(true);
    try {
      const target = asUser.trim().toLowerCase();
      await db.insert("messages", {
        room_id: Number(liveRoom),
        sender_name: target,
        content: asText.trim().slice(0, 2000),
        device_id: null,
        is_ai: 0,
        impersonated_by: session?.username ?? session?.email ?? "admin",
      });
      setAsText("");
      toast({
        title: "Message sent",
        description: `It now appears in the chat as @${target}.`,
      });
      loadLive();
      loadMessages();
    } catch {
      toast({ title: "Couldn't send that message", variant: "destructive" });
    } finally {
      setAsBusy(false);
    }
  };

  const handleDeleteAccount = async (userId: string, username: string) => {
    if (!window.confirm(`Delete @${username}'s account and all their chat data?`)) return;
    setDeletingAccount(userId);
    try {
      try {
        await auth.deleteUser(userId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        toast({
          title: "Chat data removed, login kept",
          description: message.includes("forbidden")
            ? "Deleting the login itself needs owner-level account permissions. Their profile and messages were removed."
            : "Their profile and messages were removed, but the login itself couldn't be deleted from here.",
        });
      }
      await Promise.allSettled([
        db.delete("user_profiles", { user_id: `eq.${userId}` }),
        db.delete("account_credentials", { user_id: `eq.${userId}` }),
        db.delete("messages", { sender_name: `eq.${username}` }),
        db.delete("direct_messages", { sender_username: `eq.${username}` }),
        db.delete("direct_messages", { recipient_username: `eq.${username}` }),
        db.delete("friendships", { user_id: `eq.${username}` }),
        db.delete("friendships", { friend_id: `eq.${username}` }),
        db.delete("online_users", { username: `eq.${username}` }),
        db.delete("typing_status", { username: `eq.${username}` }),
        db.delete("bans", { username: `eq.${username}` }),
      ]);
      toast({ title: `Deleted @${username}` });
    } finally {
      setDeletingAccount(null);
      loadAll();
      if (session?.isPrimaryTeam) {
        loadOwnerData();
      }
    }
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

  const handleSettingChange = async (key: string, value: SettingValue) => {
    try {
      await updateSetting(key, value);
      toast({ title: "Saved", description: "The live site now uses this." });
    } catch {
      toast({ title: "Couldn't save that setting", variant: "destructive" });
      reloadSettings();
    }
  };

  const handleRunPurgeNow = async () => {
    setPurgeBusy(true);
    try {
      const result = await functions.post<{ deletedMessages?: number }>("purge-messages", {});
      toast({
        title: "Cleanup finished",
        description: `${result?.deletedMessages ?? 0} old room message(s) deleted. Private messages were kept.`,
      });
      loadPurgeInfo();
      loadMessages();
    } catch {
      toast({ title: "Cleanup failed", variant: "destructive" });
    } finally {
      setPurgeBusy(false);
    }
  };

  const openResetPassword = (userId: string, username: string) => {
    setPwTarget({ userId, username });
    setPwValue(suggestPassword());
    setPwDone(null);
  };

  const handleResetPassword = async () => {
    if (!pwTarget || pwValue.length < 8) return;
    setPwBusy(true);
    try {
      await functions.post("owner-set-password", {
        userUuid: pwTarget.userId,
        password: pwValue,
        username: pwTarget.username,
      });
      setPwDone(pwValue);
      toast({
        title: "Password reset",
        description: `@${pwTarget.username} can now sign in with the new password.`,
      });
      loadOwnerData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast({
        title: "Couldn't reset that password",
        description: message.includes("forbidden")
          ? "Sign in with the site owner's own account to reset passwords."
          : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPwBusy(false);
    }
  };

  const handleAdminSignOut = () => {
    localStorage.removeItem("isAdmin");
    clearAdminSession();
    navigate("/admin");
  };

  if (authorized !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const SignInGate = (
    <Card>
      <CardContent className="py-10 text-center space-y-3">
        <LogIn className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="font-semibold">Sign-in required</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This tab reads live chat data, which only signed-in accounts can see. Sign in with the
          site owner's account, then come back to the admin panel.
        </p>
        <Button onClick={() => navigate("/login")}>
          <LogIn className="w-4 h-4 mr-2" /> Go to sign in
        </Button>
      </CardContent>
    </Card>
  );

  const OwnerGate = (
    <Card>
      <CardContent className="py-10 text-center space-y-2">
        <Shield className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="font-semibold">Site owner only</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Account details, IP addresses, password resets, and site settings are only available
          when you're signed in as the site owner's own login.
        </p>
      </CardContent>
    </Card>
  );

  const NoPermission = (
    <Card>
      <CardContent className="py-10 text-center space-y-2">
        <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="font-semibold">Not part of your admin access</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          The site owner hasn't given you permission for this area. Ask them to turn it on under
          Admins → Abilities.
        </p>
      </CardContent>
    </Card>
  );

  const withSignIn = (content: ReactNode) =>
    session === undefined ? (
      <p className="text-sm text-muted-foreground py-8 text-center">Checking your sign-in…</p>
    ) : session === null ? (
      SignInGate
    ) : (
      content
    );

  const withOwner = (content: ReactNode) =>
    session === undefined ? (
      <p className="text-sm text-muted-foreground py-8 text-center">Checking your sign-in…</p>
    ) : session === null ? (
      SignInGate
    ) : !session.isPrimaryTeam ? (
      OwnerGate
    ) : (
      content
    );

  const now = Date.now();
  const activeDowntime = downtimes.find(
    (d) => d.is_active === 1 && now >= d.start_time && now < d.end_time
  );
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const filteredMessages =
    messageRoom === "all" ? messages : messages.filter((m) => String(m.room_id) === messageRoom);

  const onlineUsernames = new Set(
    presence.filter((p) => isPresenceOnline(p, now)).map((p) => p.username)
  );

  const accounts = profiles.map((p) => {
    const cred = credentials.find((c) => c.user_id === p.user_id);
    const pres = presence.find((r) => r.username === p.username);
    const name =
      [cred?.first_name ?? p.first_name ?? "", cred?.last_name ?? p.last_name ?? ""]
        .filter(Boolean)
        .join(" ") || p.display_name || "";
    const seenAt = pres ? parseSeen(pres.last_seen) : 0;
    return {
      userId: p.user_id,
      username: p.username,
      name,
      email: cred?.email ?? null,
      password: cred?.password ?? null,
      joined: Number(p._created_at),
      lastIp: ips.find((i) => i.user_id === p.user_id)?.ip ?? null,
      online: pres ? isPresenceOnline(pres, now) : false,
      lastSeen: seenAt,
      roomId: pres?.room_id != null ? Number(pres.room_id) : null,
    };
  });

  const filteredIps = ips.filter((row) => {
    const q = ipFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      (row.username ?? "").toLowerCase().includes(q) ||
      (row.email ?? "").toLowerCase().includes(q) ||
      row.ip.toLowerCase().includes(q)
    );
  });

  const liveRoomName = liveRoom ? roomName(Number(liveRoom)) : "";
  const suggestUsers = [
    ...new Set([
      ...liveTyping.map((t) => t.username),
      ...liveMessages.slice(0, 20).map((m) => m.sender_name),
    ]),
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="font-bold">Admin Panel</h1>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            {session && (
              <Badge variant={session.isPrimaryTeam ? "default" : "secondary"} className="ml-2">
                {session.isPrimaryTeam ? "owner" : session.email ?? "signed in"}
              </Badge>
            )}
            {!isOwner && adminSession && (
              <Badge variant="outline" className="ml-2">
                admin: @{adminSession.username}
              </Badge>
            )}
            {onlineUsernames.size > 0 && (
              <Badge variant="outline" className="ml-2 gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {onlineUsernames.size} online
              </Badge>
            )}
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
            {can("rooms") && <TabsTrigger value="rooms">Rooms</TabsTrigger>}
            {can("live") && <TabsTrigger value="live">Live</TabsTrigger>}
            {can("live") && <TabsTrigger value="online">Online Now</TabsTrigger>}
            {can("calls") && (
              <TabsTrigger value="calls">
                Calls {calls.length > 0 && <Badge className="ml-1 h-4 px-1.5">{calls.length}</Badge>}
              </TabsTrigger>
            )}
            {can("messages") && <TabsTrigger value="messages">Messages</TabsTrigger>}
            {can("files") && <TabsTrigger value="files">Files</TabsTrigger>}
            {can("dms") && <TabsTrigger value="dms">Direct Messages</TabsTrigger>}
            {can("accounts") && <TabsTrigger value="accounts">Accounts</TabsTrigger>}
            {can("admins") && <TabsTrigger value="admins">Admins</TabsTrigger>}
            {can("ips") && <TabsTrigger value="ips">IP Logs</TabsTrigger>}
            {can("people") && <TabsTrigger value="bans">Bans</TabsTrigger>}
            {can("people") && <TabsTrigger value="appeals">Appeals</TabsTrigger>}
            {can("messages") && <TabsTrigger value="search">Message Search</TabsTrigger>}
            {can("analytics") && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
            {isOwner && <TabsTrigger value="audit">Audit Log</TabsTrigger>}
            {can("people") && <TabsTrigger value="moderation">Moderation</TabsTrigger>}
            {can("people") && <TabsTrigger value="words">Bannable Words</TabsTrigger>}
            {can("people") && (
              <TabsTrigger value="reports">
                Reports {pendingReports > 0 && <Badge className="ml-1 h-4 px-1.5">{pendingReports}</Badge>}
              </TabsTrigger>
            )}
            {can("people") && <TabsTrigger value="suggestions">Suggestions</TabsTrigger>}
            {can("notifications") && <TabsTrigger value="notifications">Notifications</TabsTrigger>}
            {can("notifications") && <TabsTrigger value="updates">Updates</TabsTrigger>}
            {can("downtime") && <TabsTrigger value="downtime">Downtime</TabsTrigger>}
            {can("settings") && <TabsTrigger value="theme">Theme</TabsTrigger>}
            {can("settings") && <TabsTrigger value="health">Health</TabsTrigger>}
            {can("settings") && <TabsTrigger value="settings">Settings</TabsTrigger>}
            {isOwner && <TabsTrigger value="download">Download</TabsTrigger>}
            {settingBool(settings, "ai_beta_enabled") && <TabsTrigger value="ai">AI (beta)</TabsTrigger>}
            {can("rooms") && <TabsTrigger value="roomeditor">Room Editor</TabsTrigger>}
            {can("rooms") && <TabsTrigger value="emptyrooms">Empty Rooms</TabsTrigger>}
            {can("live") && <TabsTrigger value="activityfeed">Activity Feed</TabsTrigger>}
            {can("calls") && <TabsTrigger value="callhistory">Call History</TabsTrigger>}
            {can("messages") && <TabsTrigger value="cleanup">Message Cleanup</TabsTrigger>}
            {can("analytics") && <TabsTrigger value="topchatters">Top Chatters</TabsTrigger>}
            {can("analytics") && <TabsTrigger value="roominsights">Room Insights</TabsTrigger>}
            {can("analytics") && <TabsTrigger value="signuptrends">Signup Trends</TabsTrigger>}
            {can("dms") && <TabsTrigger value="dmstats">DM Stats</TabsTrigger>}
            {can("accounts") && <TabsTrigger value="usersearch">User Search</TabsTrigger>}
            {can("accounts") && <TabsTrigger value="locks">Locks</TabsTrigger>}
            {can("accounts") && <TabsTrigger value="kicklog">Kick Log</TabsTrigger>}
            {can("accounts") && <TabsTrigger value="dataexport">Data Export</TabsTrigger>}
            {can("ips") && <TabsTrigger value="ipinsights">IP Insights</TabsTrigger>}
            {can("people") && <TabsTrigger value="wordtester">Word Tester</TabsTrigger>}
            {can("people") && <TabsTrigger value="bios">Bios</TabsTrigger>}
            {can("social") && <TabsTrigger value="friends">Friends</TabsTrigger>}
            {can("notifications") && <TabsTrigger value="important">Important Notices</TabsTrigger>}
            {can("notifications") && <TabsTrigger value="notifstats">Announcement Stats</TabsTrigger>}
            {can("polls") && <TabsTrigger value="polls">Polls</TabsTrigger>}
            {can("settings") && <TabsTrigger value="siteinfo">Site Info</TabsTrigger>}
            {can("settings") && <TabsTrigger value="terms">Terms</TabsTrigger>}
            {can("settings") && <TabsTrigger value="maintenance">Maintenance</TabsTrigger>}
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
              {[
                { label: "Online now", value: onlineUsernames.size, icon: Wifi },
                { label: "Rooms", value: rooms.length, icon: MessageSquare },
                { label: "Accounts", value: profiles.length, icon: UserCog },
                { label: "Messages (last 100)", value: messages.length, icon: MessageSquare },
                { label: "Bans", value: bans.length, icon: BanIcon },
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
              <CardContent className="py-4 space-y-2">
                <p className="font-semibold">Viewing as</p>
                {session === undefined && (
                  <p className="text-sm text-muted-foreground">Checking your sign-in…</p>
                )}
                {session === null && (
                  <p className="text-sm text-muted-foreground">
                    Not signed in — data tabs are locked until you sign in with the site owner's
                    account.
                  </p>
                )}
                {session && (
                  <p className="text-sm text-muted-foreground">
                    {session.isPrimaryTeam ? "Site owner — " : ""}
                    {session.email ?? "unknown email"}
                    {session.username ? ` · chatting as @${session.username}` : " · no chat username yet"}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-semibold">Website code</p>
                  <p className="text-xs text-muted-foreground">
                    Download a ZIP of this site's source code (snapshot from {WEBSITE_SNAPSHOT_DATE}).
                  </p>
                </div>
                <span onClick={downloadWebsiteZip}>
                  <Button>
                    <Download className="w-4 h-4 mr-2" /> Download Website
                  </Button>
                </span>
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
            {withSignIn(
              <>
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
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none w-fit">
                      <Switch checked={newRoomVoice} onCheckedChange={setNewRoomVoice} />
                      Voice room — shows in the “Voice rooms” list and anyone can start the call
                    </label>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {rooms.map((room) => {
                    const inRoom = presence.filter(
                      (p) => Number(p.room_id) === room._row_id && isPresenceOnline(p, now)
                    ).length;
                    return (
                      <Card key={room._row_id}>
                        <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{room.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                              <span>
                                {room.type === "private" ? "Private" : "Public"}
                                {Number(room.is_voice) === 1 ? " voice room" : ""} · Room #{room._row_id}
                              </span>
                              {inRoom > 0 && (
                                <span className="inline-flex items-center gap-1 text-emerald-500">
                                  · <Wifi className="w-3 h-3" /> {inRoom} in room
                                </span>
                              )}
                              {room.type === "private" && (
                                <span className="inline-flex items-center gap-1">
                                  · Code:
                                  <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">
                                    {revealed[room._row_id] ? room.code : "••••••"}
                                  </code>
                                  <button
                                    type="button"
                                    className="text-muted-foreground hover:text-foreground"
                                    aria-label={revealed[room._row_id] ? "Hide room code" : "Show room code"}
                                    onClick={() =>
                                      setRevealed((prev) => ({ ...prev, [room._row_id]: !prev[room._row_id] }))
                                    }
                                  >
                                    {revealed[room._row_id] ? (
                                      <EyeOff className="w-4 h-4" />
                                    ) : (
                                      <Eye className="w-4 h-4" />
                                    )}
                                  </button>
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleOpenRoom(room)}>
                              <DoorOpen className="w-4 h-4 mr-2" /> Open room
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteRoom(room)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {rooms.length === 0 && <p className="text-sm text-muted-foreground">No rooms yet.</p>}
                </div>
              </>
            )}
          </TabsContent>

          {/* LIVE */}
          <TabsContent value="live" className="space-y-4 mt-4">
            {withSignIn(
              <>
                <Card>
                  <CardContent className="py-4 space-y-3">
                    <Label>Watch a room live</Label>
                    <div className="flex gap-2 flex-wrap items-center">
                      <Select value={liveRoom} onValueChange={setLiveRoom}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Pick a room" />
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.map((room) => (
                            <SelectItem key={room._row_id} value={String(room._row_id)}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={loadLive}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh now
                      </Button>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Wifi className="w-3.5 h-3.5" /> auto-refreshes every few seconds
                      </span>
                    </div>
                    {!liveRoom && <p className="text-xs text-muted-foreground">No rooms exist yet.</p>}
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Messages — {liveRoomName}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
                      {liveMessages.map((message) => (
                        <div
                          key={message._row_id}
                          className="flex items-start justify-between gap-2 border-b border-white/5 pb-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">@{message.sender_name}</span>{" "}
                              · {fmtTime(message._created_at)}
                              {message.impersonated_by && (
                                <Badge variant="secondary" className="ml-2 h-4 px-1.5">
                                  sent as
                                </Badge>
                              )}
                            </p>
                            <p className="text-sm break-words">{message.content}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteMessage(message)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {liveMessages.length === 0 && (
                        <p className="text-sm text-muted-foreground">No messages in this room yet.</p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Wifi className="w-4 h-4" /> Typing right now
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {liveTyping.map((t) => (
                          <div key={t._row_id} className="text-sm border-b border-white/5 pb-2">
                            <span className="font-semibold">@{t.username}</span>
                            <span className="text-muted-foreground"> is writing: </span>
                            <span className="italic break-words">"{t.draft}"</span>
                          </div>
                        ))}
                        {liveTyping.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Nobody is typing at the moment.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Send a message as someone else</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="as-user">Send as (username)</Label>
                          <Input
                            id="as-user"
                            placeholder="username"
                            value={asUser}
                            onChange={(e) => setAsUser(e.target.value.toLowerCase())}
                          />
                          {suggestUsers.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {suggestUsers.slice(0, 8).map((u) => (
                                <button
                                  key={u}
                                  type="button"
                                  className="text-xs bg-secondary px-2 py-1 rounded hover:bg-secondary/70"
                                  onClick={() => setAsUser(u)}
                                >
                                  @{u}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="as-text">Their message</Label>
                          <Input
                            id="as-text"
                            placeholder="What they 'say'…"
                            value={asText}
                            onChange={(e) => setAsText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendAs()}
                            maxLength={2000}
                          />
                        </div>
                        <Button onClick={handleSendAs} disabled={asBusy || !asUser.trim() || !asText.trim()}>
                          {asBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                          Send as @{asUser.trim() || "user"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          The message appears in the room under that person's name, exactly like
                          their own messages.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* CALLS */}
          <TabsContent value="calls" className="space-y-4 mt-4">
            <Card>
              <CardContent className="py-3 text-xs text-muted-foreground">
                Every live voice and video call right now. Watching joins silently — the people in
                the call aren't told you're there. Only the site owner can start calls in public
                rooms; anyone can start one in a private room or a direct message.
              </CardContent>
            </Card>
            {calls.length === 0 && (
              <p className="text-sm text-muted-foreground py-2">No live calls right now.</p>
            )}
            {calls.map((call) => {
              const parts = callParts.filter((p) => p.call_id === call._row_id);
              const roomLabel = call.room_id !== null ? roomName(call.room_id) : null;
              const pair = call.dm_pair ? splitPairKey(call.dm_pair) : null;
              const label = roomLabel
                ? `${roomLabel} — room call`
                : pair
                  ? `${pair[0]} & ${pair[1]} — private call`
                  : "Call";
              return (
                <Card key={call._row_id}>
                  <CardContent className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="font-semibold truncate flex items-center gap-2">
                          <VideoIcon className="w-4 h-4 text-primary shrink-0" />
                          {label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Started by @{call.started_by} · {fmtTime(call.started_at)} ·{" "}
                          {call.type === "dm"
                            ? "direct message"
                            : call.type === "private-room"
                              ? "private room"
                              : "public room"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOwner && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setWatchCall({ callId: call._row_id, label })}
                          >
                            <Eye className="w-4 h-4 mr-2" /> Watch
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={endingCallId === call._row_id}
                          onClick={async () => {
                            setEndingCallId(call._row_id);
                            try {
                              await endCall(call._row_id);
                              toast({ title: "Call ended" });
                            } catch {
                              toast({ title: "Couldn't end the call", variant: "destructive" });
                            } finally {
                              setEndingCallId(null);
                            }
                          }}
                        >
                          End
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {parts.length === 0 && (
                        <span className="text-xs text-muted-foreground">Nobody connected right now.</span>
                      )}
                      {parts.map((p) => (
                        <Badge
                          key={p._row_id}
                          variant={Number(p.hidden) === 1 ? "outline" : "secondary"}
                          className="gap-1"
                        >
                          @{p.username}
                          {Number(p.hidden) === 1 && <Eye className="w-3 h-3" />}
                          {Number(p.muted) === 1 && <MicOff className="w-3 h-3 text-red-400" />}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* MESSAGES */}
          <TabsContent value="messages" className="space-y-4 mt-4">
            {withSignIn(
              <>
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
                            {message.impersonated_by && (
                              <Badge variant="secondary" className="ml-2 h-4 px-1.5">
                                sent as
                              </Badge>
                            )}
                          </p>
                          <p className="text-sm break-words">{message.content}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRoomById(message.room_id)}
                            aria-label={`Open ${roomName(message.room_id)}`}
                          >
                            <DoorOpen className="w-4 h-4" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDeleteMessage(message)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredMessages.length === 0 && (
                    <p className="text-sm text-muted-foreground">No messages found.</p>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* ACCOUNTS */}
          <TabsContent value="accounts" className="space-y-4 mt-4">
            {withOwner(
              <>
                {ownerDataError && (
                  <Card>
                    <CardContent className="py-3 text-sm text-destructive">{ownerDataError}</CardContent>
                  </Card>
                )}
                <Card>
                  <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
                    Every account created on the site, with live online status. Each
                    account's password is recorded when they sign up or sign in — use the
                    eye button to view it, or the key button to reset it.
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {accounts.map((acct) => (
                    <Card key={acct.userId}>
                      <CardContent className="py-3 flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-semibold truncate flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                                acct.online ? "bg-emerald-500" : "bg-muted-foreground/40"
                              }`}
                            />
                            @{acct.username}
                            <Badge
                              className={acct.online ? "bg-emerald-600" : ""}
                              variant={acct.online ? "default" : "secondary"}
                            >
                              {acct.online ? "online" : "offline"}
                            </Badge>
                            {bannedUsernames.has(acct.username) && <Badge variant="destructive">banned</Badge>}
                            {lockedUsernames.has(acct.username) && (
                              <Badge className="bg-amber-600">locked</Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground break-words">
                            {acct.name || "No name"} · {acct.email ?? "email hidden"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Joined {fmtTime(acct.joined)}
                            {acct.lastIp ? ` · Last IP ${acct.lastIp}` : ""}
                            {acct.online && acct.roomId ? ` · In ${roomName(acct.roomId)}` : ""}
                            {!acct.online && acct.lastSeen ? ` · Last active ${fmtTime(acct.lastSeen)}` : ""}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono break-all">
                            Password: {" "}
                            {acct.password
                              ? revealedPasswords.has(acct.username)
                                ? acct.password
                                : "•".repeat(Math.min(acct.password.length, 12))
                              : "not captured yet — appears after their next sign-in"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/profile/${acct.username}`)}
                          >
                            Profile
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Sign them out — they'll have to log in again"
                            disabled={kickingUser === acct.username}
                            onClick={() => handleKickAccount(acct.username)}
                          >
                            {kickingUser === acct.username ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <LogOut className="w-4 h-4 mr-2" />
                            )}
                            Kick
                          </Button>
                          {isOwner && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDiagUser(acct.username)}
                            >
                              Diagnostics
                            </Button>
                          )}
                          {isOwner && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setMakeAdminTarget(acct.username)}
                            >
                              <UserCog className="w-4 h-4 mr-2" /> Make admin
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/dm/${acct.username}`)}
                          >
                            Message
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`${revealedPasswords.has(acct.username) ? "Hide" : "Show"} ${acct.username}'s password`}
                            title={revealedPasswords.has(acct.username) ? "Hide password" : "Show password"}
                            disabled={!acct.password}
                            onClick={() => togglePassword(acct.username)}
                          >
                            {revealedPasswords.has(acct.username) ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label={`Reset ${acct.username}'s password`}
                            title="Reset password"
                            onClick={() => openResetPassword(acct.userId, acct.username)}
                          >
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          {lockedUsernames.has(acct.username) ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={lockBusy}
                              onClick={() => handleUnlockAccount(acct.username)}
                            >
                              <LockOpen className="w-4 h-4 mr-2" /> Unlock
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setLockTarget(acct.username)}>
                              <Lock className="w-4 h-4 mr-2" /> Lock
                            </Button>
                          )}
                          {bannedUsernames.has(acct.username) ? (
                            <Button variant="outline" size="sm" onClick={() => handleUnban(acct.username)}>
                              Unban
                            </Button>
                          ) : (
                            <Button variant="destructive" size="sm" onClick={() => handleBanUser(acct.username)}>
                              <BanIcon className="w-4 h-4 mr-2" /> Ban
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deletingAccount === acct.userId}
                            onClick={() => handleDeleteAccount(acct.userId, acct.username)}
                          >
                            {deletingAccount === acct.userId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {accounts.length === 0 && (
                    <p className="text-sm text-muted-foreground">No accounts yet.</p>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* IP LOGS */}
          <TabsContent value="ips" className="space-y-4 mt-4">
            {withOwner(
              <>
                <Card>
                  <CardContent className="py-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      IP address recorded automatically when someone signs in or creates an account
                      (refreshed every few hours while they're active).
                    </p>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by username, email, or IP…"
                        value={ipFilter}
                        onChange={(e) => setIpFilter(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {filteredIps.slice(0, 200).map((row) => (
                    <Card key={row._row_id}>
                      <CardContent className="py-3 space-y-1">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <p className="text-sm">
                            <span className="font-semibold">@{row.username || "unknown"}</span>
                            {row.email ? ` · ${row.email}` : ""}
                          </p>
                          <code className="font-mono text-sm bg-secondary px-2 py-1 rounded">{row.ip}</code>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {fmtTime(Number(row._created_at))} · {row.user_agent?.slice(0, 90) ?? "unknown device"}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredIps.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {ips.length === 0
                        ? "No IP records yet — they appear the next time someone signs in."
                        : "No records match that search."}
                    </p>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* BANS */}
          <TabsContent value="bans" className="space-y-4 mt-4">
            {withSignIn(
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ban a user by username</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <Input
                        placeholder="username"
                        value={banInput}
                        onChange={(e) => setBanInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleBanUser(banInput)}
                        className="flex-1 min-w-40"
                      />
                      <Input
                        type="number"
                        min={1}
                        value={banUnit === "forever" ? "" : banAmount}
                        disabled={banUnit === "forever"}
                        onChange={(e) => setBanAmount(e.target.value)}
                        placeholder="30"
                        className="w-24"
                        aria-label="Ban length"
                      />
                      <Select value={banUnit} onValueChange={setBanUnit}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="seconds">seconds</SelectItem>
                          <SelectItem value="minutes">minutes</SelectItem>
                          <SelectItem value="hours">hours</SelectItem>
                          <SelectItem value="days">days</SelectItem>
                          <SelectItem value="forever">forever</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="destructive" onClick={() => handleBanUser(banInput)} disabled={!banInput.trim()}>
                        <BanIcon className="w-4 h-4 mr-2" /> Ban
                      </Button>
                    </div>
                    <Input
                      placeholder="Reason (optional — shown to the user)"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Bans are tied to the device too — a new account from the same device gets
                      permanently banned for evasion automatically.
                    </p>
                  </CardContent>
                </Card>
                <div className="space-y-2">
                  {bans.map((ban) => {
                    const duration = Number(ban.ban_duration ?? 0);
                    const permanent = duration <= 0;
                    const untilMs = permanent ? null : (Number(ban._created_at) + duration) * 1000;
                    const active = permanent || (untilMs ?? 0) > Date.now();
                    return (
                      <Card key={ban._row_id}>
                        <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="font-semibold flex items-center gap-2 flex-wrap">
                              @{ban.username}
                              <Badge variant={active ? "destructive" : "secondary"}>
                                {active ? (permanent ? "permanent" : "active") : "expired"}
                              </Badge>
                              {ban.source === "auto" && <Badge variant="outline">auto</Badge>}
                              {ban.tier != null && Number(ban.tier) > 0 && (
                                <Badge variant="outline">tier {ban.tier}</Badge>
                              )}
                              {ban.device_id && <Badge variant="outline">device</Badge>}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Banned {fmtTime(Number(ban._created_at))}
                              {!permanent && untilMs ? ` · lifts ${fmtTime(untilMs / 1000)}` : ""}
                              {ban.reason ? ` · ${ban.reason}` : ""}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleUnban(ban.username)}>
                            Unban
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {bans.length === 0 && <p className="text-sm text-muted-foreground">No bans yet.</p>}
                </div>
              </>
            )}
          </TabsContent>

          {/* MODERATION */}
          <TabsContent value="moderation" className="space-y-4 mt-4">
            {withSignIn(<AdminModeration />)}
          </TabsContent>

          {/* BANNABLE WORDS */}
          <TabsContent value="words" className="mt-4">
            <AdminWordList />
          </TabsContent>

          {/* REPORTS */}
          <TabsContent value="reports" className="space-y-4 mt-4">
            {withSignIn(
              <>
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
              </>
            )}
          </TabsContent>

          {/* SUGGESTIONS */}
          <TabsContent value="suggestions" className="space-y-4 mt-4">
            {withSignIn(
              <>
                <div className="space-y-2">
                  {suggestions.map((suggestion) => (
                    <Card key={suggestion._row_id}>
                      <CardContent className="py-3 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm break-words">
                              <Lightbulb className="w-4 h-4 inline mr-1 text-yellow-500" />
                              {suggestion.content}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              From @{suggestion.username} · {fmtTime(suggestion._created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {suggestion.status === "replied" && (
                              <Badge variant="secondary">Replied</Badge>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteSuggestion(suggestion)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {suggestion.status === "replied" && suggestion.admin_reply && (
                          <div className="rounded-lg bg-secondary/60 border p-3 space-y-1">
                            <p className="text-xs font-semibold">
                              Your reply{suggestion.replied_by ? ` — ${suggestion.replied_by}` : ""}
                              {suggestion.replied_at ? ` · ${fmtTime(Number(suggestion.replied_at))}` : ""}
                            </p>
                            <p className="text-sm break-words">{suggestion.admin_reply}</p>
                          </div>
                        )}
                        <div className="space-y-2">
                          <Textarea
                            placeholder={
                              suggestion.status === "replied"
                                ? "Send another reply…"
                                : "Reply to this person — tell them what you did with the idea…"
                            }
                            value={replyDraft[suggestion._row_id] ?? ""}
                            onChange={(e) =>
                              setReplyDraft((prev) => ({ ...prev, [suggestion._row_id]: e.target.value }))
                            }
                            className="min-h-[70px] bg-secondary/50"
                          />
                          <Button
                            size="sm"
                            disabled={replyBusy === suggestion._row_id || !(replyDraft[suggestion._row_id] ?? "").trim()}
                            onClick={() => handleReplySuggestion(suggestion)}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {replyBusy === suggestion._row_id ? "Sending…" : "Send reply"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {suggestions.length === 0 && <p className="text-sm text-muted-foreground">No suggestions.</p>}
                </div>
              </>
            )}
          </TabsContent>

          {/* DOWNTIME */}
          <TabsContent value="downtime" className="space-y-4 mt-4">
            {withSignIn(
              <>
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
                {isOwner && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Testing mode {settings.testing_mode_enabled === true ? "— ON" : ""}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={settings.testing_mode_enabled === true}
                          onCheckedChange={(v) => void updateSetting("testing_mode_enabled", v)}
                          aria-label="Toggle testing mode"
                        />
                        <span className="text-sm font-medium">
                          {settings.testing_mode_enabled === true
                            ? "Testing mode is ON — the site is closed to everyone else"
                            : "Testing mode is off"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        While it's on, only you and the admin usernames listed below can open the
                        site — everyone else sees a "we're testing" page until you switch it off.
                        Sign-in and admin pages stay reachable so you can get back in.
                      </p>
                      <div className="space-y-1">
                        <Label htmlFor="testing-admins">Admins allowed in while testing</Label>
                        <Textarea
                          id="testing-admins"
                          placeholder="admin usernames, comma separated"
                          value={testingAdmins}
                          onChange={(e) => setTestingAdmins(e.target.value)}
                          className="min-h-[60px] bg-secondary/50"
                        />
                        <Button
                          size="sm"
                          disabled={testingSaving}
                          onClick={async () => {
                            setTestingSaving(true);
                            try {
                              await updateSetting("testing_allowed_admins", testingAdmins);
                              toast({
                                title: "Saved",
                                description: "These admins can enter the site while testing mode is on.",
                              });
                            } finally {
                              setTestingSaving(false);
                            }
                          }}
                        >
                          {testingSaving ? "Saving…" : "Save allowed admins"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
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
              </>
            )}
          </TabsContent>

          {/* SETTINGS */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            {withOwner(
              <>
                <Card>
                  <CardContent className="py-3 text-xs text-muted-foreground">
                    These settings control the live site — every change applies instantly to what
                    your users see. {settingsLoaded ? "" : "Loading current values…"}
                  </CardContent>
                </Card>

                {SETTING_GROUPS.map((group) => (
                  <Card key={group}>
                    <CardHeader>
                      <CardTitle className="text-base">{group}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {SETTING_DEFS.filter(
                        (def) =>
                          def.group === group &&
                          def.key !== "rules_text" &&
                          def.key !== "terms_text",
                      ).map((def) => (
                        <div key={def.key} className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{def.label}</p>
                            <p className="text-xs text-muted-foreground">{def.description}</p>
                          </div>
                          <div className="shrink-0">
                            {def.type === "toggle" ? (
                              <Switch
                                checked={settings[def.key] === true}
                                onCheckedChange={(v) => handleSettingChange(def.key, v)}
                              />
                            ) : def.type === "number" ? (
                              <Input
                                key={`${def.key}-${String(settings[def.key])}`}
                                type="number"
                                className="w-24"
                                min={def.min}
                                max={def.max}
                                defaultValue={String(settings[def.key])}
                                onBlur={(e) => {
                                  const n = Number(e.target.value);
                                  if (Number.isFinite(n) && n !== Number(settings[def.key])) {
                                    handleSettingChange(def.key, n);
                                  }
                                }}
                              />
                            ) : (
                              <Input
                                key={`${def.key}-${String(settings[def.key])}`}
                                className="w-64 max-w-full"
                                maxLength={300}
                                defaultValue={String(settings[def.key])}
                                placeholder={String(def.default)}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v !== String(settings[def.key])) {
                                    handleSettingChange(def.key, v);
                                  }
                                }}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Message auto-clear</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {purgeInfo
                        ? `Last cleanup deleted ${purgeInfo.count} room message(s) at ${fmtTime(purgeInfo.at)}. Runs every hour.`
                        : "The hourly cleanup hasn't run yet. Room messages older than your setting above will be cleared; private messages are never deleted."}
                    </p>
                    <Button variant="outline" onClick={handleRunPurgeNow} disabled={purgeBusy}>
                      {purgeBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eraser className="w-4 h-4 mr-2" />}
                      Run cleanup now
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent owner actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {audit.map((row) => (
                      <div key={row._row_id} className="text-sm border-b border-white/5 pb-2">
                        <span className="font-medium capitalize">{row.action.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {row.target} · by {row.actor_email ?? "owner"}
                        </span>
                        <p className="text-xs text-muted-foreground">{fmtTime(Number(row._created_at))}</p>
                      </div>
                    ))}
                    {audit.length === 0 && (
                      <p className="text-sm text-muted-foreground">No owner actions recorded yet.</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* FILES */}
          <TabsContent value="files" className="space-y-4 mt-4">
            {can("files") ? <AdminFiles /> : NoPermission}
          </TabsContent>

          {/* DIRECT MESSAGES */}
          <TabsContent value="dms" className="space-y-4 mt-4">
            {can("dms") ? withSignIn(<AdminDirectMessages />) : NoPermission}
          </TabsContent>

          {/* NOTIFICATIONS */}
          <TabsContent value="notifications" className="space-y-4 mt-4">
            {can("notifications") ? <AdminNotifications /> : NoPermission}
          </TabsContent>

          {/* UPDATES — version notices + "everyone reload" broadcast */}
          <TabsContent value="updates" className="space-y-4 mt-4">
            {can("notifications") ? (
              <AdminVersionNotices isOwner={isOwner} adminUsername={adminSession?.username ?? ""} />
            ) : (
              NoPermission
            )}
          </TabsContent>

          {/* ADMINS */}
          <TabsContent value="admins" className="space-y-4 mt-4">
            {can("admins") ? <AdminManagers ownerEmail={session?.email ?? null} /> : NoPermission}
          </TabsContent>

          {/* DOWNLOAD */}
          <TabsContent value="download" className="space-y-4 mt-4">
            {isOwner ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Download website code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This downloads a ZIP file with this website's complete source code — every page,
                  component, style, and the database setup.
                </p>
                <span onClick={downloadWebsiteZip}>
                  <Button size="lg">
                    <Download className="w-4 h-4 mr-2" /> Download Website (.zip)
                  </Button>
                </span>
                <p className="text-xs text-muted-foreground">
                  Snapshot generated {WEBSITE_SNAPSHOT_DATE}. If the site changes after that, ask for
                  a fresh snapshot and this button will download the newest code.
                </p>
              </CardContent>
            </Card>
            ) : NoPermission}
          </TabsContent>

          {/* AI (beta) */}
          <TabsContent value="ai" className="space-y-4 mt-4">
            <AdminAI />
          </TabsContent>

          {/* ONLINE NOW — who's on the site this minute */}
          <TabsContent value="online" className="space-y-4 mt-4">
            {can("live") ? <AdminOnlineNow /> : NoPermission}
          </TabsContent>

          {/* THEME — the site's color of the day */}
          <TabsContent value="theme" className="space-y-4 mt-4">
            {can("settings") ? <AdminTheme /> : NoPermission}
          </TabsContent>

          {/* HEALTH — quick is-everything-working check */}
          <TabsContent value="health" className="space-y-4 mt-4">
            {can("settings") ? <AdminHealth /> : NoPermission}
          </TabsContent>

          {/* APPEALS — ban appeals review */}
          <TabsContent value="appeals" className="space-y-4 mt-4">
            {can("people") ? withSignIn(<AdminAppeals />) : NoPermission}
          </TabsContent>

          {/* ANALYTICS — real usage charts */}
          <TabsContent value="analytics" className="space-y-4 mt-4">
            {can("analytics") ? <AdminAnalytics /> : NoPermission}
          </TabsContent>

          {/* MESSAGE SEARCH — search every room message */}
          <TabsContent value="search" className="space-y-4 mt-4">
            {can("messages") ? withSignIn(<AdminMessageSearch />) : NoPermission}
          </TabsContent>

          {/* AUDIT LOG — owner only */}
          <TabsContent value="audit" className="space-y-4 mt-4">
            {isOwner ? <AdminAuditLog /> : NoPermission}
          </TabsContent>

          {/* ROOM EDITOR — rename rooms, flip voice, new codes */}
          <TabsContent value="roomeditor" className="space-y-4 mt-4">
            {can("rooms") ? <AdminRoomEditor /> : NoPermission}
          </TabsContent>

          {/* EMPTY ROOMS — clean up unused rooms */}
          <TabsContent value="emptyrooms" className="space-y-4 mt-4">
            {can("rooms") ? <AdminEmptyRooms /> : NoPermission}
          </TabsContent>

          {/* ACTIVITY FEED — everything happening, one stream */}
          <TabsContent value="activityfeed" className="space-y-4 mt-4">
            {can("live") ? <AdminActivityFeed /> : NoPermission}
          </TabsContent>

          {/* CALL HISTORY — past calls and who joined */}
          <TabsContent value="callhistory" className="space-y-4 mt-4">
            {can("calls") ? <AdminCallHistory /> : NoPermission}
          </TabsContent>

          {/* MESSAGE CLEANUP — purge old messages, clear a room */}
          <TabsContent value="cleanup" className="space-y-4 mt-4">
            {can("messages") ? <AdminMessageCleanup /> : NoPermission}
          </TabsContent>

          {/* TOP CHATTERS — leaderboard */}
          <TabsContent value="topchatters" className="space-y-4 mt-4">
            {can("analytics") ? <AdminTopChatters /> : NoPermission}
          </TabsContent>

          {/* ROOM INSIGHTS — traffic per room */}
          <TabsContent value="roominsights" className="space-y-4 mt-4">
            {can("analytics") ? <AdminRoomInsights /> : NoPermission}
          </TabsContent>

          {/* SIGNUP TRENDS — new accounts per day */}
          <TabsContent value="signuptrends" className="space-y-4 mt-4">
            {can("analytics") ? <AdminSignupTrends /> : NoPermission}
          </TabsContent>

          {/* DM STATS — busiest pairs and file totals */}
          <TabsContent value="dmstats" className="space-y-4 mt-4">
            {can("dms") ? <AdminDmStats /> : NoPermission}
          </TabsContent>

          {/* USER SEARCH — find by username, name, or IP */}
          <TabsContent value="usersearch" className="space-y-4 mt-4">
            {can("accounts") ? <AdminUserSearch /> : NoPermission}
          </TabsContent>

          {/* LOCKS — temporary account lockouts */}
          <TabsContent value="locks" className="space-y-4 mt-4">
            {can("accounts") ? <AdminLocksTable /> : NoPermission}
          </TabsContent>

          {/* KICK LOG — who was force-signed-out */}
          <TabsContent value="kicklog" className="space-y-4 mt-4">
            {can("accounts") ? <AdminKickLog /> : NoPermission}
          </TabsContent>

          {/* DATA EXPORT — CSV downloads */}
          <TabsContent value="dataexport" className="space-y-4 mt-4">
            {can("accounts") ? <AdminDataExport /> : NoPermission}
          </TabsContent>

          {/* IP INSIGHTS — shared-IP detection */}
          <TabsContent value="ipinsights" className="space-y-4 mt-4">
            {can("ips") ? <AdminIpInsights /> : NoPermission}
          </TabsContent>

          {/* WORD TESTER — try the ban rules */}
          <TabsContent value="wordtester" className="space-y-4 mt-4">
            {can("people") ? <AdminWordTester /> : NoPermission}
          </TabsContent>

          {/* BIOS — review and clear profile bios */}
          <TabsContent value="bios" className="space-y-4 mt-4">
            {can("people") ? <AdminBios /> : NoPermission}
          </TabsContent>

          {/* FRIENDS — see and remove friendships */}
          <TabsContent value="friends" className="space-y-4 mt-4">
            {can("social") ? <AdminFriendsManager /> : NoPermission}
          </TabsContent>

          {/* IMPORTANT NOTICES — the big banners */}
          <TabsContent value="important" className="space-y-4 mt-4">
            {can("notifications") ? (
              <AdminImportantNotices createdBy={session?.username ?? "admin"} />
            ) : (
              NoPermission
            )}
          </TabsContent>

          {/* ANNOUNCEMENT STATS — who read what */}
          <TabsContent value="notifstats" className="space-y-4 mt-4">
            {can("notifications") ? <AdminAnnouncementStats /> : NoPermission}
          </TabsContent>

          {/* POLLS — create polls, watch results */}
          <TabsContent value="polls" className="space-y-4 mt-4">
            {can("polls") ? <AdminPolls createdBy={session?.username ?? "admin"} /> : NoPermission}
          </TabsContent>

          {/* SITE INFO — home-screen text */}
          <TabsContent value="siteinfo" className="space-y-4 mt-4">
            {can("settings") ? <AdminSiteInfo /> : NoPermission}
          </TabsContent>

          {/* TERMS — edit the Terms of Use */}
          <TabsContent value="terms" className="space-y-4 mt-4">
            {can("settings") ? <AdminTermsEditor /> : NoPermission}
          </TabsContent>

          {/* MAINTENANCE — safe cleanups */}
          <TabsContent value="maintenance" className="space-y-4 mt-4">
            {can("settings") ? <AdminMaintenance /> : NoPermission}
          </TabsContent>
        </Tabs>
      </main>

      {/* RESET PASSWORD DIALOG */}
      <Dialog open={lockTarget !== null} onOpenChange={(open) => !open && setLockTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock @{lockTarget} out of their account?</DialogTitle>
            <DialogDescription>
              They&apos;ll see a &quot;temporarily locked&quot; screen instead of the site — handy while
              you fix something on their account. This is not a ban, and you can unlock them any
              time from this same tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lock-reason">Reason (shown to them)</Label>
            <Input
              id="lock-reason"
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              placeholder="Fixing something on your account — back soon"
              maxLength={300}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLockTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={lockBusy}
              onClick={() => lockTarget && handleLockAccount(lockTarget)}
            >
              {lockBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
              Lock account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pwTarget !== null} onOpenChange={(open) => !open && setPwTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset @{pwTarget?.username}'s password</DialogTitle>
            <DialogDescription>
              Sets a brand-new password for this account. Their old password stops working
              immediately. Use this to help someone who forgot theirs, or to take back an account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="flex gap-2">
                <Input
                  id="new-password"
                  value={pwValue}
                  onChange={(e) => setPwValue(e.target.value)}
                  minLength={8}
                  maxLength={128}
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setPwValue(suggestPassword())}
                >
                  Suggest
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            {pwDone && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 space-y-2">
                <p className="text-sm">
                  New password for <span className="font-semibold">@{pwTarget?.username}</span>:
                </p>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm bg-secondary px-2 py-1 rounded break-all">
                    {pwDone}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard?.writeText(pwDone).then(
                        () => toast({ title: "Copied" }),
                        () => undefined
                      );
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy it somewhere safe — it's shown only once.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwTarget(null)}>
              Close
            </Button>
            <Button onClick={handleResetPassword} disabled={pwBusy || pwValue.length < 8}>
              {pwBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MakeAdminDialog
        username={makeAdminTarget}
        ownerEmail={session?.email ?? null}
        onClose={() => setMakeAdminTarget(null)}
        onDone={loadAll}
      />
      <UserDiagnostics username={diagUser} onClose={() => setDiagUser(null)} />
      {watchCall && (session?.username ?? "owner") && (
        <CallStage
          callId={watchCall.callId}
          me={session?.username ?? "owner"}
          label={watchCall.label}
          hidden
          onLeave={() => setWatchCall(null)}
        />
      )}
    </div>
  );
};

export default AdminPanel;
