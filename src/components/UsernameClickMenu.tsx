import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";
import {
  acceptFriendRequest,
  getRelationship,
  removeFriend,
  sendFriendRequest,
  type Relationship,
} from "@/lib/friends";
import { Check, Flag, MessageSquare, UserMinus, UserPlus } from "lucide-react";
import { settingBool, useAppSettings } from "@/lib/appSettings";

interface UsernameClickMenuProps {
  target: string;
  currentUsername: string;
  /** optional classes for the username trigger (used by the chat rows) */
  nameClassName?: string;
  /** optional inline style for the trigger (e.g. name color) */
  style?: CSSProperties;
}

const REPORT_REASONS = [
  "Spam",
  "Harassment or bullying",
  "Inappropriate content",
  "Impersonation",
  "Other",
];

const UsernameClickMenu = ({ target, currentUsername, nameClassName, style }: UsernameClickMenuProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useAppSettings();
  const friendsAllowed = settingBool(settings, "allow_friend_requests");
  const dmsAllowed = settingBool(settings, "allow_direct_messages");
  const [relationship, setRelationship] = useState<Relationship>("none");
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSending, setReportSending] = useState(false);

  const loadRelationship = async () => {
    try {
      const rel = await getRelationship(currentUsername, target);
      setRelationship(rel);
    } catch {
      setRelationship("none");
    }
  };

  const handleAddFriend = async () => {
    setBusy(true);
    const result = await sendFriendRequest(currentUsername, target);
    toast({
      title: result.ok ? "Request sent" : "Couldn't send request",
      description: result.message,
      variant: result.ok ? undefined : "destructive",
    });
    await loadRelationship();
    setBusy(false);
  };

  const handleAccept = async () => {
    setBusy(true);
    try {
      const pending = await db.query<{ _row_id: number; requested_by: string; friend_id: string }>(
        "friendships",
        { friend_id: `eq.${currentUsername}`, status: "eq.pending" }
      );
      const row = pending.find((r) => r.requested_by === target);
      if (row) {
        await acceptFriendRequest(row._row_id);
        toast({ title: "Friend added", description: `You and ${target} are now friends.` });
      }
    } finally {
      await loadRelationship();
      setBusy(false);
    }
  };

  const handleRemoveFriend = async () => {
    setBusy(true);
    await removeFriend(currentUsername, target);
    toast({ title: "Friend removed", description: `${target} was removed from your friends.` });
    await loadRelationship();
    setBusy(false);
  };

  const handleReport = async () => {
    setReportSending(true);
    try {
      await db.insert("user_reports", {
        reported_username: target,
        reported_device_id: null,
        reporter_username: currentUsername,
        reporter_device_id: getDeviceId(),
        room_id: null,
        report_reason: reportReason,
        custom_reason: reportDetails.trim() || null,
        report_type: "user",
        status: "pending",
      });
      toast({ title: "Report submitted", description: "Thank you — an admin will review it." });
      setReportOpen(false);
      setReportDetails("");
    } catch {
      toast({ title: "Couldn't submit report", variant: "destructive" });
    } finally {
      setReportSending(false);
    }
  };

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && loadRelationship()}>
        <DropdownMenuTrigger asChild>
          <button
            className={`text-left font-semibold hover:underline ${nameClassName ?? "text-xs text-primary"}`}
            style={style}
          >
            {target}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => navigate(`/profile/${target}`)}>
            View profile
          </DropdownMenuItem>
          {relationship === "none" && friendsAllowed && (
            <DropdownMenuItem onClick={handleAddFriend} disabled={busy}>
              <UserPlus className="w-4 h-4 mr-2" /> Add friend
            </DropdownMenuItem>
          )}
          {relationship === "outgoing" && (
            <DropdownMenuItem disabled>
              <UserPlus className="w-4 h-4 mr-2" /> Request pending
            </DropdownMenuItem>
          )}
          {relationship === "incoming" && (
            <DropdownMenuItem onClick={handleAccept} disabled={busy}>
              <Check className="w-4 h-4 mr-2" /> Accept friend request
            </DropdownMenuItem>
          )}
          {relationship === "friends" && (
            <>
              {dmsAllowed && (
                <DropdownMenuItem onClick={() => navigate(`/dm/${target}`)}>
                  <MessageSquare className="w-4 h-4 mr-2" /> Message
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleRemoveFriend} disabled={busy}>
                <UserMinus className="w-4 h-4 mr-2" /> Remove friend
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setReportOpen(true)} className="text-destructive">
            <Flag className="w-4 h-4 mr-2" /> Report user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {target}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Reason</Label>
              <div className="grid grid-cols-1 gap-2">
                {REPORT_REASONS.map((reason) => (
                  <Button
                    key={reason}
                    type="button"
                    variant={reportReason === reason ? "default" : "outline"}
                    size="sm"
                    onClick={() => setReportReason(reason)}
                  >
                    {reason}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-details">Details (optional)</Label>
              <Textarea
                id="report-details"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="What happened?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReport} disabled={reportSending}>
              {reportSending ? "Submitting..." : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UsernameClickMenu;
