import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, Eye, EyeOff, Loader2, Lock, KeyRound, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { functions } from "@/lib/shared/kliv-functions.js";
import UserManager from "@/lib/userManagement";
import { isOwnerSession } from "@/lib/owner";
import { allPermissions, saveAdminSession } from "@/lib/adminAccounts";

// Fallback admin password for the owner's own code entry
const ADMIN_PASSWORD = "qacgt5555$";

interface AdminAuthResult {
  ok?: boolean;
  invite?: boolean;
  username?: string;
  permissions?: Record<string, boolean>;
  error?: string;
}

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Admin-account sign-in
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);
  const [inviteStep, setInviteStep] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newPassConfirm, setNewPassConfirm] = useState("");

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

  const enterPanelAs = (username: string, permissions?: Record<string, boolean>) => {
    saveAdminSession({ username, permissions: permissions ?? allPermissions() });
    localStorage.setItem("isAdmin", "true");
    toast({ title: `Welcome, ${username}!`, description: "You have successfully logged in" });
    navigate("/admin/panel");
  };

  const handleOwnerLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      if (password === ADMIN_PASSWORD) {
        enterPanelAs("owner");
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

  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const username = adminUser.trim().toLowerCase();
    if (!username || !adminPass) return;
    setAdminBusy(true);
    try {
      const result = await functions.post<AdminAuthResult>("staff-auth", {
        action: "login",
        username,
        password: adminPass,
      });
      if (result?.invite) {
        setInviteStep(true);
        toast({
          title: "Set your password",
          description: "Enter the invite code the site owner gave you, then pick a password.",
        });
        return;
      }
      if (result?.ok) {
        enterPanelAs(result.username ?? username, result.permissions);
        return;
      }
      toast({ title: "Sign-in failed", description: result?.error ?? "Please try again.", variant: "destructive" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast({ title: "Sign-in failed", description: message || "Please try again.", variant: "destructive" });
    } finally {
      setAdminBusy(false);
    }
  };

  const handleActivate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const username = adminUser.trim().toLowerCase();
    if (!username || !inviteCode.trim()) return;
    if (newPass.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPass !== newPassConfirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setAdminBusy(true);
    try {
      const activate = await functions.post<AdminAuthResult>("staff-auth", {
        action: "activate",
        username,
        inviteCode: inviteCode.trim().toUpperCase(),
        password: newPass,
      });
      if (!activate?.ok) {
        toast({ title: "Couldn't set that password", description: activate?.error ?? "Check the invite code.", variant: "destructive" });
        return;
      }
      const login = await functions.post<AdminAuthResult>("staff-auth", {
        action: "login",
        username,
        password: newPass,
      });
      if (login?.ok) {
        enterPanelAs(login.username ?? username, login.permissions);
      } else {
        toast({ title: "Password set — now sign in", description: "Use your new password." });
        setInviteStep(false);
        setAdminPass("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast({ title: "Couldn't set that password", description: message || "Please try again.", variant: "destructive" });
    } finally {
      setAdminBusy(false);
    }
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
              {checking ? "Checking your account…" : "Owners enter automatically"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {checking ? (
              <div className="py-8 flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="w-7 h-7 animate-spin" />
                <p className="text-sm">Signing you in as the owner…</p>
              </div>
            ) : inviteStep ? (
              <form onSubmit={handleActivate} className="space-y-4">
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="font-medium flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary" /> Welcome, @{adminUser.toLowerCase()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You've been made an admin. Enter your invite code and choose the password you'll
                    use from now on.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-code">Invite code</Label>
                  <Input
                    id="invite-code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="8-character code"
                    className="text-center font-mono tracking-widest uppercase"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-pass">Your new password</Label>
                  <Input
                    id="new-pass"
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    minLength={8}
                    placeholder="At least 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-pass-2">Confirm password</Label>
                  <Input
                    id="new-pass-2"
                    type="password"
                    value={newPassConfirm}
                    onChange={(e) => setNewPassConfirm(e.target.value)}
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="w-full h-12" disabled={adminBusy || !inviteCode.trim() || newPass.length < 8}>
                  {adminBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                  Set password &amp; enter
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setInviteStep(false)}>
                  Back to sign in
                </Button>
              </form>
            ) : (
              <Tabs defaultValue="code">
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="code">Owner code</TabsTrigger>
                  <TabsTrigger value="admin">Admin sign-in</TabsTrigger>
                </TabsList>

                <TabsContent value="code">
                  <form onSubmit={handleOwnerLogin} className="space-y-5">
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
                        aria-label={showPassword ? "Hide password" : "Show password"}
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
                </TabsContent>

                <TabsContent value="admin">
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-user">Admin username</Label>
                      <div className="relative">
                        <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="admin-user"
                          value={adminUser}
                          onChange={(e) => setAdminUser(e.target.value.toLowerCase())}
                          placeholder="the username the owner gave you"
                          className="pl-9"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-pass">Password</Label>
                      <Input
                        id="admin-pass"
                        type="password"
                        value={adminPass}
                        onChange={(e) => setAdminPass(e.target.value)}
                        placeholder="Your admin password"
                      />
                    </div>
                    <Button type="submit" className="w-full h-12" disabled={adminBusy || !adminUser.trim() || !adminPass}>
                      {adminBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                      Sign in as admin
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      First time? Sign in once with any password and you'll be asked for your invite
                      code — then you pick your own password.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
