import db from "@/lib/shared/kliv-database.js";
import { functions } from "@/lib/shared/kliv-functions.js";

export interface VersionNotice {
  _row_id: number;
  version: string;
  title: string;
  body: string;
  posted_by: string | null;
  posted_at: number;
  /** "admin" notices describe admin-panel-only changes — users never see them */
  audience?: string | null;
}

export interface AccountLockRow {
  _row_id: number;
  username: string;
  reason: string;
  locked_by: string | null;
  locked_at: number;
  unlocked_at: number | null;
}

/** Extra identity an invited admin supplies to prove who they are. */
export interface AdminAuth {
  adminUsername?: string;
  adminPassword?: string;
}

export interface ReloadState {
  /** Epoch ms when the owner last asked everyone to reload (0 = never). */
  at: number;
  message: string;
}

export interface SiteStats {
  members: number;
  messages: number;
  rooms: number;
  feedback: number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Version numbers look like 1, 1.4, or 1.4.2 — nothing else. */
export function isValidVersion(version: string): boolean {
  return /^\d+(\.\d+){0,3}$/.test(version.trim());
}

/** Suggests the next patch version: 1.4.2 → 1.4.3. Unknown → 1.0.1. */
export function nextVersion(current: string | null | undefined): string {
  const match = /^(\d+(?:\.\d+){0,3})$/.exec(String(current ?? "").trim());
  if (!match) return "1.0.1";
  const parts = match[1].split(".").map((n) => Number(n));
  parts[parts.length - 1] += 1;
  return parts.join(".");
}

/**
 * The reload banner shows only when the owner's "reload" flag is newer than
 * the moment this page loaded, and newer than the last time it was dismissed.
 */
export function shouldShowReload(at: number, pageLoadedAt: number, dismissedAt = 0): boolean {
  if (!at || at <= 0) return false;
  return at > pageLoadedAt && at > dismissedAt;
}

/** A lock row counts as active until it has an unlocked_at timestamp. */
export function isActiveLock(lock: AccountLockRow): boolean {
  return lock.unlocked_at === null || lock.unlocked_at === undefined;
}

/** Only notices marked "public" (or unmarked) show up for regular users. */
export function isPublicNotice(notice: VersionNotice): boolean {
  return String(notice.audience ?? "public") !== "admin";
}

// ---------------------------------------------------------------------------
// Reads (public data)
// ---------------------------------------------------------------------------

export async function getNotices(
  limit = 20,
  opts: { includeAdminOnly?: boolean } = {}
): Promise<VersionNotice[]> {
  try {
    const rows = await db.query<VersionNotice>("version_notices", {
      order: "posted_at.desc",
      limit,
    });
    return opts.includeAdminOnly ? rows : rows.filter(isPublicNotice);
  } catch {
    return [];
  }
}

export async function getReloadState(): Promise<ReloadState> {
  try {
    const rows = await db.query<{ setting_key: string; setting_value: string | null }>(
      "admin_settings",
      { setting_key: "in.(reload_required_at,reload_required_message)" }
    );
    const at = Number(rows.find((r) => r.setting_key === "reload_required_at")?.setting_value ?? 0);
    const message = String(
      rows.find((r) => r.setting_key === "reload_required_message")?.setting_value ?? ""
    );
    return { at: Number.isFinite(at) ? at : 0, message };
  } catch {
    return { at: 0, message: "" };
  }
}

export async function getActiveLocks(): Promise<AccountLockRow[]> {
  try {
    const rows = await db.query<AccountLockRow>("account_locks", {
      order: "locked_at.desc",
    });
    return rows.filter(isActiveLock);
  } catch {
    return [];
  }
}

export async function getActiveLockFor(username: string): Promise<AccountLockRow | null> {
  if (!username) return null;
  try {
    const rows = await db.query<AccountLockRow>("account_locks", {
      username: `eq.${username.toLowerCase()}`,
      order: "locked_at.desc",
    });
    return rows.find(isActiveLock) ?? null;
  } catch {
    return null;
  }
}

/** Live site numbers for the stats section — all from the real tables. */
export async function getSiteStats(): Promise<SiteStats> {
  try {
    const [members, messages, rooms, feedback] = await Promise.all([
      db.count("user_profiles"),
      db.count("messages"),
      db.count("rooms"),
      db.count("suggestions"),
    ]);
    return { members, messages, rooms, feedback };
  } catch {
    return { members: 0, messages: 0, rooms: 0, feedback: 0 };
  }
}

// ---------------------------------------------------------------------------
// Writes (all verified server-side by site-control)
// ---------------------------------------------------------------------------

function authParams(auth?: AdminAuth): AdminAuth {
  const out: AdminAuth = {};
  if (auth?.adminUsername) out.adminUsername = auth.adminUsername;
  if (auth?.adminPassword) out.adminPassword = auth.adminPassword;
  return out;
}

interface ControlResult {
  ok?: boolean;
  error?: string;
}

async function control(payload: Record<string, unknown>): Promise<ControlResult> {
  try {
    return (await functions.post<ControlResult>("site-control", payload)) ?? {};
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return { error: message };
  }
}

export async function postNotice(
  input: { version: string; title: string; body: string; audience?: "public" | "admin" },
  auth?: AdminAuth
): Promise<ControlResult> {
  return control({ action: "post-notice", ...input, ...authParams(auth) });
}

export async function deleteNotice(noticeId: number, auth?: AdminAuth): Promise<ControlResult> {
  return control({ action: "delete-notice", noticeId, ...authParams(auth) });
}

export async function sendReloadNotice(message: string, auth?: AdminAuth): Promise<ControlResult> {
  return control({ action: "reload-notice", message, ...authParams(auth) });
}

export async function clearReloadNotice(auth?: AdminAuth): Promise<ControlResult> {
  return control({ action: "clear-reload", ...authParams(auth) });
}

export async function lockAccount(
  username: string,
  reason: string,
  auth?: AdminAuth
): Promise<ControlResult> {
  return control({ action: "lock-account", username, reason, ...authParams(auth) });
}

export async function unlockAccount(username: string, auth?: AdminAuth): Promise<ControlResult> {
  return control({ action: "unlock-account", username, ...authParams(auth) });
}

/** Kicks a user: signs them out everywhere so they must log in again. */
export async function kickAccount(username: string, auth?: AdminAuth): Promise<ControlResult> {
  return control({ action: "kick-account", username, ...authParams(auth) });
}
