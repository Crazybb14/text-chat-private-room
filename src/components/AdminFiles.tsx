import { useCallback, useEffect, useState } from "react";
import { Check, Clock, ExternalLink, FileText, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { content } from "@/lib/shared/kliv-content.js";
import { FILE_STATUS_APPROVED, formatBytes } from "@/lib/dmFiles";
import {
  fileTimestamp,
  splitByStatus,
  toReviewableFiles,
  type ReviewableDmFile,
  type ReviewableFile,
  type ReviewableRoomFile,
} from "@/lib/fileReview";

const REFRESH_MS = 10_000;

/**
 * Every file sent anywhere on the site lands here first. Approving makes it
 * visible to everyone; removing deletes the stored file for good and notifies
 * the sender.
 */
const AdminFiles = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewableFile[]>([]);

  const load = useCallback(async () => {
    try {
      const [msgRows, dmRows, roomRows] = await Promise.all([
        db.query<ReviewableRoomFile>("messages", { order: "_created_at.desc", limit: "300" }),
        db.query<ReviewableDmFile>("dm_files", { order: "_created_at.desc", limit: "300" }),
        db.query<{ _row_id: number; name: string }>("rooms", {}),
      ]);
      const roomNames = new Map(roomRows.map((r) => [Number(r._row_id), r.name]));
      setItems(toReviewableFiles(msgRows, dmRows, roomNames));
    } catch {
      // keep whatever was already loaded; the next poll retries
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const notifySender = async (username: string, title: string, message: string) => {
    try {
      await db.insert("notifications", {
        type: "file_review",
        title,
        message,
        recipient_username: username,
        link: null,
        is_read: 0,
        created_by_admin: 1,
      });
    } catch {
      // best-effort
    }
  };

  const handleApprove = async (file: ReviewableFile) => {
    setBusy(file.key);
    try {
      if (file.source === "room") {
        await db.updateOne("messages", { _row_id: `eq.${file.rowId}` }, { file_status: FILE_STATUS_APPROVED });
      } else {
        await db.updateOne("dm_files", { _row_id: `eq.${file.rowId}` }, { status: FILE_STATUS_APPROVED });
      }
      await notifySender(file.sender, "File approved", `"${file.name}" is now visible to everyone.`);
      toast({ title: "Approved", description: `${file.name} is now visible.` });
      setConfirming(null);
      await load();
    } catch {
      toast({ title: "Couldn't approve that file", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (file: ReviewableFile) => {
    setBusy(file.key);
    try {
      try {
        await content.deleteFile(file.path);
      } catch {
        // the stored copy may already be gone — the record still has to go
      }
      if (file.source === "room") {
        await db.deleteOne("messages", { _row_id: `eq.${file.rowId}` });
      } else {
        await db.deleteOne("dm_files", { _row_id: `eq.${file.rowId}` });
      }
      await notifySender(file.sender, "File removed", `A moderator removed "${file.name}" from chat.`);
      toast({ title: "File deleted", description: `${file.name} was removed for good.` });
      setConfirming(null);
      await load();
    } catch {
      toast({ title: "Couldn't delete that file", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const { pending, approved } = splitByStatus(items);

  const rowFor = (file: ReviewableFile, mode: "pending" | "approved") => {
    const working = busy === file.key;
    const asking = confirming === file.key;
    return (
      <Card key={file.key}>
        <CardContent className="py-3 flex items-center gap-3 flex-wrap">
          <span className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {file.source === "room" ? `Room · ${file.where}` : `Private · ${file.where}`} · from @
              {file.sender} · {formatBytes(file.size)} · {fileTimestamp(file.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button variant="ghost" size="sm" asChild>
              <a href={file.path} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                Open
              </a>
            </Button>
            {mode === "pending" && (
              <Button
                size="sm"
                disabled={working}
                aria-label={`Approve ${file.name}`}
                onClick={() => void handleApprove(file)}
              >
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                Approve
              </Button>
            )}
            {asking ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={working}
                  aria-label={`Confirm remove ${file.name}`}
                  onClick={() => void handleRemove(file)}
                >
                  {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
                  Delete for good
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                aria-label={`Remove ${file.name}`}
                onClick={() => setConfirming(file.key)}
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 space-y-1">
          <p className="font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> File review
          </p>
          <p className="text-sm text-muted-foreground">
            Every file sent in a room or private chat stays hidden until you approve it. The sender
            sees a waiting note; nobody else sees anything at all. Removing a file deletes it for
            good and lets the sender know.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-400" />
        <h3 className="font-semibold">Waiting for approval ({pending.length})</h3>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      {pending.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">
          Nothing waiting — files appear here the moment someone sends one.
        </p>
      )}
      {pending.map((file) => rowFor(file, "pending"))}

      <h3 className="font-semibold pt-2">Recently approved ({approved.length})</h3>
      <p className="text-xs text-muted-foreground">
        Already visible to everyone. You can still remove any of them.
      </p>
      {approved.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing approved yet.</p>
      )}
      {approved.slice(0, 15).map((file) => rowFor(file, "approved"))}
    </div>
  );
};

export default AdminFiles;
