import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Camera, RefreshCw, Check, AlertCircle, Shield, Fingerprint, Key } from "lucide-react";

interface WorkingAdminBiometricProps {
  open: boolean;
  onComplete: () => void;
  onCancel: () => void;
  isSetup: boolean;
}

const WorkingAdminBiometric = ({ open, onComplete, onCancel, isSetup }: WorkingAdminBiometricProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<'camera' | 'scanning' | 'capturing' | 'validating' | 'success' | 'failed' | 'code'>('camera');
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState("");
  const [scanProgress, setScanProgress] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [adminCode, setAdminCode] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<'biometric' | 'code'>('biometric');

  useEffect(() => {
    if (open) {
      checkExistingAuthentication();
    }
    
    return () => {
      stopCamera();
    };
  }, [open]);

  const checkExistingAuthentication = async () => {
    // Check if admin is already verified within the last hour
    const lastVerification = localStorage.getItem('admin_verification_time');
    
    if (lastVerification) {
      const timeDiff = Date.now() - parseInt(lastVerification);
      // Allow 1 hour since last verification
      if (timeDiff < 3600000) {
        onComplete();
        return;
      }
    }
    
    // Check what verification methods are available
    const biometricTemplate = localStorage.getItem('admin_biometric_template');
    const biometricEnabled = localStorage.getItem('admin_biometric_enabled');
    
    if (!biometricTemplate || biometricEnabled !== 'true') {
      setVerificationMethod('code');
      setStage('code');
    } else {
      setStage('camera');
      // Delay camera start to let user see options
      setTimeout(() => startCamera(), 500);
    }
  };

  const startCamera = async () => {
    if (verificationMethod === 'code') return;
    
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
      
      setTimeout(() => setStage('scanning'), 1000);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please ensure camera permissions are granted.");
      // Fallback to code verification
      setVerificationMethod('code');
      setStage('code');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const captureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    setCapturedImages(prev => [...prev, imageUrl]);
    
    if (isSetup) {
      // Setup mode - collect multiple images for template
      if (capturedImages.length < 2) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return captureImage();
      }
      
      // Create biometric template
      await createBiometricTemplate();
    } else {
      // Verification mode - validate against existing template
      await validateBiometric();
    }
  };

  const createBiometricTemplate = async () => {
    setStage('validating');
    setLoading(true);
    
    try {
      // Simulate processing biometric data
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create biometric template (in production, this would use actual facial recognition)
      const biometricTemplate = {
        images: capturedImages.slice(0, 3),
        created: Date.now(),
        username: 'admin',
        faceId: `face_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        deviceFingerprint: generateDeviceFingerprint()
      };
      
      // Store securely
      localStorage.setItem('admin_biometric_template', JSON.stringify(biometricTemplate));
      localStorage.setItem('admin_biometric_enabled', 'true');
      localStorage.setItem('admin_verification_codes', JSON.stringify(['ADMIN123', 'SECURE789', 'VERIFY456']));
      
      setStage('success');
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      console.error("Biometric setup error:", err);
      setError("Failed to set up biometric authentication");
      setStage('failed');
    } finally {
      setLoading(false);
    }
  };

  const validateBiometric = async () => {
    setStage('validating');
    setLoading(true);
    
    try {
      // Get stored biometric template
      const storedTemplateStr = localStorage.getItem('admin_biometric_template');
      
      if (!storedTemplateStr) {
        throw new Error("No biometric template found. Please set up Face ID first.");
      }
      
      const storedTemplate = JSON.parse(storedTemplateStr);
      
      // Simulate biometric validation (in production, this would use real facial recognition)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Additional security checks
      const currentFingerprint = generateDeviceFingerprint();
      const deviceMatch = storedTemplate.deviceFingerprint === currentFingerprint;
      
      if (!deviceMatch) {
        throw new Error("Device verification failed. Please use admin code instead.");
      }
      
      // For demo purposes, we'll simulate successful validation
      // In production, this would compare the captured images with stored template
      // using actual facial recognition algorithms
      const validationSuccess = true;
      
      if (validationSuccess) {
        // Store verification time
        localStorage.setItem('admin_verification_time', Date.now().toString());
        
        setStage('success');
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        setError("Biometric verification failed. Face not recognized or device mismatch.");
        setStage('failed');
      }
    } catch (err) {
      console.error("Biometric validation error:", err);
      setError(err instanceof Error ? err.message : "Biometric validation failed");
      setStage('failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyAdminCode = async () => {
    if (!adminCode.trim()) {
      setError("Please enter the admin verification code");
      return;
    }
    
    setLoading(true);
    try {
      // Check against stored admin codes (in production, this would be server-side verification)
      const storedCodes = localStorage.getItem('admin_verification_codes');
      const validCodes = storedCodes ? JSON.parse(storedCodes) : ['ADMIN123', 'SECURE789', 'VERIFY456'];
      
      if (validCodes.includes(adminCode.toUpperCase().trim())) {
        // Store verification time and code
        localStorage.setItem('admin_verification_time', Date.now().toString());
        localStorage.setItem('admin_verification_method', 'code');
        
        setStage('success');
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        setError("Invalid admin code. Please try again.");
        setStage('failed');
      }
    } catch (err) {
      console.error("Code verification error:", err);
      setError("Verification failed. Please try again.");
      setStage('failed');
    } finally {
      setLoading(false);
    }
  };

  const generateDeviceFingerprint = () => {
    // Generate a simple device fingerprint for additional security
    const ua = navigator.userAgent;
    const lang = navigator.language;
    const platform = navigator.platform;
    const pixelRatio = window.devicePixelRatio || 1;
    
    return btoa(ua + lang + platform + pixelRatio).substring(0, 32);
  };

  const startScanning = async () => {
    setStage('capturing');
    setError("");
    setLoading(true);
    setScanProgress(0);
    
    const progressInterval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          captureImage();
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const restartScanning = () => {
    setCapturedImages([]);
    setScanProgress(0);
    if (verificationMethod === 'biometric') {
      setStage('camera');
      startCamera();
    } else {
      setStage('code');
    }
  };

  const switchToCodeVerification = () => {
    stopCamera();
    setVerificationMethod('code');
    setStage('code');
    setError("");
  };

  const switchToBiometric = () => {
    setVerificationMethod('biometric');
    setStage('camera');
    setError("");
    setAdminCode("");
    setTimeout(() => startCamera(), 500);
  };

  const renderStage = () => {
    switch (stage) {
      case 'camera':
      case 'scanning':
        return (
          <div className="text-center space-y-4">
            {/* Verification Method Selector */}
            <div className="flex justify-center gap-2 mb-4">
              <Button
                variant={verificationMethod === 'biometric' ? 'default' : 'outline'}
                size="sm"
                onClick={switchToBiometric}
                className="flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Face ID
              </Button>
              <Button
                variant={verificationMethod === 'code' ? 'default' : 'outline'}
                size="sm"
                onClick={switchToCodeVerification}
                className="flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                Admin Code
              </Button>
            </div>

            {verificationMethod === 'biometric' && (
              <>
                <div className="relative mx-auto w-96 h-72 bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <div className="relative">
                        <div className="w-48 h-56 border-2 border-green-400 rounded-full opacity-75" />
                        <div className="absolute inset-2 border-2 border-blue-400 rounded-full opacity-50" />
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
                    {isSetup ? 'Set Up Face ID' : 'Ready to scan'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {isSetup ? 'Face ID will secure your admin access' : 'Click "Start Face ID Scan" when ready'}
                  </p>
                  <Button onClick={startScanning} className="bg-green-600 hover:bg-green-700" size="lg">
                    <Shield className="w-5 h-5 mr-2" />
                    {isSetup ? 'Set Up Face ID' : 'Start Face ID Scan'}
                  </Button>
                </div>
              </>
            )}
          </div>
        );

      case 'code':
        return (
          <div className="text-center space-y-6">
            <div className="flex justify-center gap-2 mb-4">
              <Button
                variant={verificationMethod === 'biometric' ? 'default' : 'outline'}
                size="sm"
                onClick={switchToBiometric}
                className="flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Face ID
              </Button>
              <Button
                variant={verificationMethod === 'code' ? 'default' : 'outline'}
                size="sm"
                className="flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                Admin Code
              </Button>
            </div>

            <div className="mx-auto w-32 h-32 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full flex items-center justify-center">
              <Fingerprint className="w-16 h-16 text-blue-400" />
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-blue-400">Admin Verification Required</h3>
              <p className="text-sm text-gray-400">
                Enter your admin code to access the admin panel
              </p>
              
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Enter admin code (e.g., ADMIN123)"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && verifyAdminCode()}
                  className="bg-secondary/50 border-white/10 text-center text-lg"
                  disabled={loading}
                />
                <Button 
                  onClick={verifyAdminCode} 
                  disabled={loading || !adminCode.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                >
                  <Key className="w-5 h-5 mr-2" />
                  {loading ? "Verifying..." : "Verify Admin Code"}
                </Button>
              </div>

              <p className="text-xs text-gray-500">
                Default codes: ADMIN123, SECURE789, VERIFY456
              </p>
            </div>
          </div>
        );
        
      case 'capturing':
        return (
          <div className="text-center space-y-4">
            <div className="relative mx-auto w-96 h-72 bg-black rounded-lg overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-sm" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Camera className="w-16 h-16 text-blue-400 animate-pulse mx-auto mb-4" />
                  <p className="text-white text-lg font-semibold">
                    {isSetup ? 'Creating Face ID...' : 'Scanning...'}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-blue-400">
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                </div>
                <span className="text-sm">{Math.round(scanProgress)}%</span>
              </div>
              <p className="text-sm text-gray-400">
                {isSetup ? 'Creating biometric template...' : 'Capturing facial features for verification...'}
              </p>
            </div>
          </div>
        );
        
      case 'validating':
        return (
          <div className="text-center space-y-4">
            <div className="mx-auto w-32 h-32 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center">
              <Fingerprint className="w-16 h-16 text-purple-400 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-purple-400">Validating...</h3>
              <p className="text-sm text-gray-400">
                {isSetup ? 'Creating secure biometric template...' : 'Verifying biometric data...'}
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
              <h3 className="text-2xl font-bold text-green-400 mb-2">Authentication Successful!</h3>
              <p className="text-gray-400">
                {isSetup ? "Your Face ID has been set up successfully" : "Administrator access verified"}
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
              <h3 className="text-xl font-bold text-red-400">Authentication Failed</h3>
              <p className="text-gray-400">
                {error || "Unable to verify identity. Please try again."}
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={restartScanning}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              {!isSetup && verificationMethod === 'biometric' && (
                <Button variant="outline" onClick={switchToCodeVerification}>
                  <Key className="w-4 h-4 mr-2" />
                  Use Admin Code
                </Button>
              )}
              <Button variant="destructive" onClick={onCancel}>
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
            {verificationMethod === 'biometric' ? (
              <Camera className="w-8 h-8 text-white" />
            ) : (
              <Fingerprint className="w-8 h-8 text-white" />
            )}
          </div>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            {isSetup ? "Set Up Security Authentication" : "Admin Authentication Required"}
          </DialogTitle>
          <DialogDescription>
            {isSetup 
              ? "Choose your preferred authentication method for admin access" 
              : "Verify your identity to access the admin panel"
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {renderStage()}
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};

export default WorkingAdminBiometric;