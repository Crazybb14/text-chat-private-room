import { useEffect, useState } from "react";
import { Bell, Camera, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestNotificationPermission } from "@/lib/notifications";

const PROMPT_KEY = "permission_prompt_done";

type PermState = "unknown" | "granted" | "denied" | "busy";

/**
 * One-time, non-blocking ask on a visitor's first visit: browser
 * notifications, plus camera & microphone for calls. Sits in the corner until
 * handled; skipping is one click and it never covers the page.
 */
const PermissionPrompt = () => {
  const [visible, setVisible] = useState(false);
  const [notif, setNotif] = useState<PermState>("unknown");
  const [cam, setCam] = useState<PermState>("unknown");

  useEffect(() => {
    if (localStorage.getItem(PROMPT_KEY)) return;
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    localStorage.setItem(PROMPT_KEY, "1");
    setVisible(false);
  };

  const handleNotifications = async () => {
    setNotif("busy");
    const result = await requestNotificationPermission();
    setNotif(result === "granted" ? "granted" : "denied");
  };

  const handleCameraMic = async () => {
    setCam("busy");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setCam("granted");
    } catch {
      setCam("denied");
    }
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Permission requests"
      className="fixed bottom-4 right-4 z-50 w-[320px] rounded-2xl border border-white/10 bg-card/95 backdrop-blur shadow-2xl p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Turn everything on
        </p>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label="Close" onClick={dismiss}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Allow these once so you get notifications and can join voice and video calls.
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-primary" /> Notifications
          {notif === "granted" && <Check className="w-3.5 h-3.5 text-emerald-500" />}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={handleNotifications}
          disabled={notif === "busy" || notif === "granted"}
        >
          {notif === "busy" ? <Loader2 className="w-3 h-3 animate-spin" /> : notif === "granted" ? "Allowed" : "Allow"}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-primary" /> Camera &amp; mic
          {cam === "granted" && <Check className="w-3.5 h-3.5 text-emerald-500" />}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7"
          onClick={handleCameraMic}
          disabled={cam === "busy" || cam === "granted"}
        >
          {cam === "busy" ? <Loader2 className="w-3 h-3 animate-spin" /> : cam === "granted" ? "Allowed" : "Allow"}
        </Button>
      </div>

      <Button size="sm" className="w-full" onClick={dismiss}>
        Done
      </Button>
    </div>
  );
};

export default PermissionPrompt;
