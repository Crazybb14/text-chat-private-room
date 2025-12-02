import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, KeyRound, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AdminAccessDialogProps {
  open: boolean;
  onClose: () => void;
}

const AdminAccessDialog = ({ open, onClose }: AdminAccessDialogProps) => {
  const navigate = useNavigate();
  const [accessMethod, setAccessMethod] = useState<"choose" | "face" | "code">("choose");
  const [code, setCode] = useState("");

  const hasFaceID = localStorage.getItem('admin_biometric_template');

  const handleFaceIDAccess = () => {
    // Check if already logged in
    const isAdmin = localStorage.getItem('isAdmin');
    if (isAdmin === 'true') {
      // Already logged in, just navigate to panel
      onClose();
      navigate('/admin-panel');
    } else {
      // Set biometric preference and navigate to login
      localStorage.setItem('admin_prefer_biometric', 'true');
      onClose();
      navigate('/admin');
    }
  };

  const handleCodeAccess = () => {
    setAccessMethod("code");
  };

  const handleCodeSubmit = () => {
    if (code === "ADMIN2024") {
      localStorage.setItem('isAdmin', 'true');
      localStorage.removeItem('admin_prefer_biometric');
      onClose();
      navigate('/admin-panel');
    } else {
      alert("Incorrect code");
      setCode("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="bg-card border-white/10 shadow-2xl max-w-md">
        <DialogHeader>
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl text-center">Admin Access</DialogTitle>
          <DialogDescription className="text-center text-gray-400">
            {accessMethod === "choose" && "Choose your preferred authentication method"}
            {accessMethod === "face" && "Scan your face to access admin panel"}
            {accessMethod === "code" && "Enter the admin access code"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {accessMethod === "choose" && (
            <>
              {hasFaceID && (
                <Button
                  onClick={handleFaceIDAccess}
                  className="w-full h-20 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg"
                >
                  <Camera className="w-6 h-6 mr-3" />
                  <div className="text-left">
                    <div className="text-lg">Use Face ID</div>
                    <div className="text-xs opacity-80">Quick biometric scan</div>
                  </div>
                </Button>
              )}
              
              <Button
                onClick={handleCodeAccess}
                variant="outline"
                className="w-full h-20 border-white/20 hover:bg-white/5 text-white font-semibold"
              >
                <KeyRound className="w-6 h-6 mr-3" />
                <div className="text-left">
                  <div className="text-lg">Use Access Code</div>
                  <div className="text-xs opacity-60">Enter admin password</div>
                </div>
              </Button>

              {!hasFaceID && (
                <p className="text-xs text-center text-gray-500 mt-4">
                  Face ID not set up. You can configure it after logging in.
                </p>
              )}
            </>
          )}

          {accessMethod === "code" && (
            <>
              <Input
                type="password"
                placeholder="Enter admin code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
                className="bg-secondary/50 border-white/10 text-white h-12 text-center text-lg"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAccessMethod("choose")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCodeSubmit}
                  disabled={!code}
                  className="flex-1 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
                >
                  Access Admin
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminAccessDialog;
