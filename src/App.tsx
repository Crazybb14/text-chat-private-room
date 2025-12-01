import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from 'react';
import Index from "./pages/Index";
import ChatRoom from "./pages/ChatRoom";
import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import Suggestions from "./pages/Suggestions";
import Appeal from "./pages/Appeal";
import NotFound from "./pages/NotFound";
import TermsOfService from "./pages/TermsOfService";
import RouteGuard from "./components/RouteGuard";
import LockdownScreenFixed from "./components/LockdownScreenFixed";

const queryClient = new QueryClient();

const App = () => {
  // Check for lockdown mode and admin status
  const [isLockdownActive, setIsLockdownActive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkLockdownStatus = async () => {
      try {
        const db = (await import('./lib/shared/kliv-database.js')).default;
        const lockdownData = await db.query("lockdown_settings", {
          setting_key: "eq.lockdown_active"
        });
        
        if (lockdownData.length > 0 && lockdownData[0].setting_value === "true") {
          setIsLockdownActive(true);
          
          // Check if admin is allowed
          const allowAdminData = await db.query("lockdown_settings", {
            setting_key: "eq.lockdown_allow_admin"
          });
          
          const allowAdmin = allowAdminData.length > 0 && allowAdminData[0].setting_value === "true";
          
          // Check if current user is admin (simplified check)
          const isAdminUser = window.location.pathname.includes('/admin');
          setIsAdmin(allowAdmin && isAdminUser);
        }
      } catch (error) {
        console.warn('Failed to check lockdown status:', error);
      }
    };

    checkLockdownStatus();
    const interval = setInterval(checkLockdownStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Show lockdown screen if active
  if (isLockdownActive) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <LockdownScreenFixed isAdmin={isAdmin} />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route 
              path="/chat/:roomId" 
              element={
                <RouteGuard requireTOS={true}>
                  <ChatRoom />
                </RouteGuard>
              } 
            />
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/panel" element={<AdminPanel />} />
            <Route path="/suggestions" element={<Suggestions />} />
            <Route path="/appeal" element={<Appeal />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;