import { useEffect, useState } from "react";
import db from "@/lib/shared/kliv-database.js";
import { settingText, useAppSettings } from "@/lib/appSettings";

export interface DowntimeInfo {
  start: number;
  end: number;
  reason: string | null;
}

interface DowntimeRow {
  start_time: number | string;
  end_time: number | string;
  reason: string | null;
  is_active: number;
  [key: string]: unknown;
}

/** Returns the downtime window currently in effect, or null. */
export async function getActiveDowntime(): Promise<DowntimeInfo | null> {
  try {
    const rows = await db.query<DowntimeRow>("downtime_schedules", {
      is_active: "eq.1",
      order: "start_time.desc",
    });
    const now = Date.now();
    const active = rows.find(
      (r) => now >= Number(r.start_time) && now < Number(r.end_time)
    );
    if (!active) return null;
    return {
      start: Number(active.start_time),
      end: Number(active.end_time),
      reason: active.reason ?? null,
    };
  } catch {
    return null;
  }
}

const formatTime = (value: number) =>
  new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const DowntimeScreen = ({ info }: { info: DowntimeInfo }) => {
  const [now, setNow] = useState(Date.now());
  const { settings } = useAppSettings();
  const extraMessage = settingText(settings, "maintenance_message");

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = Math.max(0, info.end - now);
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-lg text-center space-y-6">
        <h1 className="text-4xl font-black tracking-widest text-red-500">
          DOWNTIME HAS BEEN ENABLED
        </h1>
        {info.reason && <p className="text-white/80 text-lg">{info.reason}</p>}
        {extraMessage && (
          <p className="text-white/50 text-sm max-w-md mx-auto break-words">{extraMessage}</p>
        )}
        <div className="text-white/70 space-y-1">
          <p>From: {formatTime(info.start)}</p>
          <p>To: {formatTime(info.end)}</p>
        </div>
        <div className="font-mono text-5xl font-bold tabular-nums">
          {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
          {String(seconds).padStart(2, "0")}
        </div>
        <p className="text-white/50 text-sm">
          The site will come back automatically when downtime ends. This page will update on its
          own.
        </p>
      </div>
    </div>
  );
};

export default DowntimeScreen;
