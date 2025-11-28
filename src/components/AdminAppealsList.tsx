import { Scale, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Appeal {
  _row_id: number;
  real_name: string;
  banned_username: string;
  reason: string;
  device_id: string | null;
  status: string;
  _created_at: number;
}

interface AdminAppealsListProps {
  appeals: Appeal[];
  onApprove: (appeal: Appeal) => void;
  onDeny: (id: number) => void;
  onDelete: (id: number) => void;
}

const AdminAppealsList = ({ appeals, onApprove, onDeny, onDelete }: AdminAppealsListProps) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600">Approved</Badge>;
      case "denied":
        return <Badge className="bg-red-600">Denied</Badge>;
      default:
        return <Badge className="bg-yellow-600">Pending</Badge>;
    }
  };

  return (
    <Card className="glass-morphism border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-blue-400" />
          Ban Appeals ({appeals.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px]">
          {appeals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8 px-4">
              No appeals yet
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {appeals.map((appeal) => {
                const date = new Date(appeal._created_at * 1000).toLocaleString();
                const isPending = appeal.status === "pending";
                
                return (
                  <div
                    key={appeal._row_id}
                    className="p-4 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-medium text-blue-400">
                            {appeal.real_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            (Banned as: {appeal.banned_username})
                          </span>
                          {getStatusBadge(appeal.status)}
                        </div>
                        <p className="text-sm text-muted-foreground break-words mb-2">
                          {appeal.reason}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Submitted: {date}
                        </p>
                        {appeal.device_id && (
                          <p className="text-xs text-red-400 mt-1">
                            Device: {appeal.device_id.substring(0, 20)}...
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {isPending && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onApprove(appeal)}
                              className="h-8 w-8 text-muted-foreground hover:text-green-400"
                              title="Approve appeal (unban user)"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeny(appeal._row_id)}
                              className="h-8 w-8 text-muted-foreground hover:text-red-400"
                              title="Deny appeal"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(appeal._row_id)}
                          className="h-8 w-8 text-muted-foreground hover:text-red-400"
                          title="Delete appeal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AdminAppealsList;
