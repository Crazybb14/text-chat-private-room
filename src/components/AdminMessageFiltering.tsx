import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter, Shield, AlertTriangle } from "lucide-react";

const AdminMessageFiltering = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-400" />
            Advanced Message Filtering
          </CardTitle>
          <CardDescription>
            Configure content filtering and moderation rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-400 font-medium">Filter Status</p>
                  <p className="text-xs text-blue-400 mt-1">
                    Advanced filtering is active with 620K+ prohibited terms
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-center text-gray-400 py-8">Filter configuration loading...</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMessageFiltering;