import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Flag, AlertTriangle, MessageSquare, Send, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface EnhancedReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedUsername: string;
  currentUsername: string;
  roomId?: number;
}

const reportTypes = [
  { value: "spam", label: "Spam", description: "Sending repetitive or unwanted messages", icon: "🔁" },
  { value: "inappropriate", label: "Inappropriate Content", description: "Sharing offensive or inappropriate material", icon: "⚠️" },
  { value: "harassment", label: "Harassment", description: "Targeting or bullying behavior", icon: "😠" },
  { value: "privacy", label: "Privacy Violation", description: "Sharing personal information without consent", icon: "🔒" },
  { value: "impersonation", label: "Impersonation", description: "Pretending to be someone else", icon: "🎭" },
  { value: "scam", label: "Scam", description: "Attempting to defraud or deceive others", icon: "💸" },
  { value: "other", label: "Other", description: "Other type of violation (please specify)", icon: "📝" }
];

const EnhancedReportDialog = ({ 
  open, 
  onOpenChange, 
  reportedUsername, 
  currentUsername,
  roomId 
}: EnhancedReportDialogProps) => {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedReport, setSelectedReport] = useState<typeof reportTypes[0] | null>(null);

  const handleSubmit = async () => {
    if (!selectedType) {
      toast({
        title: "Error",
        description: "Please select a report type",
        variant: "destructive"
      });
      return;
    }

    if (selectedType === "other" && details.trim().length < 10) {
      toast({
        title: "Error", 
        description: "Please provide more details for 'Other' reports (minimum 10 characters)",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      // Get recent chat context for the report
      const recentMessages = [];
      if (roomId) {
        try {
          const msgs = await db.query("messages", {
            room_id: `eq.${roomId}`,
            _created_at: `gte.${Date.now() - 300000}`, // Last 5 minutes
            order: "_created_at.desc",
            limit: 10
          });
          recentMessages.push(...msgs);
        } catch (error) {
          console.log("Error getting chat context:", error);
        }
      }

      // Create the report
      await db.insert("reports", {
        reporter_username: currentUsername,
        reported_username: reportedUsername,
        report_type: selectedType,
        report_details: details.trim() || null,
        room_id: roomId || null,
        chat_context: JSON.stringify(recentMessages),
        status: "pending",
        _created_at: Date.now()
      });

      // Update report count in user message
      if (roomId) {
        try {
          await db.insert("reports", {
            reporter_username: "system",
            reported_username: reportedUsername,
            report_type: "user_report",
            report_details: `Report submitted by ${currentUsername} (Type: ${selectedType})`,
            room_id: roomId,
            status: "pending",
            _created_at: Date.now()
          });
        } catch (error) {
          console.log("Error updating report count:", error);
        }
      }

      toast({
        title: "Report Submitted",
        description: `Thank you for reporting ${reportedUsername}. Admins will review this.`,
      });

      // Reset form
      setSelectedType("");
      setDetails("");
      setSelectedReport(null);
      onOpenChange(false);

    } catch (error) {
      console.log("Error submitting report:", error);
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    const report = reportTypes.find(r => r.value === type);
    setSelectedReport(report || null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-orange-400" />
            Report User
          </DialogTitle>
          <DialogDescription>
            Report <span className="font-semibold text-orange-400">{reportedUsername}</span> for violating community guidelines
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Report Type Selection */}
          <div>
            <h3 className="text-lg font-semibold mb-3">What are you reporting?</h3>
            <div className="grid gap-3">
              {reportTypes.map((type) => (
                <Card 
                  key={type.value}
                  className={`cursor-pointer transition-all border ${
                    selectedType === type.value 
                      ? "border-orange-400 bg-orange-400/10" 
                      : "border-white/10 hover:border-white/20"
                  }`}
                  onClick={() => handleTypeSelect(type.value)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{type.icon}</span>
                      <div className="flex-1">
                        <h4 className="font-semibold flex items-center gap-2">
                          {type.label}
                          {selectedType === type.value && (
                            <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                              Selected
                            </Badge>
                          )}
                        </h4>
                        <p className="text-sm text-gray-400 mt-1">{type.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Additional Details */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Additional Details (Optional)</h3>
            <Textarea
              placeholder={
                selectedType === "other" 
                  ? "Please describe what happened in detail..."
                  : "Provide any additional context that might help with the review..."
              }
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="bg-secondary/50 border-white/10 min-h-[100px]"
              maxLength={1000}
            />
            <div className="text-sm text-gray-400 mt-1">
              {details.length}/1000 characters {selectedType === "other" && "(Required for 'Other' reports)"}
            </div>
          </div>

          {/* Chat Context Info */}
          {roomId && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-blue-300">Chat Context</span>
              </div>
              <p className="text-sm text-gray-300">
                Recent messages from the last 5 minutes will be included with this report to help admins review the situation.
              </p>
            </div>
          )}

          {/* Submit Section */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-secondary/50 border-white/10"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedType}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {submitting ? (
                "Submitting..."
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Report
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedReportDialog;