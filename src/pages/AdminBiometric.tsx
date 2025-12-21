import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, ArrowLeft, Check } from "lucide-react";
import { BiometricAuth } from "@/components/BiometricAuth";

const AdminBiometric = () => {
  const navigate = useNavigate();

  const onSuccess = () => {
    localStorage.setItem('isAdmin', 'true');
    navigate('/admin-panel');
  };

  const onCancel = () => {
    navigate('/');
  };

  return (
    <Dialog open={true} onOpenChange={undefined}>
      <DialogContent className="max-w-lg bg-gradient-to-b from-gray-900 to-gray-950 border-gray-800">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Face Authentication
          </DialogTitle>
          <p className="text-gray-400 text-sm mt-2">
            Position your face in the camera to scan your identity
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <BiometricAuth
            onSuccess={onSuccess}
            onCancel={onCancel}
            setupMode={false}
            isOptional={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminBiometric;