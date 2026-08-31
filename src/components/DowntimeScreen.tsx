import { useState, useEffect } from "react";
import { Lock, AlertCircle, Eye, EyeOff, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import auth from "@/lib/shared/kliv-auth.js";
import UserManager from "@/lib/userManagement";
import { useAppSettings } from "@/lib/appSettings";
import db from "@/lib/shared/kliv-database.js";

interface DowntimeScreenProps {
  endTime: number;
  message?: string;
  onBypass?: () => void;
}

const DowntimeScreen: React.FC<DowntimeScreenProps> = ({ endTime, message = "", onBypass }) => {
  const { toast } = useToast();
  const { settings } = useAppSettings();
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [bypassing, setBypassing] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeLeft("Maintenance should be over soon");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  const handleBypass = async () => {
    if (!password) {
      toast({ title: "Password required", description: "Enter the owner password to bypass lockdown.", variant: "destructive" });
      return;
    }

    setBypassing(true);
    try {
      // Try to sign in as the owner with the given password
      // We don't know the owner email, so we'll check the known owner accounts
      const ownerEmails = [
        "beckettblacker@gmail.com",
        "Hghlvtkuv@mj.com",
      ];

      let authenticated = false;
      for (const email of ownerEmails) {
        try {
          const result = await auth.signIn(email, password);
          if (result.status === "authenticated" && result.user) {
            const session = await UserManager.getSession();
            if (session?.isPrimaryTeam) {
              authenticated = true;
              break;
            }
          }
        } catch {
          // Continue to the next email
        }
      }

      if (authenticated) {
        toast({ title: "Bypassed", description: "Owner authentication successful. You can now access the site." });
        onBypass?.();
      } else {
        toast({ title: "Authentication failed", description: "That's not the owner password.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not verify the owner password.", variant: "destructive" });
    } finally {
      setBypassing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-background to-orange-900/20" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" />

      <div className="relative z-10 w-full max-w-lg">
        <Card className="border-red-500/20">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
                <Lock className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-3xl font-bold mb-2 text-red-400">
                {settings?.lockdown_enabled ? "LOCKDOWN ACTIVE" : "MAINTENANCE MODE"}
              </h1>
              <p className="text-muted-foreground">
                {settings?.lockdown_enabled
                  ? "The site is in lockdown. Access is restricted."
                  : "We're performing scheduled maintenance. Please check back soon."}
              </p>
            </div>

            {/* Timer */}
            <div className="bg-secondary/50 rounded-lg p-4 mb-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                {settings?.lockdown_enabled ? "Lockdown ends in" : "Estimated time remaining"}
              </p>
              <p className="text-2xl font-mono font-bold text-red-400">{timeLeft}</p>
            </div>

            {/* Custom message if provided */}
            {message && (
              <div className="bg-secondary/50 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">{message}</p>
                </div>
              </div>
            )}

            {/* Owner bypass */}
            {!showPasswordInput ? (
              <Button
                onClick={() => setShowPasswordInput(true)}
                variant="outline"
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <Shield className="w-4 h-4 mr-2" />
                Owner bypass
              </Button>
            ) : (
              <div className="space-y-3">
                <div>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Owner password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-secondary/50 pr-10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleBypass();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleBypass}
                    disabled={bypassing || !password}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {bypassing ? "Verifying..." : "Bypass"}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowPasswordInput(false);
                      setPassword("");
                    }}
                    variant="outline"
                    className="px-4"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export type DowntimeInfo = {
  endTime: number;
  message?: string;
};

export async function getActiveDowntime(): Promise<DowntimeInfo | null> {
  try {
    const now = Date.now();
    const rows = await db.query<{ end_time: number; reason: string | null }>("downtime_schedules", {
      is_active: "eq.1",
      start_time: `lte.${now}`,
      end_time: `gt.${now}`,
      order: "end_time.asc",
      limit: "1",
    });
    if (rows.length === 0) return null;
    const row = rows[0];
    // start_time / end_time are stored in milliseconds (see AdminPanel).
    return {
      endTime: Number(row.end_time),
      message: row.reason || "",
    };
  } catch {
    return null;
  }
}

export default DowntimeScreen;
