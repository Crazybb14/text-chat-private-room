import db from "@/lib/shared/kliv-database.js";
import { content } from "@/lib/shared/kliv-content.js";

/**
 * The platform's file upload limit is 500 MB, so that's the real ceiling for
 * shared files — anything bigger is rejected before the upload starts.
 */
export const MAX_DM_FILE_BYTES = 500 * 1024 * 1024;

/** Review states for shared files. Anything other than approved stays hidden. */
export const FILE_STATUS_PENDING = "pending";
export const FILE_STATUS_APPROVED = "approved";

export function isFileApproved(status: unknown): boolean {
  return status === FILE_STATUS_APPROVED;
}

/**
 * A file is visible to everyone only once an admin approves it. The one
 * exception: the sender still sees their own upload as a waiting note.
 */
export function fileVisibleToViewer(status: unknown, isSender: boolean): boolean {
  if (isFileApproved(status)) return true;
  return isSender && status === FILE_STATUS_PENDING;
}

export interface DmFileRow {
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

export type DmFileValidation = { ok: true } | { ok: false; reason: string };

export function validateDmFile(file: File): DmFileValidation {
  if (file.size <= 0) return { ok: false, reason: "That file looks empty." };
  if (file.size > MAX_DM_FILE_BYTES) {
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

export type FileKind = "image" | "video" | "audio" | "other";

export function fileKind(mime: string): FileKind {
  const type = (mime || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  return "other";
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Uploads a file into private storage and records it in the DM thread.
 *  It stays hidden from the other person until an admin approves it. */
export async function uploadDmFile(
  file: File,
  from: string,
  to: string,
  onProgress?: (percentage: number) => void
): Promise<DmFileRow> {
  const meta = await content.uploadFile(file, "dm_files/", {
    onProgress: (p) => onProgress?.(p.percentage),
  });
  return db.insert<DmFileRow>("dm_files", {
    sender_username: from,
    recipient_username: to,
    file_path: meta.path,
    file_name: file.name.slice(0, 200),
    file_size: file.size,
    mime_type: file.type || "",
    status: FILE_STATUS_PENDING,
  });
}

/** All files shared between two people, oldest first. */
export async function getDmFiles(me: string, them: string): Promise<DmFileRow[]> {
  const [sent, received] = await Promise.all([
    db.query<DmFileRow>("dm_files", {
      sender_username: `eq.${me}`,
      recipient_username: `eq.${them}`,
      order: "_created_at.asc",
    }),
    db.query<DmFileRow>("dm_files", {
      sender_username: `eq.${them}`,
      recipient_username: `eq.${me}`,
      order: "_created_at.asc",
    }),
  ]);
  return [...sent, ...received].sort((a, b) => (a._created_at || 0) - (b._created_at || 0));
}
