/**
 * Testing mode: while it's on, only the site owner and a chosen list of
 * admins may use the site. Everyone else sees a "we're testing" screen.
 */

export interface TestingAccessInput {
  testingOn: boolean;
  isOwner: boolean;
  /** Signed-in staff session username (admin accounts), if any. */
  adminUsername: string | null;
  /** Signed-in chat account username, if any. */
  accountUsername: string | null;
  /** Comma-separated admin usernames allowed in while testing. */
  allowedList: string;
}

/** Paths everyone can still reach while testing (sign-in and admin tools). */
export const TESTING_ALWAYS_OPEN = ["/login", "/admin", "/admin/panel", "/terms", "/appeal"];

export function parseAllowedAdmins(list: string): string[] {
  return list
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function testingAccessAllowed(
  input: TestingAccessInput,
  path: string
): "open" | "testing-closed" {
  if (!input.testingOn) return "open";
  const pathOpen = TESTING_ALWAYS_OPEN.some(
    (open) => path === open || path.startsWith(`${open}/`)
  );
  if (pathOpen) return "open";
  if (input.isOwner) return "open";
  const allowed = new Set(parseAllowedAdmins(input.allowedList));
  const admin = (input.adminUsername ?? "").trim().toLowerCase();
  const account = (input.accountUsername ?? "").trim().toLowerCase();
  if (admin && allowed.has(admin)) return "open";
  if (account && allowed.has(account)) return "open";
  return "testing-closed";
}
