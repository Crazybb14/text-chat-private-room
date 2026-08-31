import type { SessionInfo } from "./userManagement";

/**
 * Site owner logins. Kept in sync with the owner_emails setting the server
 * functions check — but the platform's own "primary team" flag is the real
 * authority whenever it is available.
 */
export const OWNER_EMAILS = ["beckettblacker@gmail.com", "hghlvtkuv@mj.com"];

export function isOwnerSession(session: SessionInfo | null | undefined): boolean {
  if (!session) return false;
  if (session.isPrimaryTeam) return true;
  const email = (session.email ?? "").trim().toLowerCase();
  return email.length > 0 && OWNER_EMAILS.includes(email);
}
