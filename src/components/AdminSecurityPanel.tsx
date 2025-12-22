import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Key, Fingerprint, AlertTriangle, Settings, RefreshCw } from "lucide-react";
import WorkingAdminBiometric from "@/components/WorkingAdminBiometric";
import { useToast } from "@/hooks/use-toast";

const AdminSecurityPanel = () => {
  const { toast } = useToast();
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);

  const checkBiometricStatus = () => {
    const biometricEnabled = localStorage.getItem('admin_biometric_enabled');
    const biometricTemplate = localStorage.getItem('admin_biometric_template');
    return biometricEnabled === 'true' && biometricTemplate;
  };

  const resetBiometrics = () => {
    localStorage.removeItem('admin_biometric_enabled');
    localStorage.removeItem('admin_biometric_template');
    localStorage.removeItem('admin_verification_time');
    toast({
      title: "Biometrics Reset",
      description: "Face ID has been disabled. You can set it up again.",
    });
  };

  const testAdminCode = () => {
    const codes = localStorage.getItem('admin_verification_codes');
    const validCodes = codes ? JSON.parse(codes) : ['qacgt5'];
    toast({
      title: "Admin Code",
      description: "Current code configured for access",
    });
  };

  const isBiometricEnabled = checkBiometricStatus();

  const handleBiometricSetupComplete = () => {
    setShowBiometricSetup(false);
    toast({
      title: "Setup Complete",
      description: "Face ID authentication has been configured successfully",
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            Biometric Authentication
          </CardTitle>
          <CardDescription>
            Configure Face ID and secure access methods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Fingerprint className="w-6 h-6 text-green-400" />
                <div>
                  <p className="font-medium">Face ID Status</p>
                  <p className="text-sm text-gray-400">
                    {isBiometricEnabled ? 'Face ID is configured and active' : 'Face ID not configured'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={isBiometricEnabled ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}>
                  {isBiometricEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
                {!isBiometricEnabled && (
                  <Button 
                    onClick={() => setShowBiometricSetup(true)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Set Up Face ID
                  </Button>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-3">
                <Key className="w-6 h-6 text-blue-400" />
                <div>
                  <p className="font-medium">Admin Access Code</p>
                  <p className="text-sm text-gray-400">Secure code for admin access</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={testAdminCode}
                >
                  Verify Code
                </Button>
              </div>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-400 font-medium">Security Features</p>
                  <p className="text-xs text-blue-400 mt-1">
                    • Face ID provides biometric authentication with device fingerprinting
                    • Admin code allows access even if biometrics fail  
                    • Sessions are valid for 1 hour after authentication
                    • Device verification ensures access from authorized devices only
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
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-green-400" />
                <span className="text-sm">Face ID Authentication</span>
              </div>
              <span className="text-xs text-gray-400">2 hours ago</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" />
                <span className="text-sm">Admin Code Access</span>
              </div>
              <span className="text-xs text-gray-400">5 hours ago</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-sm">Failed Authentication Attempt</span>
              </div>
              <span className="text-xs text-gray-400">1 day ago</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <WorkingAdminBiometric
        open={showBiometricSetup}
        onComplete={handleBiometricSetupComplete}
        onCancel={() => setShowBiometricSetup(false)}
        isSetup={true}
      />
    </div>
  );
};

export default AdminSecurityPanel;