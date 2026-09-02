import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { FlaskConical, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import UserManager from "@/lib/userManagement";
import { isOwnerSession } from "@/lib/owner";
import { getAdminSession } from "@/lib/adminAccounts";
import { loadAppSettings, settingText } from "@/lib/appSettings";
import { testingAccessAllowed } from "@/lib/testingMode";

/**
 * Site-wide testing gate. While the owner has testing mode on, only the
 * owner and the admin usernames they picked can use the site; everyone else
 * sees a friendly "we're testing" page. Sign-in and admin pages stay open so
 * allowed people can get in.
 */
const TestingGate = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [verdict, setVerdict] = useState<"checking" | "open" | "closed" | "testing-closed">("checking");
  const [siteName, setSiteName] = useState("ChatRooms");

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const [settings, session] = await Promise.all([
          loadAppSettings(),
          UserManager.getSession().catch(() => null),
        ]);
        if (stopped) return;
        const name = settingText(settings, "site_name");
        if (name) setSiteName(name);
        const admin = getAdminSession();
        setVerdict(
          testingAccessAllowed(
            {
              testingOn: settings.testing_mode_enabled === true,
              isOwner: isOwnerSession(session),
              adminUsername: admin?.username ?? null,
              accountUsername: session?.username ?? null,
              allowedList: settingText(settings, "testing_allowed_admins"),
            },
            location.pathname
          )
        );
      } catch {
        // Never brick the site because one read failed.
        if (!stopped) setVerdict("open");
      }
    };
    void check();
    const timer = setInterval(() => void check(), 15000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [location.pathname]);

  if (verdict === "checking") {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  if (verdict !== "open") {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto">
            <FlaskConical className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-semibold">{siteName} is being tested</h1>
          <p className="text-sm text-neutral-400">
            We're making some changes right now and the site is temporarily open only to the site
            owner and a few helpers. Everything will be back shortly — thanks for your patience!
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Check again
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default TestingGate;
