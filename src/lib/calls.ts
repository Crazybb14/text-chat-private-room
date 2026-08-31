import db from "@/lib/shared/kliv-database.js";
import { functions } from "@/lib/shared/kliv-functions.js";

export type CallType = "public-room" | "private-room" | "dm";
export type SignalKind = "offer" | "answer" | "ice";

export interface CallSessionRow {
  _row_id: number;
  room_id: number | null;
  dm_pair: string | null;
  type: CallType | string;
  status: string;
  started_by: string;
  started_at: number;
  [key: string]: unknown;
}

export interface CallParticipantRow {
  _row_id: number;
  call_id: number;
  username: string;
  hidden: number;
  muted: number;
  video_on: number;
  last_seen: number;
  [key: string]: unknown;
}

export interface CallSignalRow {
  _row_id: number;
  call_id: number;
  from_user: string;
  to_user: string;
  kind: SignalKind | string;
  payload: string;
  created_at: number;
  [key: string]: unknown;
}

export interface CallControlResult {
  ok?: boolean;
  callId?: number;
  existing?: boolean;
  hidden?: number;
  error?: string;
}

/** Stable key for a direct-message call between two people. */
export function dmPairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

export function splitPairKey(key: string): [string, string] {
  const parts = key.split("::");
  return [parts[0] ?? "", parts[1] ?? ""];
}

/** Participants count as present while their heartbeat is fresher than this. */
export const PARTICIPANT_STALE_MS = 120_000;

export function participantPresent(row: CallParticipantRow, now = Date.now()): boolean {
  return now - Number(row.last_seen) < PARTICIPANT_STALE_MS;
}

export async function getActiveCalls(): Promise<CallSessionRow[]> {
  return db.query<CallSessionRow>("call_sessions", {
    status: "eq.active",
    order: "_row_id.desc",
  });
}

export async function getActiveCallForRoom(roomId: number): Promise<CallSessionRow | null> {
  const rows = await db.query<CallSessionRow>("call_sessions", {
    room_id: `eq.${roomId}`,
    status: "eq.active",
    order: "_row_id.desc",
  });
  return rows[0] ?? null;
}

export async function getActiveCallForDm(pairKey: string): Promise<CallSessionRow | null> {
  const rows = await db.query<CallSessionRow>("call_sessions", {
    dm_pair: `eq.${pairKey}`,
    status: "eq.active",
    order: "_row_id.desc",
  });
  return rows[0] ?? null;
}

export async function getCallParticipants(callId: number): Promise<CallParticipantRow[]> {
  return db.query<CallParticipantRow>("call_participants", { call_id: `eq.${callId}` });
}

/** Starts a call. The server enforces: public-room calls need the site owner. */
export async function startCall(input: {
  type: CallType;
  roomId?: number;
  target?: string;
}): Promise<CallControlResult> {
  return functions.post<CallControlResult>("call-control", { action: "start", ...input });
}

/** Joins a call. `hidden` (silent moderation) is only honored for the owner. */
export async function joinCall(callId: number, hidden = false): Promise<CallControlResult> {
  return functions.post<CallControlResult>("call-control", { action: "join", callId, hidden });
}

/** Ends a call for everyone (owner, or whoever started it). */
export async function endCall(callId: number): Promise<CallControlResult> {
  return functions.post<CallControlResult>("call-control", { action: "end", callId });
}

export async function removeParticipant(rowId: number): Promise<void> {
  await db.deleteOne("call_participants", { _row_id: `eq.${rowId}` }).catch(() => undefined);
}

export async function updateParticipant(
  rowId: number,
  fields: Partial<Pick<CallParticipantRow, "muted" | "video_on" | "last_seen">>
): Promise<void> {
  await db.updateOne("call_participants", { _row_id: `eq.${rowId}` }, fields).catch(() => undefined);
}

export async function postSignal(
  callId: number,
  from: string,
  to: string,
  kind: SignalKind,
  payload: string
): Promise<void> {
  await db
    .insert("call_signals", {
      call_id: callId,
      from_user: from,
      to_user: to,
      kind,
      payload,
      created_at: Date.now(),
    })
    .catch(() => undefined);
}

/** Fetches the handshake messages addressed to me and removes them (consume-once). */
export async function takeSignals(callId: number, me: string): Promise<CallSignalRow[]> {
  const rows = await db.query<CallSignalRow>("call_signals", {
    call_id: `eq.${callId}`,
    to_user: `eq.${me}`,
    order: "_row_id.asc",
  });
  await Promise.all(
    rows.map((row) =>
      db.deleteOne("call_signals", { _row_id: `eq.${row._row_id}` }).catch(() => undefined)
    )
  );
  return rows;
}

/** Public STUN servers for connecting calls across networks. */
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];
