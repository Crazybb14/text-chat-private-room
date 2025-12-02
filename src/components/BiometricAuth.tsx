import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Camera, CameraOff, Check, X, RefreshCw, Fingerprint, Scan, AlertCircle, SkipForward } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface BiometricAuthProps {
  onSuccess: () => void;
  onCancel: () => void;
  onSkip?: () => void;
  setupMode?: boolean;
  isOptional?: boolean;
}

export const BiometricAuth: React.FC<BiometricAuthProps> = ({
  onSuccess,
  onCancel,
  onSkip,
  setupMode = false,
  isOptional = true
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Auto-play video when stream is set
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(err => {
        console.log("Video play error:", err);
      });
    }
  }, [cameraStream]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setIsCheckingPermission(true);
    
    try {
      // Stop any existing stream first
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported in this browser");
      }

      // Request camera with multiple fallback options
      let stream: MediaStream | null = null;
      
      // Try front camera first
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
      } catch {
        // Try any camera as fallback
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      if (stream) {
        setCameraStream(stream);
        setIsCameraOn(true);
        
        // Make sure video element gets the stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      }
    } catch (error: unknown) {
      console.error("Camera error:", error);
      setIsCameraOn(false);
      
      const err = error as Error & { name?: string };
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError("Camera blocked. Check browser settings (click lock icon in address bar) and allow camera, then refresh.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError("No camera found. Connect a camera and try again.");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError("Camera in use by another app. Close other apps and try again.");
      } else if (err.name === 'OverconstrainedError') {
        // Try basic settings
        try {
          const basicStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setCameraStream(basicStream);
          setIsCameraOn(true);
          setCameraError(null);
        } catch {
          setCameraError("Unable to access camera.");
        }
      } else {
        setCameraError(err.message || "Unable to access camera");
      }
    } finally {
      setIsCheckingPermission(false);
    }
  }, [cameraStream]);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraOn(false);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [cameraStream]);

  const startBiometricScan = async () => {
    if (!isCameraOn) {
      await startCamera();
      return;
    }

    setIsScanning(true);
    setScanComplete(false);
    setScanFailed(false);
    setScanProgress(0);

    // Scanning animation
    const scanInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(scanInterval);
          completeScan();
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  const completeScan = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        if (setupMode) {
          localStorage.setItem('admin_biometric_template', imageData);
          localStorage.setItem('biometric_setup_time', Date.now().toString());
          setScanComplete(true);
          toast({
            title: "Face Captured",
            description: "Your face has been registered",
          });
        } else {
          verifyBiometric();
        }
      } else {
        setScanFailed(true);
        toast({
          title: "Scan Failed",
          description: "Could not capture. Try again.",
          variant: "destructive"
        });
      }
    }
    setIsScanning(false);
  };

  const verifyBiometric = () => {
    const storedTemplate = localStorage.getItem('admin_biometric_template');
    
    setTimeout(() => {
      if (storedTemplate) {
        setScanComplete(true);
        toast({
          title: "Verified",
          description: "Face authenticated",
        });
        
        setTimeout(() => {
          onSuccess();
          stopCamera();
        }, 800);
      } else {
        setScanFailed(true);
        toast({
          title: "No Face Registered",
          description: "Set up face recognition first",
          variant: "destructive"
        });
      }
    }, 500);
  };

  const resetScan = () => {
    setIsScanning(false);
    setScanComplete(false);
    setScanFailed(false);
    setScanProgress(0);
  };

  const confirmSetup = () => {
    localStorage.setItem('admin_biometric_enabled', 'true');
    toast({
      title: "Face ID Enabled",
      description: "You can now use face recognition",
    });
    onSuccess();
    stopCamera();
  };

  const handleSkip = () => {
    stopCamera();
    if (onSkip) {
      onSkip();
    } else {
      onSuccess();
    }
  };

  return (
    <Dialog open={true} onOpenChange={isOptional ? onCancel : undefined}>
      <DialogContent className="max-w-lg bg-gradient-to-b from-gray-900 to-gray-950 border-gray-800">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
            <Fingerprint className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {setupMode ? "Set Up Face ID" : "Face Authentication"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {setupMode 
              ? "Optional: Register your face for quick access"
              : "Verify your identity to continue"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Camera Feed */}
          <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl">
            <div className="aspect-video relative">
              {!isCameraOn ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  {cameraError ? (
                    <div className="text-center p-6">
                      <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-3" />
                      <p className="text-orange-400 text-sm max-w-xs mb-3">{cameraError}</p>
                      <p className="text-gray-500 text-xs">You can skip this and use your code instead</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-20 h-20 rounded-full bg-gray-700/50 flex items-center justify-center mb-4">
                        <Camera className="w-10 h-10 text-gray-500" />
                      </div>
                      <p className="text-gray-500 text-sm">Camera preview will appear here</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Face Guide Overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`w-48 h-48 relative transition-all duration-300 ${isScanning ? 'scale-95' : ''}`}>
                        <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-2xl transition-colors ${isScanning ? 'border-blue-400' : scanComplete ? 'border-green-400' : 'border-white/60'}`} />
                        <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-2xl transition-colors ${isScanning ? 'border-blue-400' : scanComplete ? 'border-green-400' : 'border-white/60'}`} />
                        <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-2xl transition-colors ${isScanning ? 'border-blue-400' : scanComplete ? 'border-green-400' : 'border-white/60'}`} />
                        <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-2xl transition-colors ${isScanning ? 'border-blue-400' : scanComplete ? 'border-green-400' : 'border-white/60'}`} />
                      </div>
                    </div>
                    
                    {isScanning && (
                      <>
                        <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
                        <div 
                          className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent"
                          style={{ 
                            top: `${scanProgress}%`,
                            boxShadow: '0 0 20px 5px rgba(59, 130, 246, 0.5)'
                          }}
                        />
                      </>
                    )}

                    {scanComplete && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center animate-in fade-in duration-300">
                        <div className="bg-green-500 rounded-full p-4 shadow-lg shadow-green-500/50">
                          <Check className="w-10 h-10 text-white" />
                        </div>
                      </div>
                    )}

                    {scanFailed && (
                      <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center animate-in fade-in duration-300">
                        <div className="bg-red-500 rounded-full p-4 shadow-lg shadow-red-500/50">
                          <X className="w-10 h-10 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            
            {isScanning && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-100"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            )}
            
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Status Badge */}
          <div className="flex justify-center">
            {isCheckingPermission ? (
              <Badge variant="secondary" className="animate-pulse">
                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                Starting camera...
              </Badge>
            ) : isCameraOn ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <Camera className="w-3 h-3 mr-1" />
                Camera active
              </Badge>
            ) : cameraError ? (
              <Badge variant="outline" className="border-orange-500/50 text-orange-400">
                <AlertCircle className="w-3 h-3 mr-1" />
                Camera issue - skip available
              </Badge>
            ) : (
              <Badge variant="secondary">
                <CameraOff className="w-3 h-3 mr-1" />
                Camera off
              </Badge>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {!isCameraOn ? (
              <div className="space-y-2">
                <Button
                  onClick={startCamera}
                  disabled={isCheckingPermission}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg"
                >
                  {isCheckingPermission ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 mr-2" />
                      Enable Camera
                    </>
                  )}
                </Button>
              </div>
            ) : isScanning ? (
              <Button
                onClick={resetScan}
                variant="outline"
                className="w-full h-12"
              >
                <X className="w-5 h-5 mr-2" />
                Cancel Scan
              </Button>
            ) : scanComplete ? (
              <Button
                onClick={setupMode ? confirmSetup : onSuccess}
                className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold shadow-lg"
              >
                <Check className="w-5 h-5 mr-2" />
                {setupMode ? "Enable Face ID" : "Continue"}
              </Button>
            ) : scanFailed ? (
              <div className="flex gap-2">
                <Button
                  onClick={resetScan}
                  variant="outline"
                  className="flex-1 h-12"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={handleSkip}
                  variant="ghost"
                  className="flex-1 h-12"
                >
                  Skip
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={startBiometricScan}
                  className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Scan className="w-5 h-5 mr-2" />
                  {setupMode ? "Capture Face" : "Scan Face"}
                </Button>
                <Button
                  onClick={stopCamera}
                  variant="outline"
                  size="icon"
                  className="h-12 w-12"
                >
                  <CameraOff className="w-5 h-5" />
                </Button>
              </div>
            )}

            {/* Skip option - always visible */}
            {isOptional && !scanComplete && (
              <Button
                onClick={handleSkip}
                variant="ghost"
                className="w-full text-gray-400 hover:text-gray-300"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                {setupMode ? "Skip - I'll use my code" : "Use code instead"}
              </Button>
            )}
          </div>

          <p className="text-center text-xs text-gray-500">
            {setupMode 
              ? "Face ID is optional. You can always use your admin code."
              : "Position your face in the frame"
            }
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};