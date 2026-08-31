import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, LogIn, MessageSquare, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import auth from "@/lib/shared/kliv-auth.js";
import UserManager from "@/lib/userManagement";
import { validateSignup } from "@/lib/signupValidation";
import DowntimeScreen, { getActiveDowntime, type DowntimeInfo } from "@/components/DowntimeScreen";

type OAuthProviderOption = { provider: "google" | "facebook" | "apple"; label: string };

const Login = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [checked, setChecked] = useState(false);
  const [downtime, setDowntime] = useState<DowntimeInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<OAuthProviderOption[]>([]);

  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const [down, session, oauth] = await Promise.all([
        getActiveDowntime(),
        UserManager.getSession(),
        auth.getOAuthProviders().catch(() => [] as OAuthProviderOption[]),
      ]);
      if (cancelled) return;
      if (down) {
        setDowntime(down);
        return;
      }
      if (session) {
        navigate("/", { replace: true });
        return;
      }
      setProviders(oauth);
      setChecked(true);
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (downtime) {
    return <DowntimeScreen info={downtime} />;
  }

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (!siEmail.trim() || !siPassword) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await auth.signIn(siEmail.trim(), siPassword);
      if (result.status === "totp_required") {
        setError("This account uses an authenticator app, which isn't supported on this page yet.");
        return;
      }
      toast({ title: "Welcome back!" });
      await UserManager.logLoginIp(null);
      navigate("/", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("bad_credentials")) {
        setError("Wrong email or password.");
      } else if (message.includes("account_locked")) {
        setError("Too many failed attempts — this account is locked. Reset your password or contact an admin.");
      } else if (message.includes("user_inactive")) {
        setError("This account has been disabled.");
      } else {
        setError("Couldn't sign in. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    const invalid = validateSignup({
      firstName,
      lastName,
      username,
      email,
      password,
      confirmPassword,
    });
    if (invalid) {
      setError(invalid);
      return;
    }
    const chosen = username.trim().toLowerCase();
    setError(null);
    setBusy(true);
    try {
      if (!(await UserManager.isUsernameAvailable(chosen))) {
        setError("That username is already taken.");
        return;
      }
      const user = await auth.signUp(
        email.trim(),
        password,
        `${firstName.trim()} ${lastName.trim()}`.trim(),
        null,
        { username: chosen }
      );
      await UserManager.createProfile({
        userUuid: user.userUuid ?? "",
        email: user.email ?? email.trim(),
        username: chosen,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await UserManager.logLoginIp(chosen);
      toast({ title: "Account created", description: "Welcome to ChatRooms!" });
      navigate("/", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("email_exists")) {
        setError("An account with this email already exists — try signing in instead.");
      } else if (message.includes("insufficient_password_complexity")) {
        setError("Password must be at least 8 characters.");
      } else {
        setError("Couldn't create your account. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background pointer-events-none" />
      <div className="relative z-10 w-full max-w-md space-y-4">
        <div className="flex items-center justify-center gap-2 pb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold text-xl">ChatRooms</span>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>
              Use the account you created — it works from any device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="signin">Log in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="si-email">Email</Label>
                    <Input
                      id="si-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={siEmail}
                      onChange={(e) => setSiEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="si-password">Password</Label>
                    <Input
                      id="si-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={siPassword}
                      onChange={(e) => setSiPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                    Sign in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="su-first">First name</Label>
                      <Input
                        id="su-first"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        maxLength={40}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="su-last">Last name</Label>
                      <Input
                        id="su-last"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        maxLength={40}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-username">Username</Label>
                    <Input
                      id="su-username"
                      placeholder="3–20 letters, numbers, underscores"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email address</Label>
                    <Input
                      id="su-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Choose a password</Label>
                    <Input
                      id="su-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-confirm">Confirm password</Label>
                    <Input
                      id="su-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                    Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {providers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                {providers.map((p) => (
                  <Button
                    key={p.provider}
                    variant="outline"
                    className="w-full"
                    onClick={() => auth.signInWithOAuth(p.provider, { returnTo: "/" })}
                  >
                    Continue with {p.label}
                  </Button>
                ))}
              </div>
            )}

            {error && <p className="mt-4 text-sm text-destructive text-center">{error}</p>}
            <p className="mt-4 text-xs text-muted-foreground text-center">
              By creating an account you agree to the Terms of Use.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
