import { useState, useEffect } from "react";
import type { Gym } from "@/types";

interface Lead {
  id: string;
  gymId: string;
  gymName?: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  status?: string;
  createdAt?: string;
}

const STATUS_OPTIONS = ["new", "read", "contacted"] as const;
type LeadStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-orange-100 text-orange-800",
  read: "bg-gray-100 text-gray-600",
  contacted: "bg-green-100 text-green-800",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function LeadsTab({ ownerId, gyms }: { ownerId: string; gyms: Gym[] }) {
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [appliedFrom, setAppliedFrom] = useState(daysAgoStr(30));
  const [appliedTo, setAppliedTo] = useState(todayStr());
  const [gymFilter, setGymFilter] = useState("all");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadLeads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFrom, appliedTo, ownerId]);

  async function loadLeads() {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/owner/leads?ownerId=${ownerId}&from=${appliedFrom}&to=${appliedTo}`
      );
      const data = await r.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch {
      setLeads([]);
    }
    setLoading(false);
  }

  async function updateStatus(leadId: string, status: string) {
    setUpdatingId(leadId);
    try {
      await fetch("/api/owner/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status }),
      });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status } : l)));
    } catch {
      // silent — UI already optimistically updated via setLeads above if needed
    }
    setUpdatingId(null);
  }

  function applyRange(days: number) {
    const f = daysAgoStr(days);
    const t = todayStr();
    setFrom(f); setTo(t);
    setAppliedFrom(f); setAppliedTo(t);
  }

  const filtered =
    gymFilter === "all" ? leads : leads.filter((l) => l.gymId === gymFilter);

  const newCount = leads.filter((l) => !l.status || l.status === "new").length;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
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
        {gyms.length > 1 && (
          <select
            value={gymFilter}
            onChange={(e) => setGymFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <option value="all">All gyms</option>
            {gyms.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
        {newCount > 0 && (
          <span className="ml-auto text-sm font-semibold text-orange-600">
            {newCount} new {newCount === 1 ? "lead" : "leads"}
          </span>
        )}
      </div>

      {/* Lead list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No leads in this period.</p>
          <p className="text-sm text-gray-300 mt-1">Leads appear here when someone submits an enquiry on your gym page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => {
            const isNew = !lead.status || lead.status === "new";
            const status = (lead.status ?? "new") as LeadStatus;
            return (
              <div
                key={lead.id}
                className={`bg-white border rounded-xl p-5 transition-colors ${
                  isNew ? "border-orange-200 shadow-sm" : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: contact info + message */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                      <span className="font-semibold text-gray-900 text-base">{lead.name}</span>
                      {gyms.length > 1 && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {lead.gymName}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {lead.createdAt
                          ? new Date(lead.createdAt).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm mb-3">
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-brand-orange hover:underline font-medium"
                      >
                        {lead.email}
                      </a>
                      {lead.phone && (
                        <a
                          href={`tel:${lead.phone}`}
                          className="text-gray-600 hover:text-brand-orange"
                        >
                          {lead.phone}
                        </a>
                      )}
                    </div>

                    {lead.message && (
                      <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {lead.message}
                      </div>
                    )}
                  </div>

                  {/* Right: status selector */}
                  <div className="flex-shrink-0 pt-0.5">
                    <select
                      value={status}
                      disabled={updatingId === lead.id}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full cursor-pointer border-0 focus:outline-none focus:ring-2 focus:ring-brand-orange disabled:opacity-50 ${
                        STATUS_STYLES[status] ?? STATUS_STYLES.new
                      }`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
