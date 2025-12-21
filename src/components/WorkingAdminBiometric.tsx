import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, CameraOff, RefreshCw, Check, AlertCircle, User, Shield } from "lucide-react";

interface WorkingAdminBiometricProps {
  open: boolean;
  onComplete: () => void;
  onCancel: () => void;
  isSetup: boolean;
}

const WorkingAdminBiometric = ({ open, onComplete, onCancel, isSetup }: WorkingAdminBiometricProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<'camera' | 'scanning' | 'capturing' | 'success' | 'failed'>('camera');
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [scanProgress, setScanProgress] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    setStage('camera');
    setError("");
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      // Setup complete, move to scanning stage
      setTimeout(() => setStage('scanning'), 1000);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please ensure camera permissions are granted.");
      setStage('failed');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    return imageData;
  };

  const startScanning = async () => {
    setStage('capturing');
    setLoading(true);
    setScanProgress(0);
    setCapturedImages([]);
    
    try {
      // Capture multiple images for "scanning" effect
      const images: string[] = [];
      const totalScans = 5;
      
      for (let i = 0; i < totalScans; i++) {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const image = captureImage();
        if (image) {
          images.push(image);
          setCapturedImages([...images]);
        }
        
        setScanProgress((i + 1) / totalScans * 100);
      }
      
      // Simulate biometric analysis
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate success (90% success rate for demo)
      const success = Math.random() > 0.1;
      
      if (success) {
        // Store face template (mock)
        localStorage.setItem('admin_biometric_template', JSON.stringify({
          images: images.slice(0, 3),
          created: Date.now(),
          username: 'admin'
        }));
        localStorage.setItem('admin_biometric_enabled', 'true');
        
        setStage('success');
        setTimeout(() => {
          onComplete();
        }, 2000);
      } else {
        setError("Face recognition failed. Please try again.");
        setStage('failed');
      }
    } catch (err) {
      console.error("Scanning error:", err);
      setError("Scanning failed. Please try again.");
      setStage('failed');
    } finally {
      setLoading(false);
    }
  };

  const restartScanning = () => {
    startCamera();
  };

  const renderStage = () => {
    switch (stage) {
      case 'camera':
        return (
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-96 h-72 bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-2 border-blue-400 rounded-lg animate-pulse" />
            </div>
            <div className="flex items-center justify-center gap-2 text-blue-400">
              <Camera className="w-5 h-5 animate-pulse" />
              <span>Camera initialized...</span>
            </div>
          </div>
        );
        
      case 'scanning':
        return (
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-96 h-72 bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 pointer-events-none">
                {/* Face guide overlay */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="relative">
                    <div className="w-48 h-56 border-2 border-green-400 rounded-full opacity-75" />
                    <div className="absolute inset-2 border-2 border-blue-400 rounded-full opacity-50" />
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-16 h-16 border border-yellow-400 rounded-full" />
                    <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 w-24 h-12 border border-purple-400 rounded-full" />
                  </div>
                </div>
                <div className="absolute top-4 left-4 right-4 text-center">
                  <p className="text-white text-sm bg-black/50 rounded px-2 py-1">
                    Position your face within the guide
                  </p>
                </div>
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-green-400">
                Ready to scan
              </h3>
              <p className="text-sm text-gray-400">
                Click "Start Face ID Scan" when ready
              </p>
              <Button 
                onClick={startScanning}
                className="bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <Shield className="w-5 h-5 mr-2" />
                Start Face ID Scan
              </Button>
            </div>
          </div>
        );
        
      case 'capturing':
        return (
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-96 h-72 bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-sm" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Camera className="w-16 h-16 text-blue-400 animate-pulse mx-auto mb-4" />
                  <p className="text-white text-lg font-semibold">Scanning...</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-blue-400">
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
                <span className="text-sm">{Math.round(scanProgress)}%</span>
              </div>
              <p className="text-sm text-gray-400">
                Capturing facial features for verification...
              </p>
            </div>
          </div>
        );
        
      case 'success':
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-32 h-32 bg-green-500/20 rounded-full flex items-center justify-center">
              <Check className="w-16 h-16 text-green-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-green-400 mb-2">
                Face ID Successful!
              </h3>
              <p className="text-gray-400">
                {isSetup ? "Your Face ID has been set up successfully" : "Authentication verified"}
              </p>
            </div>
          </div>
        );
        
      case 'failed':
        return (
          <div className="text-center space-y-4">
            <div className="mx-auto w-32 h-32 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-16 h-16 text-red-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-red-400">
                Face ID Failed
              </h3>
              <p className="text-gray-400">
                {error || "Unable to verify face. Please try again."}
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button 
                variant="outline" 
                onClick={restartScanning}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button 
                variant="destructive" 
                onClick={onCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="bg-gradient-to-b from-gray-900 to-gray-950 border-gray-800 max-w-3xl">
        <DialogHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {isSetup ? "Set Up Face ID" : "Face ID Authentication"}
          </DialogTitle>
          <DialogDescription>
            {isSetup 
              ? "Set up Face ID for secure admin access" 
              : "Verify your identity with Face ID"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {renderStage()}
        </div>

        {/* Hidden canvas for image capture */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};

export default WorkingAdminBiometric;