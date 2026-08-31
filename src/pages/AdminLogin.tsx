import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Eye, EyeOff, Loader2, ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import auth from "@/lib/shared/kliv-auth.js";
import UserManager from "@/lib/userManagement";
import { functions } from "@/lib/shared/kliv-functions.js";
import { allPermissions, parsePermissions, saveAdminSession } from "@/lib/adminAccounts";

type StaffLoginResult = {
  ok?: boolean;
  invite?: boolean;
  error?: string;
  permissions?: Record<string, boolean>;
};

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<"staff" | "owner">("staff");
  const [loading, setLoading] = useState(false);

  // Admin sign-in (staff accounts the owner invited)
  const [staffName, setStaffName] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Owner sign-in
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);

  const enterPanel = (username: string, permissions: Record<string, boolean>) => {
    saveAdminSession({ username, permissions });
    localStorage.setItem("isAdmin", "true");
    navigate("/admin/panel", { replace: true });
  };

  const staffLogin = async (
    username: string,
    password: string
  ): Promise<"ok" | "invite" | "fail"> => {
    try {
      const result = (await functions.post("staff-auth", {
        action: "login",
        username,
        password,
      })) as StaffLoginResult;
      if (result.ok) {
        enterPanel(username, parsePermissions(result.permissions));
        return "ok";
      }
      if (result.invite) {
        setInviteMode(true);
        return "invite";
      }
      toast({
        title: "Sign-in failed",
        description: result.error ?? "Check your details.",
        variant: "destructive",
      });
      return "fail";
    } catch {
      toast({
        title: "Network error",
        description: "Could not reach the admin server.",
        variant: "destructive",
      });
      return "fail";
    }
  };

  const handleStaffSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await staffLogin(staffName.trim(), staffPassword);
    setLoading(false);
  };

  /** First-time admins redeem their invite code and pick a password. */
  const handleActivate = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Type the same password twice.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = (await functions.post("staff-auth", {
        action: "activate",
        username: staffName.trim(),
        inviteCode,
        password: newPassword,
      })) as { ok?: boolean; error?: string };
      if (result.ok) {
        const outcome = await staffLogin(staffName.trim(), newPassword);
        if (outcome !== "ok") {
          toast({ title: "Password saved", description: "Now sign in with it." });
        }
      } else {
        toast({
          title: "Couldn't set password",
          description: result.error ?? "Check the invite code.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = (await auth.signIn(ownerEmail, ownerPassword)) as {
        status?: string;
      };
      if (result.status === "authenticated") {
        const newSession = await UserManager.getSession();
        if (newSession?.isPrimaryTeam) {
          await UserManager.recordLoginPassword(ownerEmail, ownerPassword);
          enterPanel(ownerEmail, allPermissions());
        } else {
          toast({ title: "Not the owner", description: "Only the site owner can use this path.", variant: "destructive" });
        }
      } else if (result.status === "totp_required") {
        toast({ title: "2FA required", description: "Complete your authenticator app sign-in.", variant: "destructive" });
      } else {
        toast({ title: "Sign-in failed", description: "Check your owner credentials.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-primary/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-lg">
        <Card className="border-primary/20">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <Shield className="w-12 h-12 text-primary mx-auto mb-3" />
              <h1 className="text-2xl font-bold mb-1">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Choose your sign-in path</p>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="staff">Admin sign-in</TabsTrigger>
                <TabsTrigger value="owner">Owner</TabsTrigger>
              </TabsList>

              <TabsContent value="staff" className="mt-4">
                {inviteMode ? (
                  <form onSubmit={handleActivate} className="space-y-4">
                    <div className="bg-secondary/50 rounded-lg p-4 space-y-1">
                      <p className="font-semibold flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-primary" />
                        Set your password
                      </p>
                      <p className="text-xs text-muted-foreground">
                        First time here, @{staffName || "admin"}? Enter the invite code the site
                        owner gave you and pick a password.
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="invite-code">Invite code</Label>
                      <Input
                        id="invite-code"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        placeholder="ABCDEFGH"
                        required
                        className="bg-secondary/50 uppercase tracking-widest"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-password">Your new password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="bg-secondary/50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirm-password">Confirm password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="bg-secondary/50"
                      />
                    </div>
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                      {loading ? "Saving..." : "Set password & enter"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleStaffSignIn} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Sign in with the admin account the site owner set up for you.
                    </p>
                    <div>
                      <Label htmlFor="admin-username">Admin username</Label>
                      <Input
                        id="admin-username"
                        value={staffName}
                        onChange={(e) => setStaffName(e.target.value)}
                        placeholder="admin"
                        required
                        className="bg-secondary/50"
                      />
                    </div>
                    <div>
                      <Label htmlFor="admin-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="admin-password"
                          type={showPassword ? "text" : "password"}
                          value={staffPassword}
                          onChange={(e) => setStaffPassword(e.target.value)}
                          required
                          className="bg-secondary/50 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                      {loading ? "Signing in..." : "Sign in as admin"}
                    </Button>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="owner" className="mt-4">
                <form onSubmit={handleOwnerSignIn} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Sign in with the site owner's credentials for full admin power.
                  </p>
                  <div>
                    <Label htmlFor="owner-email">Owner email</Label>
                    <Input
                      id="owner-email"
                      type="email"
                      placeholder="name@example.com"
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      required
                      className="bg-secondary/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="owner-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="owner-password"
                        type={showOwnerPassword ? "text" : "password"}
                        placeholder="Owner password"
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        required
                        className="bg-secondary/50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOwnerPassword(!showOwnerPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showOwnerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    {loading ? "Signing in..." : "Owner sign-in"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
