import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, LogIn, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { functions } from "@/lib/shared/kliv-functions.js";
import UserManager, { type SessionInfo } from "@/lib/userManagement";
import { allPermissions, parsePermissions, saveAdminSession } from "@/lib/adminAccounts";

type StaffLoginResult = {
  ok?: boolean;
  invite?: boolean;
  error?: string;
  permissions?: Record<string, boolean>;
};

/**
 * Admin sign-in. Owner power is locked to the site owner's own account —
 * there is no password that can unlock the owner panel by itself. Staff
 * admins sign in with the accounts the owner invited.
 */
const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<"staff" | "owner">("staff");
  const [loading, setLoading] = useState(false);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [session, setSession] = useState<SessionInfo | null>(null);

  // Admin sign-in (staff accounts the owner invited)
  const [staffName, setStaffName] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Who is currently signed in. Owner access comes from the platform's own
  // flag on that account — a password entered here never grants it.
  useEffect(() => {
    let alive = true;
    UserManager.getSession()
      .then((s) => {
        if (alive) setSession(s);
      })
      .catch(() => {
        if (alive) setSession(null);
      })
      .finally(() => {
        if (alive) setSessionChecking(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const ownerSignedIn = session?.isPrimaryTeam === true;

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

  /** Owner enter: no password — the signed-in owner account IS the proof. */
  const handleOwnerEnter = () => {
    saveAdminSession({ username: session?.email ?? "owner", permissions: allPermissions() });
    localStorage.setItem("isAdmin", "true");
    navigate("/admin/panel", { replace: true });
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

            <div className="text-xs text-center pl-3 pr-3 pb-3 mb-4 border rounded-lg bg-primary/5">
              <p className="text-muted-foreground">
                Owner access is locked to the site owner's own account — no password
                entered here can unlock owner settings.
              </p>
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
                {sessionChecking ? (
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 py-6">
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking your account…
                  </p>
                ) : ownerSignedIn ? (
                  <Card className="border-emerald-500/30 bg-emerald-500/5">
                    <CardContent className="py-5 space-y-3">
                      <p className="text-sm font-semibold flex items-center justify-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-500" />
                        Signed in as the site owner
                      </p>
                      <p className="text-xs text-muted-foreground text-center">
                        {session?.email} — you're signed in with the owner's own account, so no
                        password is needed.
                      </p>
                      <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleOwnerEnter}>
                        <ArrowRight className="w-4 h-4 mr-2" /> Continue as the owner
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-5 space-y-3 text-center">
                      <p className="text-sm font-semibold">Owner access needs the owner's account</p>
                      <p className="text-xs text-muted-foreground">
                        The owner tab only unlocks for the site owner's own login. Sign in with it —
                        for example by switching accounts on the main site — and come back. No
                        password typed here can change owner-only settings.
                      </p>
                      <Button variant="outline" className="w-full" onClick={() => navigate("/login")}>
                        <LogIn className="w-4 h-4 mr-2" /> Sign in with the owner account
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
