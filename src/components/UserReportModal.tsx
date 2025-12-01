import React, { useState } from "react";
import { Flag, MessageSquare, File, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";
import UserManager from "@/lib/userManagement";

interface UserReportModalProps {
  reportedUsername: string;
  reportedDeviceId?: string;
  roomId?: number;
  reportType?: 'user' | 'message' | 'file';
  trigger?: React.ReactNode;
}

const UserReportModal = ({
  reportedUsername,
  reportedDeviceId,
  roomId,
  reportType = 'user',
  trigger
}: UserReportModalProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const reportReasons = {
    user: [
      { value: "harassment", label: "Harassment or Bullying" },
      { value: "spam", label: "Spam or Flooding" },
      { value: "inappropriate", label: "Inappropriate Content" },
      { value: "personal_info", label: "Sharing Personal Information" },
      { value: "threats", label: "Threats or Intimidation" },
      { value: "impersonation", label: "Impersonation" },
      { value: "underage", label: "Underage User" },
      { value: "other", label: "Other" }
    ],
    message: [
      { value: "harassment", label: "Harassment or Hate Speech" },
      { value: "spam", label: "Spam or Irrelevant Content" },
      { value: "personal_info", label: "Personal Information" },
      { value: "threats", label: "Threats or Violence" },
      { value: "inappropriate", label: "Inappropriate Content" },
      { value: "illegal", label: "Illegal Activity" },
      { value: "other", label: "Other" }
    ],
    file: [
      { value: "inappropriate", label: "Inappropriate Content" },
      { value: "copyright", label: "Copyright Violation" },
      { value: "malware", label: "Malware or Virus" },
      { value: "personal_info", label: "Personal Information" },
      { value: "illegal", label: "Illegal Content" },
      { value: "spam", label: "Spam or Advertising" },
      { value: "other", label: "Other" }
    ]
  };

  const handleSubmit = async () => {
    if (!reason) {
      toast({
        title: "❌ Reason Required",
        description: "Please select a reason for your report",
        variant: "destructive",
      });
      return;
    }

    if (reason === "other" && !customReason.trim()) {
      toast({
        title: "❌ Details Required",
        description: "Please provide details for your report",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const username = await UserManager.getUsername();
      const deviceId = getDeviceId();

      await db.insert("user_reports", {
        reported_username: reportedUsername,
        reported_device_id: reportedDeviceId || null,
        reporter_username: username,
        reporter_device_id: deviceId,
        room_id: roomId || null,
        report_reason: reason,
        custom_reason: reason === "other" ? customReason.trim() : null,
        report_type: reportType,
        status: "pending"
      });

      // Log the report activity
      try {
        await db.insert("ip_activity_logs", {
          device_id: deviceId,
          username: username,
          action: "user_report",
          room_id: roomId || null,
          message_preview: `Reported ${reportedUsername} for ${reason}`,
        });
      } catch (logErr) {
        console.log("IP log failed:", logErr);
      }

      setIsOpen(false);
      setReason("");
      setCustomReason("");
      
      toast({
        title: "✅ Report Submitted",
        description: "Thank you for your report. Our team will review it shortly.",
      });
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "❌ Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getReportIcon = () => {
    switch (reportType) {
      case 'message':
        return <MessageSquare className="w-4 h-4" />;
      case 'file':
        return <File className="w-4 h-4" />;
      default:
        return <Flag className="w-4 h-4" />;
    }
  };

  const getReportTitle = () => {
    switch (reportType) {
      case 'message':
        return "Report Message";
      case 'file':
        return "Report File";
      default:
        return "Report User";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Flag className="w-4 h-4 mr-2" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getReportIcon()}
            {getReportTitle()}
          </DialogTitle>
          <DialogDescription>
            Report <span className="font-semibold text-primary">{reportedUsername}</span> for policy violations.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Report</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {reportReasons[reportType].map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === "other" && (
            <div className="space-y-2">
              <Label htmlFor="custom-reason">Please explain</Label>
              <Textarea
                id="custom-reason"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Provide details about your report..."
                className="min-h-[100px]"
              />
            </div>
          )}

          {roomId && (
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              This report will include the room context for our moderation team.
            </div>
          )}

          <div className="text-xs text-muted-foreground border-t pt-3">
            <p className="mb-2">⚠️ False reporting may result in penalties.</p>
            <p>Reports are reviewed by our moderation team and kept confidential.</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !reason || (reason === "other" && !customReason.trim())}
          >
            {isSubmitting ? (
              <>
                <X className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Report
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserReportModal;