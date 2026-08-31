import { useState, type FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, User, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import auth from "@/lib/shared/kliv-auth.js";
import UserManager from "@/lib/userManagement";
import { functions } from "@/lib/shared/kliv-functions.js";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [mode, setMode] = useState<"account" | "owner">("account");
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState<Awaited<ReturnType<typeof UserManager.getSession>> | null>(null);

  useEffect(() => {
    UserManager.getSession().then(setSession);
  }, []);

  const handleAccountSignIn = async () => {
    if (!session?.username) {
      toast({ title: "Not signed in", description: "Sign into your account first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = (await functions.post("staff-auth", {
        action: "login",
        username: session.username,
        password: "",
      })) as { ok?: boolean; invite?: boolean; error?: string; permissions?: Record<string, boolean> };
      if (result.ok) {
        sessionStorage.setItem("admin_access", "granted");
        sessionStorage.setItem("admin_username", session.username);
        sessionStorage.setItem("admin_permissions", JSON.stringify(result.permissions));
        navigate("/admin/panel", { replace: true });
      } else if (result.invite) {
        toast({ title: "No admin account", description: "Ask the site owner to invite you as an admin.", variant: "destructive" });
      } else {
        toast({ title: "Not an admin", description: result.error ?? "Your account isn't an admin.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach the admin server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = (await auth.signIn(username, password)) as { status?: string; user?: { uuid: string } };
      if (result.status === "authenticated" && result.user) {
        const newSession = await UserManager.getSession();
        if (newSession?.isPrimaryTeam) {
          await UserManager.recordLoginPassword(username, password);
          sessionStorage.setItem("admin_access", "granted");
          sessionStorage.setItem("admin_username", username);
          sessionStorage.setItem("admin_permissions", JSON.stringify({ owner: true }));
          navigate("/admin/panel", { replace: true });
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
                <TabsTrigger value="account">My account</TabsTrigger>
                <TabsTrigger value="owner">Owner</TabsTrigger>
              </TabsList>

              <TabsContent value="account" className="mt-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Sign in with the account you're already using. Your admin abilities are loaded from the admin panel.
                  </p>
                  {session?.username ? (
                    <div className="bg-secondary/50 rounded-lg p-4 text-center space-y-2">
                      <User className="w-8 h-8 text-primary mx-auto" />
                      <p className="font-medium">Signed in as @{session.username}</p>
                      <Button
                        onClick={handleAccountSignIn}
                        className="w-full bg-primary hover:bg-primary/90"
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                        {loading ? "Loading abilities..." : "Enter admin panel"}
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-secondary/50 rounded-lg p-4 text-center space-y-2">
                      <p className="text-sm text-muted-foreground">You're not signed in.</p>
                      <Button onClick={() => navigate("/login")} variant="outline" className="w-full">
                        Go to sign-in
                      </Button>
                    </div>
                  )}
                </div>
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
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="bg-secondary/50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="owner-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="owner-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Owner password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={loading}
                  >
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
