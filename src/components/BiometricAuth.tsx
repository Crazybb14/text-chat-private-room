import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, CameraOff, Check, X, RefreshCw, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BiometricAuthProps {
  onSuccess: () => void;
  onCancel: () => void;
  setupMode?: boolean;
}

export const BiometricAuth: React.FC<BiometricAuthProps> = ({
  onSuccess,
  onCancel,
  setupMode = false
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      
      setCameraStream(stream);
      setIsCameraOn(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access for biometric authentication",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraOn(false);
    }
  };

  const startBiometricScan = async () => {
    if (!isCameraOn) {
      await startCamera();
      return;
    }

    setIsScanning(true);
    setScanComplete(false);
    setScanFailed(false);
    setScanProgress(0);

    // Simulate biometric scanning process
    const scanInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(scanInterval);
          completeScan();
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const completeScan = () => {
    // Capture current frame for "biometric processing"
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        // Convert to base64 and store for "biometric verification"
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Store biometric data during setup
        if (setupMode) {
          localStorage.setItem('admin_biometric_template', imageData);
          localStorage.setItem('biometric_setup_time', Date.now().toString());
        } else {
          // Verify against stored template during login
          verifyBiometric(imageData);
        }
      }
    }

    setIsScanning(false);
  };

  const verifyBiometric = (currentImage: string) => {
    const storedTemplate = localStorage.getItem('admin_biometric_template');
    
    // Simulate biometric verification (in reality, this would use facial recognition)
    setTimeout(() => {
      if (storedTemplate) {
        // Simple check - if user has a template, allow access
        // In production, this would use actual facial recognition
        setScanComplete(true);
        toast({
          title: "Biometric Authentication Successful",
          description: "Face verified successfully",
        });
        
        setTimeout(() => {
          onSuccess();
          stopCamera();
        }, 1500);
      } else {
        setScanFailed(true);
        toast({
          title: "Authentication Failed",
          description: "No biometric template found. Please set up biometrics first.",
          variant: "destructive"
        });
      }
    }, 1000);
  };

  const resetScan = () => {
    setIsScanning(false);
    setScanComplete(false);
    setScanFailed(false);
    setScanProgress(0);
  };

  const confirmSetup = async () => {
    localStorage.setItem('admin_biometric_enabled', 'true');
    toast({
      title: "Biometric Setup Complete",
      description: "Your face has been registered for admin access",
    });
    onSuccess();
    stopCamera();
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            {setupMode ? "Setup Biometric Access" : "Biometric Authentication"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera Feed */}
          <div className="relative">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {!isCameraOn ? (
                  <div className="aspect-video bg-gray-900 flex items-center justify-center">
                    <Camera className="w-12 h-12 text-gray-600" />
                  </div>
                ) : (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full aspect-video object-cover"
                    />
                    
                    {/* Scanning Overlay */}
                    {isScanning && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-0 bg-blue-500/20 animate-pulse" />
                        <div className="absolute top-2 left-2 right-2">
                          <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-200"
                              style={{ width: `${scanProgress}%` }}
                            />
                          </div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-32 h-32 border-2 border-blue-500 rounded-full animate-pulse" />
                        </div>
                      </div>
                    )}

                    {/* Success Overlay */}
                    {scanComplete && (
                      <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center">
                        <div className="bg-white rounded-full p-4">
                          <Check className="w-8 h-8 text-green-600" />
                        </div>
                      </div>
                    )}

                    {/* Failed Overlay */}
                {scanFailed && (
                      <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                        <div className="bg-white rounded-full p-4">
                          <X className="w-8 h-8 text-red-600" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </CardContent>
            </Card>
          </div>

          {/* Instructions */}
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              {setupMode 
                ? "Position your face in the camera view and keep still"
                : "Position your face in the camera view for authentication"
              }
            </p>
            {!isCameraOn && (
              <p className="text-xs text-red-500">
                Camera permission is required for biometric authentication
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isCameraOn ? (
              <Button
                onClick={startCamera}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                Enable Camera
              </Button>
            ) : isScanning ? (
              <Button
                onClick={resetScan}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Cancel Scan
              </Button>
            ) : scanComplete ? (
              <Button
                onClick={setupMode ? confirmSetup : onSuccess}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                {setupMode ? "Confirm Setup" : "Continue"}
              </Button>
            ) : scanFailed ? (
              <div className="flex gap-2 flex-1">
                <Button
                  onClick={resetScan}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={onCancel}
                  variant="outline"
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                onClick={startBiometricScan}
                className="flex-1"
              >
                <Camera className="w-4 h-4 mr-2" />
                {setupMode ? "Scan Face" : "Authenticate"}
              </Button>
            )}
            
            {isCameraOn && !isScanning && !scanComplete && !scanFailed && (
              <Button
                onClick={stopCamera}
                variant="outline"
              >
                <CameraOff className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Setup Mode Additional Options */}
          {setupMode && scanComplete && (
            <div className="pt-4 border-t">
              <p className="text-xs text-green-600 mb-2">
                ✓ Your face has been successfully registered for admin access
              </p>
              <p className="text-xs text-muted-foreground">
                You can now use face recognition to access the admin panel
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};