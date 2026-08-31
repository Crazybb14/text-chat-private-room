import { describe, it, expect } from "vitest";
import {
  ADMIN_ABILITIES,
  allPermissions,
  canDo,
  generateInviteCode,
  parsePermissions,
} from "./adminAccounts";

// @kliv-spec-derived — "I choose what abilities they can and can't do"
describe("parsePermissions", () => {
  it("keeps only real abilities explicitly set to true", () => {
    const parsed = parsePermissions({
      rooms: true,
      dms: true,
      messages: false,
      nonsense: true,
      roomsNotAString: "true",
    });
    expect(parsed).toEqual({ rooms: true, dms: true });
  });

  it("returns nothing for garbage input", () => {
    expect(parsePermissions(null)).toEqual({});
    expect(parsePermissions("rooms")).toEqual({});
    expect(parsePermissions(undefined)).toEqual({});
  });

  it("never grants admin management from stored JSON", () => {
    const parsed = parsePermissions({ admins: true, rooms: true });
    expect(parsed.admins).toBeUndefined();
  });
});

describe("canDo", () => {
  it("lets the owner do everything", () => {
    expect(canDo({}, "settings", true)).toBe(true);
    expect(canDo({}, "admins", true)).toBe(true);
  });

  it("lets admins do only what they were granted", () => {
    const perms = { rooms: true };
    expect(canDo(perms, "rooms", false)).toBe(true);
    expect(canDo(perms, "settings", false)).toBe(false);
    expect(canDo(perms, "admins", false)).toBe(false);
  });
});

describe("allPermissions", () => {
  it("covers every ability plus admin management", () => {
    const all = allPermissions();
    for (const ability of ADMIN_ABILITIES) expect(all[ability.key]).toBe(true);
    expect(all.admins).toBe(true);
  });
});

describe("generateInviteCode", () => {
  it("makes 8-character uppercase codes from a safe alphabet", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});
