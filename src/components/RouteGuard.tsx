import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import db from "@/lib/shared/kliv-database.js";
import UserManager from "@/lib/userManagement";
import EnhancedIPLogger from "@/lib/enhancedIPLogger";

interface RouteGuardProps {
  children: React.ReactNode;
  requireTOS?: boolean;
  requireAuth?: boolean;
}

const RouteGuard = ({ children, requireTOS = false, requireAuth = false }: RouteGuardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checking, setChecking] = useState(true);
  const ipLogger = EnhancedIPLogger.getInstance();

  useEffect(() => {
    const checkRequirements = async () => {
      try {
        // Check if user has accepted TOS if required
        if (requireTOS) {
          const username = await UserManager.getUsername();
          const deviceId = ipLogger.getDeviceId();
          
          if (!username) {
            navigate("/");
            return;
          }

          const existing = await db.query("tos_agreements", {
            device_id: `eq.${deviceId}`,
            username: `eq.${username}`,
            tos_version: "eq.1.0"
          });

          if (existing.length === 0) {
            navigate("/terms");
            return;
          }
        }

        // Check if user is authenticated if required
        if (requireAuth) {
          const username = await UserManager.getUsername();
          if (!username) {
            navigate("/");
            return;
          }
        }

        setChecking(false);
      } catch (error) {
        console.error("Error checking requirements:", error);
        setChecking(false);
        
        toast({
          title: "⚠️ Error",
          description: "Failed to verify requirements. Please try again.",
          variant: "destructive",
        });
      }
    };

    checkRequirements();
  }, [navigate, requireTOS, requireAuth]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Checking requirements...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RouteGuard;