import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserManager from "@/lib/userManagement";

interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

const RouteGuard: React.FC<RouteGuardProps> = ({ 
  children, 
  requireAuth = false 
}) => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const username = await UserManager.getUsername();

        if (requireAuth && !username) {
          // Redirect unauthenticated users to index
          navigate("/", { replace: true });
          setIsChecking(false);
          return;
        }

        setIsChecking(false);
      } catch (error) {
        console.error("RouteGuard error:", error);
        navigate("/", { replace: true });
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [navigate, requireAuth]);

  if (isChecking) {
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