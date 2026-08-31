import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import UserManager from "@/lib/userManagement";
import { isOwnerSession } from "@/lib/owner";

// Fallback admin password for non-owner admins
const ADMIN_PASSWORD = "qacgt5555$";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Owner accounts skip the code entirely — the platform vouches for them.
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const session = await UserManager.getSession().catch(() => null);
      if (cancelled) return;
      if (isOwnerSession(session)) {
        localStorage.setItem("isAdmin", "true");
        toast({ title: "Owner account recognized", description: "Opening the admin panel…" });
        navigate("/admin/panel", { replace: true });
        return;
      }
      setChecking(false);
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [navigate, toast]);

  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        localStorage.setItem("isAdmin", "true");
        toast({
          title: "Welcome, Admin!",
          description: "You have successfully logged in",
        });
        navigate("/admin/panel");
      } else {
        toast({
          title: "Invalid password",
          description: "Please enter the correct password",
          variant: "destructive",
        });
      }
      setIsLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-red-900/20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />

      <div className="relative z-10 w-full max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <Card className="glass-morphism border-white/10 shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/30 to-purple-500/30 flex items-center justify-center mb-4 shadow-lg">
              <Shield className="w-10 h-10 text-red-400" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-red-400 to-purple-400 bg-clip-text text-transparent">
              Admin Access
            </CardTitle>
            <CardDescription className="text-base">
              {checking ? "Checking your account…" : "Owner accounts enter automatically"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checking ? (
              <div className="py-8 flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="w-7 h-7 animate-spin" />
                <p className="text-sm">Signing you in as the owner…</p>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-secondary/50 border-white/10 pl-11 pr-11 h-12 text-lg"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !password}
                  className="w-full h-12 text-lg bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-700 hover:to-purple-700 shadow-lg"
                >
                  {isLoading ? "Verifying..." : "Access Admin Panel"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Signed in with an owner account? Just open this page — no password needed.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
