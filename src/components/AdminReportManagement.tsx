import React, { useState, useEffect } from "react";
import { Flag, MessageSquare, File, Search, Filter, Check, X, Eye, Trash2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import { getDeviceId } from "@/lib/deviceId";

interface Report {
  _row_id: number;
  reported_username: string;
  reported_device_id: string | null;
  reporter_username: string;
  reporter_device_id: string | null;
  room_id: number | null;
  report_reason: string;
  custom_reason: string | null;
  report_type: string;
  status: string;
  created_at: number;
  admin_notes: string | null;
  resolved_by: string | null;
}

const AdminReportManagement = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, searchTerm, statusFilter, typeFilter]);

  const loadReports = async () => {
    try {
      const data = await db.query("user_reports", {
        order: "_created_at.desc"
      });
      setReports(data);
      setLoading(false);
    } catch (error) {
      console.error("Error loading reports:", error);
      setLoading(false);
    }
  };

  const filterReports = () => {
    let filtered = [...reports];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(report => 
        report.reported_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.reporter_username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.report_reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (report.custom_reason && report.custom_reason.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(report => report.status === statusFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(report => report.report_type === typeFilter);
    }

    setFilteredReports(filtered);
  };

  const handleResolve = async (reportId: number, resolution: 'resolved' | 'dismissed') => {
    setProcessing(reportId);
    try {
      const adminId = getDeviceId();
      
      await db.update("user_reports", { _row_id: `eq.${reportId}` }, {
        status: resolution,
        admin_notes: adminNotes.trim(),
        resolved_by: adminId
      });

      setReports(reports.map(r => 
        r._row_id === reportId 
          ? { ...r, status: resolution, admin_notes: adminNotes.trim(), resolved_by: adminId }
          : r
      ));

      setSelectedReport(null);
      setAdminNotes("");
      
      toast({
        title: `✅ Report ${resolution}`,
        description: "Report has been marked as " + resolution,
      });
    } catch (error) {
      console.error("Error resolving report:", error);
      toast({
        title: "❌ Error",
        description: "Failed to resolve report",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "reviewed":
        return "bg-blue-100 text-blue-800";
      case "resolved":
        return "bg-green-100 text-green-800";
      case "dismissed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "message":
        return <MessageSquare className="w-4 h-4" />;
      case "file":
        return <File className="w-4 h-4" />;
      default:
        return <Flag className="w-4 h-4" />;
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getReasonDisplay = (reason: string, customReason?: string) => {
    const reasonMap: { [key: string]: string } = {
      harassment: "Harassment/Bullying",
      spam: "Spam/Flooding",
      inappropriate: "Inappropriate Content",
      personal_info: "Personal Information",
      threats: "Threats/Intimidation",
      impersonation: "Impersonation",
      underage: "Underage User",
      illegal: "Illegal Activity",
      copyright: "Copyright Violation",
      malware: "Malware/Virus",
      other: "Other"
    };

    const display = reasonMap[reason] || reason;
    return customReason ? `${display}: ${customReason}` : display;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Reports</h2>
        <Button onClick={loadReports} variant="outline">
          <Clock className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search reports..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="message">Message</SelectItem>
                <SelectItem value="file">File</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <div className="space-y-3">
        {filteredReports.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                  ? "No reports match your filters"
                  : "No reports found"}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredReports.map((report) => (
            <Card key={report._row_id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeIcon(report.report_type)}
                      <span className="font-medium">
                        {report.report_type === "user" 
                          ? `User: ${report.reported_username}`
                          : `${report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} from ${report.reported_username}`
                        }
                      </span>
                      <Badge className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <p><strong>Reporter:</strong> {report.reporter_username}</p>
                      <p><strong>Reason:</strong> {getReasonDisplay(report.report_reason, report.custom_reason || undefined)}</p>
                      <p><strong>Created:</strong> {formatTime(report._created_at)}</p>
                      {report.room_id && (
                        <p><strong>Room:</strong> #{report.room_id}</p>
                      )}
                      {report.admin_notes && (
                        <p><strong>Admin Notes:</strong> {report.admin_notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedReport(report)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    
                    {report.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedReport(report);
                            handleResolve(report._row_id, "resolved");
                          }}
                          disabled={processing === report._row_id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedReport(report);
                            handleResolve(report._row_id, "dismissed");
                          }}
                          disabled={processing === report._row_id}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Dismiss
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Report Details Modal */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedReport && getTypeIcon(selectedReport.report_type)}
              Report Details
            </DialogTitle>
            <DialogDescription>
              Review and manage this user report
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Reported User</p>
                  <p>{selectedReport.reported_username}</p>
                </div>
                <div>
                  <p className="font-medium">Reporter</p>
                  <p>{selectedReport.reporter_username}</p>
                </div>
                <div>
                  <p className="font-medium">Report Type</p>
                  <p className="capitalize">{selectedReport.report_type}</p>
                </div>
                <div>
                  <p className="font-medium">Status</p>
                  <Badge className={getStatusColor(selectedReport.status)}>
                    {selectedReport.status}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="font-medium">Reason</p>
                  <p>{getReasonDisplay(selectedReport.report_reason, selectedReport.custom_reason || undefined)}</p>
                </div>
                <div className="col-span-2">
                  <p className="font-medium">Created</p>
                  <p>{formatTime(selectedReport._created_at)}</p>
                </div>
              </div>

              {selectedReport.status === "pending" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Admin Notes</label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about your decision..."
                    className="min-h-[100px]"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedReport(null)}
                >
                  Close
                </Button>
                
                {selectedReport.status === "pending" && (
                  <>
                    <Button
                      onClick={() => handleResolve(selectedReport._row_id, "resolved")}
                      disabled={processing === selectedReport._row_id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Resolve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleResolve(selectedReport._row_id, "dismissed")}
                      disabled={processing === selectedReport._row_id}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Dismiss
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReportManagement;