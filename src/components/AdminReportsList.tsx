import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Flag, MessageSquare, User, Clock, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface Report {
  _row_id: number;
  message_id: number;
  reported_username: string;
  reporter_username: string;
  reason: string;
  description: string;
  message_content: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: number;
  reviewed_at?: number;
  reviewed_by?: string;
}

interface AdminReportsListProps {
  onBanUser?: (username: string) => void;
  refreshTrigger?: number;
}

const AdminReportsList = ({ onBanUser, refreshTrigger }: AdminReportsListProps) => {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const loadReports = async () => {
    try {
      setLoading(true);
      const reportsData = await db.query("reports", { 
        order: "_created_at.desc",
        status: "not.eq.dismissed"
      });
      setReports(reportsData);
    } catch (error) {
      console.log("Error loading reports:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [refreshTrigger]);

  const updateReportStatus = async (reportId: number, status: string, action?: string) => {
    try {
      await db.update("reports", { _row_id: `eq.${reportId}` }, {
        status,
        reviewed_at: Date.now(),
        reviewed_by: 'admin'
      });

      toast({
        title: `Report ${status}`,
        description: action ? action : `Report marked as ${status}`,
      });

      loadReports();
    } catch (error) {
      console.log("Error updating report:", error);
      toast({
        title: "Error",
        description: "Failed to update report",
        variant: "destructive",
      });
    }
  };

  const handleBanFromReport = async (report: Report) => {
    if (onBanUser) {
      onBanUser(report.reported_username);
      updateReportStatus(report._row_id, 'resolved', 'User banned and report resolved');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'reviewed': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'resolved': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'dismissed': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'Harassment': return 'bg-red-500/20 text-red-300';
      case 'Threats': return 'bg-red-500/20 text-red-300';
      case 'Spam': return 'bg-orange-500/20 text-orange-300';
      case 'Inappropriate content': return 'bg-yellow-500/20 text-yellow-300';
      case 'Impersonation': return 'bg-purple-500/20 text-purple-300';
      default: return 'bg-gray-500/20 text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-morphism border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-400" />
            User Reports ({reports.filter(r => r.status === 'pending').length} pending)
          </CardTitle>
          <CardDescription>
            Review and action user-submitted reports about inappropriate behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8">
              <Flag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No reports to review</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report._row_id}
                    className="p-4 rounded-lg bg-secondary/50 border border-white/10 space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-blue-400" />
                          <span className="font-medium text-blue-300">
                            {report.reported_username}
                          </span>
                        </div>
                        <span className="text-gray-400">reported by</span>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-green-400" />
                          <span className="font-medium text-green-300">
                            {report.reporter_username}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(report.status)}>
                          {report.status}
                        </Badge>
                        <Badge className={getReasonColor(report.reason)}>
                          {report.reason}
                        </Badge>
                      </div>
                    </div>

                    {/* Message Content */}
                    {report.message_content && (
                      <div className="bg-black/30 p-3 rounded border border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-400">Reported message:</span>
                        </div>
                        <p className="text-white">{report.message_content}</p>
                      </div>
                    )}

                    {/* Description */}
                    {report.description && (
                      <div>
                        <p className="text-sm text-gray-400 mb-1">Additional details:</p>
                        <p className="text-gray-300">{report.description}</p>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {new Date(report.created_at).toLocaleString()}
                      {report.reviewed_at && (
                        <>
                          <span>•</span>
                          Reviewed: {new Date(report.reviewed_at).toLocaleString()}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {report.status === 'pending' && (
                      <div className="flex gap-2 pt-2 border-t border-white/10">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleBanFromReport(report)}
                          className="flex items-center gap-2"
                        >
                          <Flag className="w-3 h-3" />
                          Ban User
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateReportStatus(report._row_id, 'reviewed')}
                          className="flex items-center gap-2"
                        >
                          <Clock className="w-3 h-3" />
                          Mark Reviewed
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateReportStatus(report._row_id, 'dismissed')}
                          className="flex items-center gap-2 text-gray-400"
                        >
                          <XCircle className="w-3 h-3" />
                          Dismiss
                        </Button>
                      </div>
                    )}

                    {report.status === 'reviewed' && (
                      <div className="flex gap-2 pt-2 border-t border-white/10">
                        <Button
                          size="sm"
                          onClick={() => updateReportStatus(report._row_id, 'resolved')}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleBanFromReport(report)}
                          className="flex items-center gap-2"
                        >
                          <Flag className="w-3 h-3" />
                          Ban User
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminReportsList;