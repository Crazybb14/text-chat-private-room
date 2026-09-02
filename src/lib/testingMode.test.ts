import { describe, expect, it } from "vitest";
import { parseAllowedAdmins, testingAccessAllowed } from "./testingMode";

// @kliv-spec-derived — from user intent: "a testing setting so only the owner
// or admins I select can be in the site while I test things"
describe("testingAccessAllowed", () => {
  const base = {
    testingOn: true,
    isOwner: false,
    adminUsername: null,
    accountUsername: null,
    allowedList: "alex, sam",
  };

  it("blocks everyone when testing mode is on and nobody matches", () => {
    expect(testingAccessAllowed(base, "/")).toBe("testing-closed");
  });

  it("always lets the owner in", () => {
    expect(testingAccessAllowed({ ...base, isOwner: true }, "/")).toBe("open");
  });

  it("lets selected admin usernames in (any spacing or case)", () => {
    expect(testingAccessAllowed({ ...base, adminUsername: "Alex" }, "/")).toBe("open");
    expect(testingAccessAllowed({ ...base, accountUsername: "SAM" }, "/chat/3")).toBe("open");
  });

  it("keeps unlisted admins out", () => {
    expect(testingAccessAllowed({ ...base, adminUsername: "pat" }, "/")).toBe("testing-closed");
  });

  it("leaves sign-in and admin pages reachable while testing", () => {
    for (const path of ["/login", "/admin", "/admin/panel", "/terms", "/appeal"]) {
      expect(testingAccessAllowed(base, path)).toBe("open");
    }
  });

  it("opens the whole site when testing mode is off", () => {
    expect(testingAccessAllowed({ ...base, testingOn: false }, "/")).toBe("open");
  });
});

describe("parseAllowedAdmins", () => {
  it("splits, trims, lowercases, and drops empties", () => {
    expect(parseAllowedAdmins(" Alex , SAM ,,  ")).toEqual(["alex", "sam"]);
    expect(parseAllowedAdmins("")).toEqual([]);
  });
});
