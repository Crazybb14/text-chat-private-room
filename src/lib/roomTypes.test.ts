import { describe, expect, it } from "vitest";
import { isVoiceRoom, splitLobbyRooms, type RoomKindRow } from "./roomTypes";

function room(overrides: Partial<RoomKindRow>): RoomKindRow {
  return {
    _row_id: 1,
    name: "Room",
    code: null,
    type: "public",
    is_voice: 0,
    ...overrides,
  };
}

// @kliv-spec-derived — from user intent: "a public voice chat shows up on the
// main page as a different public room, not one combined list"
describe("splitLobbyRooms", () => {
  it("puts public voice rooms in their own list, separate from text rooms", () => {
    const split = splitLobbyRooms([
      room({ _row_id: 1, name: "General Chat", is_voice: 0 }),
      room({ _row_id: 2, name: "Late Night Voice", is_voice: 1 }),
    ]);
    expect(split.textPublic.map((r) => r.name)).toEqual(["General Chat"]);
    expect(split.voicePublic.map((r) => r.name)).toEqual(["Late Night Voice"]);
  });

  it("keeps private rooms out of both public lists, voice or not", () => {
    const split = splitLobbyRooms([
      room({ _row_id: 1, name: "Secret", type: "private", code: "ABC123" }),
      room({ _row_id: 2, name: "Secret Voice", type: "private", code: "XYZ789", is_voice: 1 }),
    ]);
    expect(split.textPublic).toHaveLength(0);
    expect(split.voicePublic).toHaveLength(0);
    expect(split.privateRooms).toHaveLength(2);
  });

  it("treats a missing voice flag as a normal text room", () => {
    const split = splitLobbyRooms([room({ is_voice: undefined })]);
    expect(split.textPublic).toHaveLength(1);
    expect(split.voicePublic).toHaveLength(0);
  });
});

describe("isVoiceRoom", () => {
  it("only rooms flagged is_voice = 1 are voice rooms", () => {
    expect(isVoiceRoom({ is_voice: 1 })).toBe(true);
    expect(isVoiceRoom({ is_voice: 0 })).toBe(false);
    expect(isVoiceRoom({ is_voice: null })).toBe(false);
    expect(isVoiceRoom(undefined)).toBe(false);
  });
});
