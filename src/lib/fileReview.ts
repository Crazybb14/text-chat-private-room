import { isFileApproved } from "./dmFiles";

/** A room message that carries a file attachment. */
export interface ReviewableRoomFile {
  _row_id: number;
  room_id: number;
  sender_name: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  file_status: string | null;
  _created_at: number;
  [key: string]: unknown;
}

/** A file shared inside a private conversation. */
export interface ReviewableDmFile {
  _row_id: number;
  sender_username: string;
  recipient_username: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  status: string;
  _created_at: number;
  [key: string]: unknown;
}

export interface ReviewableFile {
  key: string;
  source: "room" | "dm";
  rowId: number;
  /** Room name, or "sender → recipient" for a private file. */
  where: string;
  sender: string;
  name: string;
  size: number;
  mime: string;
  path: string;
  status: string;
  createdAt: number;
}

/** Merges room attachments and private files into one list, newest first. */
export function toReviewableFiles(
  roomFiles: ReviewableRoomFile[],
  dmFiles: ReviewableDmFile[],
  roomNames: Map<number, string>
): ReviewableFile[] {
  const fromRooms = roomFiles
    .filter((row) => Boolean(row.file_path))
    .map((row) => ({
      key: `room-${row._row_id}`,
      source: "room" as const,
      rowId: row._row_id,
      where: roomNames.get(Number(row.room_id)) ?? `Room #${row.room_id}`,
      sender: row.sender_name,
      name: row.file_name || "file",
      size: Number(row.file_size || 0),
      mime: row.mime_type || "",
      path: row.file_path as string,
      status: row.file_status || "pending",
      createdAt: Number(row._created_at || 0),
    }));
  const fromDms = dmFiles.map((row) => ({
    key: `dm-${row._row_id}`,
    source: "dm" as const,
    rowId: row._row_id,
    where: `${row.sender_username} → ${row.recipient_username}`,
    sender: row.sender_username,
    name: row.file_name || "file",
    size: Number(row.file_size || 0),
    mime: row.mime_type || "",
    path: row.file_path,
    status: row.status || "pending",
    createdAt: Number(row._created_at || 0),
  }));
  return [...fromRooms, ...fromDms].sort((a, b) => b.createdAt - a.createdAt);
}

/** Splits the merged list into what's waiting and what's already live. */
export function splitByStatus(files: ReviewableFile[]): {
  pending: ReviewableFile[];
  approved: ReviewableFile[];
} {
  const pending: ReviewableFile[] = [];
  const approved: ReviewableFile[] = [];
  for (const file of files) {
    (isFileApproved(file.status) ? approved : pending).push(file);
  }
  return { pending, approved };
}

/** Timestamps are stored in seconds or milliseconds depending on the writer. */
export function fileTimestamp(epochish: number): string {
  if (!Number.isFinite(epochish) || epochish <= 0) return "";
  const ms = epochish < 1e12 ? epochish * 1000 : epochish;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
