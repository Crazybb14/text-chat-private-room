import { useEffect } from "react";
import db from "@/lib/shared/kliv-database.js";
import UserManager from "@/lib/userManagement";

export interface AccountKickRow {
  _row_id: number;
  username: string;
  kicked_by: string | null;
  kicked_at: number;
}

const SIGNED_IN_AT_KEY = "signed_in_at";
const KICK_CHECK_MS = 15000;

/**
 * Remembered right after a successful sign-in — the start of the current
 * session. A kick only applies when it happened AFTER this moment, so a
 * user who was kicked and logs back in stays logged in (no kick loop).
 */
export function markSignedInNow(): void {
  try {
    localStorage.setItem(SIGNED_IN_AT_KEY, String(Date.now()));
  } catch {
    // Private-browsing edge cases must never break sign-in
  }
}

export function getSignedInAt(): number {
  try {
    return Number(localStorage.getItem(SIGNED_IN_AT_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** A kick only counts when it happened after this session started. */
export function isKickActive(kickedAt: number, signedInAt: number): boolean {
  if (!kickedAt || kickedAt <= 0) return false;
  return kickedAt > signedInAt;
}

async function fetchLatestKickAt(username: string): Promise<number> {
  const rows = await db.query<AccountKickRow>("account_kicks", {
    username: `eq.${username.toLowerCase()}`,
    order: "kicked_at.desc",
    limit: "1",
  });
  return Number(rows[0]?.kicked_at ?? 0);
}

/**
 * Watches for an admin kick of the signed-in user. The moment a kick newer
 * than this sign-in is seen, the account is signed out and the browser is
 * sent to the login page — they have to log in again to come back.
 */
export function useKickWatch(username: string | null | undefined): void {
  useEffect(() => {
    if (!username) return;
    let stopped = false;

    const check = async () => {
      if (stopped) return;
      try {
        const kickedAt = await fetchLatestKickAt(username);
        if (stopped) return;
        if (isKickActive(kickedAt, getSignedInAt())) {
          stopped = true;
          try {
            await UserManager.signOut();
          } catch {
            // Best-effort; the redirect below still applies.
          }
          window.location.replace("/login?kicked=1");
        }
      } catch {
        // A failed check is never a reason to sign someone out.
      }
    };

    void check();
    const timer = window.setInterval(check, KICK_CHECK_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [username]);
}
