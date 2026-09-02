import { describe, expect, it } from "vitest";
import { isNoticeActive, parseDismissed, visibleNotices } from "./importantNotices";
import type { ImportantNoticeRow } from "./importantNotices";

const row = (id: number, active: number): ImportantNoticeRow => ({
  _row_id: id,
  title: `Notice ${id}`,
  message: "Body",
  is_active: active,
  created_by: "owner",
  deactivated_at: active === 1 ? null : 1000,
  _created_at: 1234,
});

describe("parseDismissed", () => {
  it("reads dismissed notice ids", () => {
    expect(parseDismissed("[1,2,3]")).toEqual([1, 2, 3]);
  });

  it("returns empty for broken or missing data", () => {
    expect(parseDismissed("oops")).toEqual([]);
    expect(parseDismissed(null)).toEqual([]);
    expect(parseDismissed('["1","2"]')).toEqual([]);
  });
});

// @kliv-spec-derived — from user intent: "shows on their screen no matter what screen they're on
// until dismissed, and turns off when the admin turns it off"
describe("visibleNotices", () => {
  it("shows active notices only", () => {
    const showing = visibleNotices([row(1, 1), row(2, 0)], []);
    expect(showing.map((n) => n._row_id)).toEqual([1]);
  });

  it("hides notices this browser dismissed", () => {
    const showing = visibleNotices([row(1, 1), row(2, 1)], [1]);
    expect(showing.map((n) => n._row_id)).toEqual([2]);
  });

  it("keeps showing a notice to other browsers", () => {
    expect(visibleNotices([row(1, 1)], [99])).toHaveLength(1);
  });
});

describe("isNoticeActive", () => {
  it("treats is_active 1 as live", () => {
    expect(isNoticeActive({ is_active: 1 })).toBe(true);
    expect(isNoticeActive({ is_active: 0 })).toBe(false);
  });
});
