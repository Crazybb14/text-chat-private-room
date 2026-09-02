import db from "@/lib/shared/kliv-database.js";

export interface ImportantNoticeRow {
  _row_id: number;
  title: string;
  message: string;
  is_active: number;
  created_by: string | null;
  deactivated_at: number | null;
  _created_at: number;
  [key: string]: unknown;
}

const DISMISSED_KEY = "important_dismissed";

/** Reads the list of notice ids this browser has already dismissed. */
export function parseDismissed(raw: string | null): number[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => typeof value === "number");
  } catch {
    return [];
  }
}

export function isNoticeActive(row: Pick<ImportantNoticeRow, "is_active">): boolean {
  return Number(row.is_active) === 1;
}

/** Only active notices this browser hasn't dismissed yet. */
export function visibleNotices(
  rows: ImportantNoticeRow[],
  dismissed: number[],
): ImportantNoticeRow[] {
  const dismissedSet = new Set(dismissed);
  return rows.filter(
    (row) => isNoticeActive(row) && !dismissedSet.has(Number(row._row_id)),
  );
}

export function getDismissedIds(): number[] {
  try {
    return parseDismissed(localStorage.getItem(DISMISSED_KEY));
  } catch {
    return [];
  }
}

export function dismissNotice(id: number): void {
  try {
    const ids = new Set(getDismissedIds());
    ids.add(Number(id));
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    // storage unavailable — the banner just keeps showing
  }
}

export async function getActiveImportantNotices(): Promise<ImportantNoticeRow[]> {
  return db.query<ImportantNoticeRow>("important_notices", {
    is_active: "eq.1",
    order: "_row_id.desc",
  });
}

export async function getAllImportantNotices(): Promise<ImportantNoticeRow[]> {
  return db.query<ImportantNoticeRow>("important_notices", { order: "_row_id.desc" });
}

export async function createImportantNotice(
  title: string,
  message: string,
  createdBy: string,
): Promise<ImportantNoticeRow> {
  return db.insert<ImportantNoticeRow>("important_notices", {
    title: title.trim(),
    message: message.trim(),
    is_active: 1,
    created_by: createdBy,
    deactivated_at: null,
  });
}

export async function deactivateNotice(id: number): Promise<void> {
  await db.updateOne(
    "important_notices",
    { _row_id: `eq.${id}` },
    { is_active: 0, deactivated_at: Math.floor(Date.now() / 1000) },
  );
}

export async function reactivateNotice(id: number): Promise<void> {
  await db.updateOne(
    "important_notices",
    { _row_id: `eq.${id}` },
    { is_active: 1, deactivated_at: null },
  );
}

export async function deleteImportantNotice(id: number): Promise<void> {
  await db.deleteOne("important_notices", { _row_id: `eq.${id}` });
}
