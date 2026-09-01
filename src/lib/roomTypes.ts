/**
 * Room kinds. Every room is still public or private, but voice rooms
 * (call-first rooms) get their own list on the main page instead of being
 * mixed in with the text chat rooms.
 */

export interface RoomKindRow {
  _row_id: number;
  name: string;
  code: string | null;
  type: string;
  is_voice?: number | null;
  [key: string]: unknown;
}

/** True when this room is a call-first voice room. */
export function isVoiceRoom(room: Pick<RoomKindRow, "is_voice"> | null | undefined): boolean {
  return Number(room?.is_voice) === 1;
}

export interface LobbyRoomSplit {
  /** Public text chat rooms (no voice flag). */
  textPublic: RoomKindRow[];
  /** Public voice/call rooms — shown in their own section. */
  voicePublic: RoomKindRow[];
  /** Private rooms (text or voice) — never listed, joined by code. */
  privateRooms: RoomKindRow[];
}

/** Splits the room list for the main page. */
export function splitLobbyRooms(rooms: RoomKindRow[]): LobbyRoomSplit {
  const textPublic: RoomKindRow[] = [];
  const voicePublic: RoomKindRow[] = [];
  const privateRooms: RoomKindRow[] = [];
  for (const room of rooms) {
    if (room.type === "private") {
      privateRooms.push(room);
    } else if (isVoiceRoom(room)) {
      voicePublic.push(room);
    } else {
      textPublic.push(room);
    }
  }
  return { textPublic, voicePublic, privateRooms };
}
