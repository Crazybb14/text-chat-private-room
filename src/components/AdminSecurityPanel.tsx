import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Key, Fingerprint, AlertTriangle } from "lucide-react";

const AdminSecurityPanel = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Biometric Authentication
          </CardTitle>
          <CardDescription>
            Face ID authentication status and management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Fingerprint className="w-6 h-6 text-green-400" />
                <div>
                  <p className="font-medium">Face ID Status</p>
                  <p className="text-sm text-gray-400">Admin authentication method active</p>
                </div>
              </div>
              <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                Enabled
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Key className="w-6 h-6 text-blue-400" />
                <div>
                  <p className="font-medium">Admin Codes</p>
                  <p className="text-sm text-gray-400">Backup verification codes available</p>
                </div>
              </div>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                Available
              </Badge>
            </div>

            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-400 font-medium">Security Notice</p>
                  <p className="text-xs text-yellow-400 mt-1">
                    Face ID provides biometric authentication with device fingerprinting. 
                    Admin codes allow access even if biometrics fail.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Logs</CardTitle>
          <CardDescription>
            Recent authentication attempts and security events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-400 py-8">Security logs loading...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSecurityPanel;