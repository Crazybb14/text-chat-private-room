export const ADMIN_ABILITIES = [
  { key: "rooms", label: "Rooms", description: "Create, open, and delete chat rooms" },
  { key: "live", label: "Live monitor", description: "Watch rooms live and send messages as users" },
  { key: "messages", label: "Messages", description: "Browse and delete room messages" },
  { key: "files", label: "Files", description: "Approve or delete every shared file" },
  { key: "dms", label: "Direct messages", description: "Read every private conversation" },
  { key: "accounts", label: "Accounts", description: "See every account on the site" },
  { key: "ips", label: "IP logs", description: "See IP addresses and sign-in history" },
  { key: "people", label: "Bans & reports", description: "Ban or unban users and handle reports" },
  { key: "calls", label: "Calls", description: "Watch and end voice and video calls" },
  { key: "notifications", label: "Send notifications", description: "Broadcast announcements to everyone" },
  { key: "downtime", label: "Downtime", description: "Take the site down for maintenance" },
  { key: "settings", label: "Site settings", description: "Change site-wide settings" },
  { key: "polls", label: "Polls", description: "Create polls and see live results" },
  { key: "social", label: "Friends & bios", description: "See friendships and clear profile bios" },
  { key: "analytics", label: "Analytics", description: "Usage charts, leaderboards, and trends" },
] as const;

export type AbilityKey = (typeof ADMIN_ABILITIES)[number]["key"];
export type PermissionKey = AbilityKey | "admins";

export type Permissions = Partial<Record<PermissionKey, boolean>>;

export interface AdminSession {
  username: string;
  permissions: Permissions;
}

/** Everything, used for the site owner. */
export function allPermissions(): Permissions {
  const out: Permissions = { admins: true };
  for (const ability of ADMIN_ABILITIES) out[ability.key] = true;
  return out;
}

/** Accepts unknown JSON from the database and keeps only real ability keys. */
export function parsePermissions(raw: unknown): Permissions {
  const out: Permissions = {};
  if (typeof raw !== "object" || raw === null) return out;
  const record = raw as Record<string, unknown>;
  for (const ability of ADMIN_ABILITIES) {
    if (record[ability.key] === true) out[ability.key] = true;
  }
  return out;
}

export function permissionsToText(permissions: Permissions): string {
  return JSON.stringify(permissions);
}

/** The owner can always do everything; admins only what they were granted. */
export function canDo(permissions: Permissions, key: PermissionKey, isOwner: boolean): boolean {
  if (isOwner) return true;
  return permissions[key] === true;
}

const ADMIN_SESSION_KEY = "admin_session";

export function getAdminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { username?: unknown; permissions?: unknown };
    if (typeof parsed.username !== "string" || !parsed.username) return null;
    return { username: parsed.username, permissions: parsePermissions(parsed.permissions) };
  } catch {
    return null;
  }
}

export function saveAdminSession(session: AdminSession): void {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession(): void {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

/** Short invite code the new admin uses to set their password the first time. */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}
