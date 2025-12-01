import React, { useState, useEffect } from "react";
import { Lock, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";

interface LockdownSettings {
  lockdown_active: string;
  lockdown_message: string;
  lockdown_image_url: string;
  lockdown_allow_admin: string;
}

const LockdownScreen = ({ isAdmin }: { isAdmin: boolean }) => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<LockdownSettings>({
    lockdown_active: "false",
    lockdown_message: "System is currently locked down. Please try again later.",
    lockdown_image_url: "",
    lockdown_allow_admin: "true"
  });
  const [lastCheck, setLastCheck] = useState(0);

useEffect(() => {
    const loadSettings = async () => {
    try {
        const data = await db.query("lockdown_settings", {});
        const map: Partial<LockdownSettings> = {};
        data.forEach((s: { setting_key: keyof LockdownSettings; setting_value: string }) => {
      });
      } catch (error) {
        console.error("Error loading lockdown settings:", error);
      }
    };

    loadSettings();
    const interval = setInterval(loadSettings, 5000);
    return () => clearInterval(interval);
  }, []);

  // Check if lockdown is active and if admin is allowed
  const isLockdownActive = settings.lockdown_active === "true";
  const adminAllowed = settings.lockdown_allow_admin === "true";
  const shouldShowLockdown = isLockdownActive && !(isAdmin && adminAllowed);
    return () => clearInterval(interval);
}, []);

  // Check if lockdown is active and if admin is allowed
  const isLockdownActive = settings.lockdown_active === "true";
  const adminAllowed = settings.lockdown_allow_admin === "true";
  const shouldShowLockdown = isLockdownActive && !(isAdmin && adminAllowed);

  if (!shouldShowLockdown) {
    return null;
  }
  if (!shouldShowLockdown) {
    return null;
  }

  const handleRefresh = () => {
    setLastCheck(Date.now());
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-black to-orange-900/20 animate-pulse" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-red-500/10 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '0s' }} />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="h-full w-full" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(239, 68, 68, 0.1) 2px, rgba(239, 68, 68, 0.1) 4px)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-2xl w-full">
        {/* Lock icon with animation */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <Lock className="w-24 h-24 text-red-500 mb-4 animate-pulse" />
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-black" />
            </div>
          </div>
        </div>

        {/* Custom image if provided */}
        {settings.lockdown_image_url && (
          <div className="mb-8 text-center">
            <img 
              src={settings.lockdown_image_url} 
              alt="Lockdown"
              className="max-w-full max-h-64 mx-auto rounded-lg shadow-2xl"
            />
          </div>
        )}

        {/* Lockdown message */}
        <div className="bg-black/80 backdrop-blur-sm border border-red-500/50 rounded-xl p-8 shadow-2xl">
          <h1 className="text-4xl font-bold text-red-500 mb-4 text-center animate-pulse">
            🔒 SYSTEM LOCKDOWN
          </h1>
          
          <div className="text-center space-y-4">
            <p className="text-xl text-white/90">
              {settings.lockdown_message}
            </p>
            
            <div className="space-y-2 text-sm text-red-400">
              <p>⚠️ This is a security measure</p>
              <p>⚠️ All access has been temporarily restricted</p>
              <p>⚠️ Please wait for system administrators to resolve this</p>
            </div>

            {/* Status indicators */}
            <div className="flex justify-center gap-4 mt-6">
              <div className="text-center">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse mx-auto mb-1" />
                <p className="text-xs text-red-400">LOCKED</p>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse mx-auto mb-1" />
                <p className="text-xs text-yellow-400">MONITORING</p>
              </div>
              <div className="text-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse mx-auto mb-1" />
                <p className="text-xs text-blue-400">SECURED</p>
              </div>
            </div>
          </div>

          {/* Refresh button */}
          <div className="text-center mt-8">
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Status
            </Button>
          </div>

          {/* Timestamp */}
          <div className="text-center mt-6">
            <p className="text-xs text-gray-500">
              Last checked: {new Date(lastCheck || Date.now()).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Additional warnings */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <p className="text-sm text-yellow-300">
              System administrators are aware of this situation
            </p>
          </div>
        </div>
      </div>

      {/* Animated scan lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-px bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-30 animate-pulse" 
             style={{ 
               animation: 'scan 4s linear infinite',
               position: 'absolute',
               top: '20%',
               left: 0,
               right: 0
             }} />
        <div className="h-px bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-20 animate-pulse" 
             style={{ 
               animation: 'scan 4s linear infinite 2s',
               position: 'absolute',
               top: '60%',
               left: 0,
               right: 0
             }} />
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default LockdownScreen;