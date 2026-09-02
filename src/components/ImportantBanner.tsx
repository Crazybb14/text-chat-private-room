import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  dismissNotice,
  getActiveImportantNotices,
  getDismissedIds,
  visibleNotices,
  type ImportantNoticeRow,
} from "@/lib/importantNotices";

const fmtTime = (value: number) => {
  if (!value) return "";
  const ms = value > 1e11 ? value : value * 1000;
  return new Date(ms).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/**
 * Big site-wide announcement. Shows on every screen for active important
 * notices until the reader dismisses it, refreshing every 30 seconds.
 */
const ImportantBanner = () => {
  const [notices, setNotices] = useState<ImportantNoticeRow[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);

  const load = useCallback(async () => {
    try {
      const rows = await getActiveImportantNotices();
      setNotices(rows);
      setDismissed(getDismissedIds());
    } catch {
      // best-effort — a failed check just keeps the last state
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const showing = visibleNotices(notices, dismissed);
  if (showing.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[min(94vw,640px)] space-y-3 pointer-events-none">
      {showing.slice(0, 3).map((notice) => (
        <div
          key={notice._row_id}
          role="alert"
          aria-label="Important announcement"
          className="pointer-events-auto rounded-xl border-2 border-amber-400 bg-zinc-900/95 shadow-2xl shadow-amber-500/30 backdrop-blur px-5 py-4"
        >
          <div className="flex items-center gap-2 text-amber-400">
            <Megaphone className="w-4 h-4 shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              Important announcement
            </span>
            {fmtTime(Number(notice._created_at)) && (
              <span className="text-[11px] text-zinc-500 font-normal tracking-normal">
                · {fmtTime(Number(notice._created_at))}
              </span>
            )}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-zinc-100 break-words">{notice.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300 whitespace-pre-line break-words">
            {notice.message}
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400/50 text-amber-300 hover:bg-amber-400/10 hover:text-amber-200"
              onClick={() => {
                dismissNotice(notice._row_id);
                setDismissed(getDismissedIds());
              }}
            >
              Got it
            </Button>
          </div>
        </div>
      ))}
      {showing.length > 3 && (
        <p className="text-center text-xs text-zinc-400 pointer-events-none">
          + {showing.length - 3} more announcement{showing.length - 3 === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
};

export default ImportantBanner;
