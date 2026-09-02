import { describe, expect, it } from "vitest";
import { bucketActivityByHour, hourLabel, toMs } from "./activity";

// @kliv-spec-derived — from user intent: "show what time has the most people"
describe("bucketActivityByHour", () => {
  const now = new Date(2026, 8, 2, 23, 0).getTime();

  it("marks the hour with the most distinct people as the peak", () => {
    const rows = [
      { sender: "a", at: new Date(2026, 8, 2, 20, 5).getTime() },
      { sender: "b", at: new Date(2026, 8, 2, 20, 40).getTime() },
      { sender: "c", at: new Date(2026, 8, 2, 21, 10).getTime() },
    ];
    const summary = bucketActivityByHour(rows, 7, now);
    expect(summary.peak?.hour).toBe(20);
    expect(summary.peak?.people).toBe(2);
    const eightPm = summary.points.find((p) => p.hour === 20);
    expect(eightPm?.messages).toBe(2);
  });

  it("counts a person once per hour no matter how much they send", () => {
    const rows = [
      { sender: "a", at: new Date(2026, 8, 2, 9, 0).getTime() },
      { sender: "a", at: new Date(2026, 8, 2, 9, 10).getTime() },
      { sender: "A", at: new Date(2026, 8, 2, 9, 20).getTime() },
    ];
    const summary = bucketActivityByHour(rows, 7, now);
    expect(summary.points.find((p) => p.hour === 9)?.people).toBe(1);
    expect(summary.points.find((p) => p.hour === 9)?.messages).toBe(3);
  });

  it("ignores activity older than the window", () => {
    const rows = [
      { sender: "a", at: now - 30 * 86_400_000 },
      { sender: "b", at: now - 3_600_000 },
    ];
    const summary = bucketActivityByHour(rows, 7, now);
    expect(summary.totalMessages).toBe(1);
  });

  it("breaks a people tie using message volume", () => {
    const rows = [
      { sender: "a", at: new Date(2026, 8, 2, 10, 0).getTime() },
      { sender: "b", at: new Date(2026, 8, 2, 11, 0).getTime() },
      { sender: "c", at: new Date(2026, 8, 2, 11, 30).getTime() },
    ];
    expect(bucketActivityByHour(rows, 7, now).peak?.hour).toBe(11);
  });

  it("handles second-based timestamps from the tables", () => {
    const rows = [{ sender: "a", at: new Date(2026, 8, 2, 14, 0).getTime() / 1000 }];
    const summary = bucketActivityByHour(rows, 7, now);
    expect(summary.points.find((p) => p.hour === 14)?.people).toBe(1);
  });
});

describe("toMs", () => {
  it("treats small numbers as seconds and large ones as milliseconds", () => {
    expect(toMs(1788287202)).toBe(1788287202 * 1000);
    expect(toMs(1788287202000)).toBe(1788287202000);
  });
});

describe("hourLabel", () => {
  it("formats noon and midnight", () => {
    expect(hourLabel(0)).toBe("12 AM");
    expect(hourLabel(12)).toBe("12 PM");
    expect(hourLabel(17)).toBe("5 PM");
  });
});
