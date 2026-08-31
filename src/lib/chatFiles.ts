import db from "@/lib/shared/kliv-database.js";
import { content } from "@/lib/shared/kliv-content.js";
import { FILE_STATUS_PENDING, fileKind, formatBytes } from "./dmFiles";

export { fileKind, formatBytes };

/**
 * The platform's file upload limit is 500 MB — that's the ceiling for files
 * shared in group chats too.
 */
export const MAX_CHAT_FILE_BYTES = 500 * 1024 * 1024;

export interface RoomFileMessage {
  _row_id: number;
  room_id: number;
  sender_name: string;
  content: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  file_status?: string | null;
  _created_at: number;
  [key: string]: unknown;
}

export type ChatFileValidation = { ok: true } | { ok: false; reason: string };

export function validateChatFile(file: File): ChatFileValidation {
  if (file.size <= 0) return { ok: false, reason: "That file looks empty." };
  if (file.size > MAX_CHAT_FILE_BYTES) {
    return {
      ok: false,
      reason: `Files have to be under 500 MB — that one is ${formatBytes(file.size)}.`,
    };
  }
  if (!file.name || file.name.trim().length === 0) {
    return { ok: false, reason: "That file has no name." };
  }
  return { ok: true };
}

/** Uploads a file for a room and posts it into the message feed as an
 *  attachment. It stays hidden from everyone else until an admin approves it. */
export async function uploadRoomFile(
  roomId: number,
  file: File,
  sender: string,
  onProgress?: (percentage: number) => void
): Promise<RoomFileMessage> {
  const meta = await content.uploadFile(file, `chat_files/${roomId}/`, {
    onProgress: (p) => onProgress?.(p.percentage),
  });
  return db.insert<RoomFileMessage>("messages", {
    room_id: roomId,
    sender_name: sender,
    content: "",
    device_id: null,
    is_ai: 0,
    file_path: meta.path,
    file_name: file.name.slice(0, 200),
    file_size: file.size,
    mime_type: file.type || "",
    file_status: FILE_STATUS_PENDING,
  });
}
