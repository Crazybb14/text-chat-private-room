import { useState, useCallback, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Copy, Flag, UserPlus, Download, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface MessageContextMenuProps {
  messageId: number;
  messageContent: string;
  senderUsername: string;
  senderDeviceId?: string;
  hasFile?: boolean;
  fileUrl?: string;
  fileName?: string;
  onReportSubmit?: (reportData: ReportData) => void;
}

interface ReportData {
  messageId: number;
  reportedUsername: string;
  reason: string;
  description: string;
  reportedBy: string;
  deviceId: string;
}

const MessageContextMenu = ({
  messageId,
  messageContent,
  senderUsername,
  senderDeviceId,
  hasFile = false,
  fileUrl = "",
  fileName = "",
  onReportSubmit,
}: MessageContextMenuProps) => {
  const { toast } = useToast();
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      toast({
        title: "Copied",
        description: "Message copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy message",
        variant: "destructive",
      });
    }
  }, [messageContent, toast]);

  const handleDownload = useCallback(() => {
    if (hasFile && fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName || `file_${messageId}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: "Download started",
        description: `Downloading ${fileName}`,
      });
    } else {
      toast({
        title: "No file",
        description: "This message doesn't contain a file",
        variant: "destructive",
      });
    }
  }, [hasFile, fileUrl, fileName, messageId, toast]);

  const handleSendFriendRequest = useCallback(async () => {
    try {
      // Get current user info
      const currentUsername = localStorage.getItem('username') || 'Unknown';
      const currentDeviceId = localStorage.getItem('deviceId') || '';

      // Check if already friends
      const existingFriend = await db.query("friends", {
        username: `eq.${senderUsername}`,
        friend_username: `eq.${currentUsername}`
      });

      if (existingFriend.length > 0) {
        toast({
          title: "Already friends",
          description: `You are already friends with ${senderUsername}`,
          variant: "destructive",
        });
        return;
      }

      // Check if request already sent
      const existingRequest = await db.query("friend_requests", {
        from_username: `eq.${currentUsername}`,
        to_username: `eq.${senderUsername}`,
        status: `eq.pending`
      });

      if (existingRequest.length > 0) {
        toast({
          title: "Request already sent",
          description: `You already sent a friend request to ${senderUsername}`,
          variant: "destructive",
        });
        return;
      }

      // Send friend request
      await db.insert("friend_requests", {
        from_username: currentUsername,
        to_username: senderUsername,
        from_device_id: currentDeviceId,
        to_device_id: senderDeviceId || '',
        status: 'pending',
        created_at: Date.now()
      });

      toast({
        title: "Friend request sent",
        description: `Friend request sent to ${senderUsername}`,
      });
    } catch (error) {
      console.log("Error sending friend request:", error);
      toast({
        title: "Error",
        description: "Failed to send friend request",
        variant: "destructive",
      });
    }
  }, [senderUsername, senderDeviceId, toast]);

  const handleReport = useCallback(() => {
    setShowReportDialog(true);
  }, []);

  const submitReport = useCallback(async () => {
    if (!reportReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please select a reason for the report",
        variant: "destructive",
      });
      return;
    }

    try {
      const currentUsername = localStorage.getItem('username') || 'Unknown';
      const currentDeviceId = localStorage.getItem('deviceId') || '';

      const reportData: ReportData = {
        messageId,
        reportedUsername: senderUsername,
        reason: reportReason,
        description: reportDescription,
        reportedBy: currentUsername,
        deviceId: currentDeviceId,
      };

      // Save report to database
      await db.insert("reports", {
        message_id: messageId,
        reported_username: senderUsername,
        reporter_username: currentUsername,
        reason: reportReason,
        description: reportDescription,
        reported_by_device_id: currentDeviceId,
        message_content: messageContent,
        status: 'pending',
        created_at: Date.now()
      });

      toast({
        title: "Report submitted",
        description: "Your report has been sent to the admin team",
      });

      if (onReportSubmit) {
        onReportSubmit(reportData);
      }

      // Reset form
      setShowReportDialog(false);
      setReportReason("");
      setReportDescription("");
    } catch (error) {
      console.log("Error submitting report:", error);
      toast({
        title: "Error",
        description: "Failed to submit report",
        variant: "destructive",
      });
    }
  }, [messageId, senderUsername, reportReason, reportDescription, messageContent, toast, onReportSubmit]);

  const reportReasons = [
    "Harassment",
    "Spam",
    "Inappropriate content",
    "Threats",
    "Impersonation",
    "Other",
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 opacity-60 hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy message
          </DropdownMenuItem>
          
          {hasFile && (
            <>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download file
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleSendFriendRequest}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add as friend
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleReport} className="text-red-600">
            <Flag className="mr-2 h-4 w-4" />
            Report user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Report Dialog */}
      {showReportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background border border-white/10 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Report {senderUsername}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Reason for reporting</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-2 border border-white/10 rounded bg-secondary/50 text-white"
                >
                  <option value="">Select a reason...</option>
                  {reportReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description (optional)</label>
                <textarea
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Provide more details about your report..."
                  className="w-full p-2 border border-white/10 rounded bg-secondary/50 text-white resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowReportDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={submitReport}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Submit Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageContextMenu;