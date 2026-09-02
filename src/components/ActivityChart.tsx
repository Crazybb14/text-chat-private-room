import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles, TrendingUp } from "lucide-react";
import { loadActivitySummary, type ActivitySummary } from "@/lib/activity";

/** Fixed star positions so the sky doesn't shimmer on every render. */
const STARS: Array<{ left: string; top: string; size: number; delay: string; dim?: boolean }> = [
  { left: "6%", top: "22%", size: 2, delay: "0s" },
  { left: "14%", top: "62%", size: 1, delay: "1.2s", dim: true },
  { left: "22%", top: "14%", size: 2, delay: "0.6s" },
  { left: "31%", top: "74%", size: 1, delay: "2s", dim: true },
  { left: "38%", top: "30%", size: 3, delay: "0.3s" },
  { left: "47%", top: "10%", size: 1, delay: "1.6s", dim: true },
  { left: "52%", top: "68%", size: 2, delay: "0.9s" },
  { left: "61%", top: "20%", size: 1, delay: "2.4s", dim: true },
  { left: "68%", top: "56%", size: 3, delay: "0.4s" },
  { left: "76%", top: "16%", size: 1, delay: "1.1s", dim: true },
  { left: "83%", top: "48%", size: 2, delay: "1.9s" },
  { left: "91%", top: "28%", size: 1, delay: "0.7s", dim: true },
  { left: "96%", top: "72%", size: 2, delay: "1.4s" },
];

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 23];

export const ActivityChart = ({ refreshKey = 0 }: { refreshKey?: number }) => {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadActivitySummary(7)
      .then((s) => {
        if (alive) {
          setSummary(s);
          setError(null);
        }
      })
      .catch(() => {
        if (alive) setError("Couldn't load activity right now.");
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  return (
    <section
      aria-label="Busiest times"
      className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-[#12121c] px-5 py-6 sm:px-8"
    >
      {/* galaxy backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 300px at 20% -40%, rgba(129,90,255,0.28), transparent 60%)," +
            "radial-gradient(900px 320px at 85% -30%, rgba(56,189,248,0.18), transparent 60%)," +
            "linear-gradient(180deg, #12121c 0%, #0d0d15 100%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              opacity: s.dim ? 0.35 : 0.8,
              animation: `dc-twinkle 3.2s ease-in-out ${s.delay} infinite alternate`,
            }}
          />
        ))}
      </div>

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#e8e4ff]">
              <Sparkles className="h-5 w-5 text-indigo-300" aria-hidden />
              Activity Galaxy
            </h2>
            <p className="mt-1 text-sm text-[#a9a4c9]">
              When the most people are chatting — from the last 7 days of real activity.
            </p>
          </div>
          {summary?.peak && summary.peak.people > 0 ? (
            <div className="flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1.5 text-sm text-indigo-200">
              <TrendingUp className="h-4 w-4" aria-hidden />
              Busiest around <strong className="font-semibold text-white">{summary.peak.label}</strong>
              <span className="text-indigo-300/80">
                ({summary.peak.people} {summary.peak.people === 1 ? "person" : "people"})
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-5 h-56 w-full text-[#b9b4d6] sm:h-64">
          {summary ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="dcActivityLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="55%" stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,255,0.10)" vertical={false} />
                <XAxis
                  dataKey="hour"
                  ticks={HOUR_TICKS}
                  tickFormatter={(h: number) => summary.points.find((p) => p.hour === h)?.label ?? ""}
                  tick={{ fill: "#8f89b3", fontSize: 11 }}
                  stroke="rgba(148,163,255,0.15)"
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#8f89b3", fontSize: 11 }}
                  stroke="rgba(148,163,255,0.15)"
                />
                <Tooltip
                  cursor={{ stroke: "rgba(148,163,255,0.25)" }}
                  contentStyle={{
                    background: "#1a1a27",
                    border: "1px solid rgba(148,163,255,0.25)",
                    borderRadius: 10,
                    color: "#e8e4ff",
                    fontSize: 13,
                  }}
                  labelFormatter={(h: number) => summary.points.find((p) => p.hour === h)?.label ?? ""}
                  formatter={(value: number | string, name: string) => {
                    const label = name === "people" ? "people chatting" : "messages";
                    return [value, label];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="people"
                  stroke="url(#dcActivityLine)"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: "#c084fc", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "#e9d5ff", stroke: "#7c3aed", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#8f89b3]">
              {error ?? "Scanning the galaxy…"}
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-[#78739a]">
          {summary && summary.totalMessages > 0
            ? `Based on ${summary.totalMessages.toLocaleString()} recent messages.`
            : "As people chat, this graph fills in and shows your busiest hours."}
        </p>
      </div>
    </section>
  );
};

export default ActivityChart;
