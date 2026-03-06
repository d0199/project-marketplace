import { useState, useEffect } from "react";
import type { Gym } from "@/types";

interface OwnerStats {
  leads: number;
  pageViews: number;
  websiteClicks: number;
  phoneClicks: number;
  emailClicks: number;
}

interface GymStatRow {
  gymId: string;
  gymName: string;
  stats: OwnerStats;
}

interface StatsResponse {
  gyms: GymStatRow[];
  aggregate: OwnerStats;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 ${accent ? "bg-white/15" : "bg-gray-50"}`}>
      <div
        className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
          accent ? "text-white/70" : "text-gray-500"
        }`}
      >
        {label}
      </div>
      <div
        className={`text-3xl font-bold tabular-nums ${
          accent ? "text-white" : "text-gray-900"
        }`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function StatsCard({
  title,
  subtitle,
  stats,
  highlight,
}: {
  title: string;
  subtitle?: string;
  stats: OwnerStats;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl overflow-hidden border ${
        highlight ? "border-brand-orange/40 shadow-md" : "border-gray-200"
      }`}
    >
      {/* Card header */}
      <div
        className={`px-6 py-4 ${
          highlight ? "bg-brand-orange" : "bg-gray-800"
        }`}
      >
        <div className="font-bold text-lg text-white">{title}</div>
        {subtitle && <div className="text-sm text-white/65 mt-0.5">{subtitle}</div>}
      </div>

      {/* Metrics grid */}
      <div className={`p-5 ${highlight ? "bg-brand-orange/5" : "bg-white"}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricTile label="Leads" value={stats.leads} />
          <MetricTile label="Profile Views" value={stats.pageViews} />
          <MetricTile label="Website Clicks" value={stats.websiteClicks} />
          <MetricTile label="Phone Clicks" value={stats.phoneClicks} />
          <MetricTile label="Email Clicks" value={stats.emailClicks} />
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsTab({ ownerId, gyms }: { ownerId: string; gyms: Gym[] }) {
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [appliedFrom, setAppliedFrom] = useState(daysAgoStr(30));
  const [appliedTo, setAppliedTo] = useState(todayStr());
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFrom, appliedTo, ownerId]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/owner/stats?ownerId=${ownerId}&from=${appliedFrom}&to=${appliedTo}`
      );
      const json = await r.json();
      setData(json);
    } catch {
      setData(null);
    }
    setLoading(false);
  }

  function applyRange(days: number) {
    const f = daysAgoStr(days);
    const t = todayStr();
    setFrom(f); setTo(t);
    setAppliedFrom(f); setAppliedTo(t);
  }

  return (
    <div>
      {/* Date range controls */}
      <div className="flex flex-wrap items-end gap-3 mb-8">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 font-medium">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
        </div>
        <button
          onClick={() => { setAppliedFrom(from); setAppliedTo(to); }}
          className="px-4 py-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Apply
        </button>
        <div className="flex gap-2">
          {[7, 30, 90, 365].map((d) => (
            <button
              key={d}
              onClick={() => applyRange(d)}
              className="text-xs text-gray-500 hover:text-brand-orange underline"
            >
              {d === 365 ? "1yr" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Note about data availability */}
      <p className="text-xs text-gray-400 mb-6">
        Analytics tracking began when this feature was deployed. Data is only available from that date forward.
      </p>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : !data ? (
        <div className="text-center py-12 text-gray-400">Unable to load analytics.</div>
      ) : (
        <div className="space-y-5">
          {/* Aggregate card — only when owner has multiple gyms */}
          {gyms.length > 1 && (
            <StatsCard
              title="All Listings"
              subtitle={`${appliedFrom} – ${appliedTo}`}
              stats={data.aggregate}
              highlight
            />
          )}
          {/* Per-gym cards */}
          {data.gyms.map((row) => {
            const gym = gyms.find((g) => g.id === row.gymId);
            return (
              <StatsCard
                key={row.gymId}
                title={row.gymName}
                subtitle={
                  gym
                    ? `${gym.address.suburb}, ${gym.address.state} · ${appliedFrom} – ${appliedTo}`
                    : `${appliedFrom} – ${appliedTo}`
                }
                stats={row.stats}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
