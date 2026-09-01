import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban as BanIcon, Clock, Gavel, Infinity as InfinityIcon, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { settingBool, useAppSettings } from "@/lib/appSettings";
import { formatRemaining } from "@/lib/moderation";

interface BanScreenProps {
  reason?: string | null;
  untilMs?: number | null;
  permanent?: boolean;
  evasion?: boolean;
  siteName?: string;
}

/** Full-screen ban notice with a live countdown and the appeal option. */
const BanScreen = ({
  reason,
  untilMs,
  permanent,
  evasion,
  siteName = "this site",
}: BanScreenProps) => {
  const navigate = useNavigate();
  const { settings } = useAppSettings();
  const appealsOpen = settingBool(settings, "ban_appeals_enabled");
  const [, setTick] = useState(0);

  // Re-render every second so the countdown stays live
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = formatRemaining(untilMs ?? null, permanent === true);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.15),transparent_60%)] pointer-events-none" />
      <div className="relative z-10 max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto">
          <BanIcon className="w-10 h-10 text-red-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">You're banned</h1>
          <p className="text-white/60 text-sm">
            {evasion
              ? `Creating a new account to get around a ban is not allowed — this device is banned from ${siteName}.`
              : `Your access to ${siteName} has been suspended.`}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3 text-left">
          <div className="flex items-start gap-3">
            <Gavel className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-wide text-white/40">Reason</p>
              <p className="text-sm">{reason ?? "Violation of the chat rules"}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            {permanent ? (
              <InfinityIcon className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="text-xs uppercase tracking-wide text-white/40">Duration</p>
              <p className="text-sm">
                {permanent
                  ? "Permanent — this ban does not expire"
                  : remaining === "expired"
                    ? "Expiring — reload the page"
                    : `${remaining} remaining`}
              </p>
            </div>
          </div>
        </div>

        {permanent && (
          <p className="text-xs text-white/40 flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            Repeat violations escalate all the way to permanent bans.
          </p>
        )}

        <div className="flex gap-2 justify-center">
          {appealsOpen && (
            <Button variant="destructive" onClick={() => navigate("/appeal")}>
              Submit an appeal
            </Button>
          )}
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => window.location.reload()}
          >
            Check again
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BanScreen;
