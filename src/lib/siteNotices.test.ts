import { describe, expect, it } from "vitest";
import {
  isActiveLock,
  isPublicNotice,
  isValidVersion,
  nextVersion,
  shouldShowReload,
  type AccountLockRow,
  type VersionNotice,
} from "./siteNotices";

const lock = (over: Partial<AccountLockRow> = {}): AccountLockRow => ({
  _row_id: 1,
  username: "sam",
  reason: "",
  locked_by: "owner",
  locked_at: 1000,
  unlocked_at: null,
  ...over,
});

describe("isValidVersion", () => {
  it("accepts plain numbers and dotted versions", () => {
    expect(isValidVersion("2")).toBe(true);
    expect(isValidVersion("2.1")).toBe(true);
    expect(isValidVersion("2.1.3")).toBe(true);
  });

  it("rejects words, spaces, and empty input", () => {
    expect(isValidVersion("")).toBe(false);
    expect(isValidVersion("v2.1")).toBe(false);
    expect(isValidVersion("2.1 beta")).toBe(false);
    expect(isValidVersion("1..2")).toBe(false);
  });
});

// @kliv-spec-derived — from user intent: "make sure there's a version number"
describe("nextVersion", () => {
  it("bumps the patch number of the latest notice", () => {
    expect(nextVersion("1.4.2")).toBe("1.4.3");
    expect(nextVersion("2.0")).toBe("2.1");
    expect(nextVersion("3")).toBe("4");
  });

  it("suggests 1.0.1 when nothing has been posted yet", () => {
    expect(nextVersion(null)).toBe("1.0.1");
    expect(nextVersion("")).toBe("1.0.1");
    expect(nextVersion("banana")).toBe("1.0.1");
  });
});

// @kliv-spec-derived — from user intent: "when I do an update I click it and
// then it tells everyone to reload the website"
describe("shouldShowReload", () => {
  it("shows when the flag is newer than this page load", () => {
    expect(shouldShowReload(2000, 1000)).toBe(true);
  });

  it("hides for flags from before this page loaded (already have the update)", () => {
    expect(shouldShowReload(500, 1000)).toBe(false);
  });

  it("hides when no flag was ever set", () => {
    expect(shouldShowReload(0, 1000)).toBe(false);
  });

  it("stays hidden after the visitor dismisses it", () => {
    expect(shouldShowReload(2000, 1000, 2500)).toBe(false);
    expect(shouldShowReload(3000, 1000, 2500)).toBe(true);
  });
});

// @kliv-spec-derived — from user intent: "lock people out of their accounts…
// to fix something on their account" (a lock ends when the owner unlocks it)
describe("isActiveLock", () => {
  it("treats a lock without unlocked_at as active", () => {
    expect(isActiveLock(lock())).toBe(true);
  });

  it("treats an unlocked row as inactive", () => {
    expect(isActiveLock(lock({ unlocked_at: 2000 }))).toBe(false);
  });
});

// @kliv-spec-derived — from user intent: "the version shouldn't show
// anything that was added to the admin panel" — only public notices count
// for regular users.
describe("isPublicNotice", () => {
  it("treats unmarked and public notices as user-visible", () => {
    expect(isPublicNotice({ audience: "public" } as VersionNotice)).toBe(true);
    expect(isPublicNotice({ audience: null } as VersionNotice)).toBe(true);
    expect(isPublicNotice({} as VersionNotice)).toBe(true);
  });

  it("hides notices marked for admins", () => {
    expect(isPublicNotice({ audience: "admin" } as VersionNotice)).toBe(false);
  });
});
