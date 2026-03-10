import { useState, useEffect } from "react";
import type { Gym, PersonalTrainer } from "@/types";

interface Lead {
  id: string;
  gymId: string;
  gymName?: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  customData?: string;
  entityType?: "gym" | "pt";
  status?: string;
  notes?: string;
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

export default function LeadsTab({
  ownerId,
  gyms,
  pts,
  onNewCount,
}: {
  ownerId: string;
  gyms: Gym[];
  pts?: PersonalTrainer[];
  onNewCount?: (n: number) => void;
}) {
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [appliedFrom, setAppliedFrom] = useState(daysAgoStr(30));
  const [appliedTo, setAppliedTo] = useState(todayStr());
  const [entityFilter, setEntityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("new");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notesEditId, setNotesEditId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

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
      const list: Lead[] = Array.isArray(data) ? data : [];
      setLeads(list);
      onNewCount?.(list.filter((l) => !l.status || l.status === "new").length);
    } catch {
      setLeads([]);
    }
    setLoading(false);
  }

  async function updateStatus(leadId: string, status: string, notes?: string) {
    setUpdatingId(leadId);
    try {
      await fetch("/api/owner/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status, ...(notes !== undefined && { notes }) }),
      });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId ? { ...l, status, ...(notes !== undefined && { notes }) } : l
        )
      );
    } catch {
      // silent
    }
    setUpdatingId(null);
  }

  async function saveNotes(leadId: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    await updateStatus(leadId, lead.status ?? "new", notesDraft);
    setNotesEditId(null);
    setNotesDraft("");
  }

  function applyRange(days: number) {
    const f = daysAgoStr(days);
    const t = todayStr();
    setFrom(f); setTo(t);
    setAppliedFrom(f); setAppliedTo(t);
  }

  const ptIds = new Set((pts ?? []).map((p) => p.id));

  // Classify leads
  const gymLeads = leads.filter((l) => l.entityType !== "pt" && !ptIds.has(l.gymId));
  const ptLeads = leads.filter((l) => l.entityType === "pt" || ptIds.has(l.gymId));

  const newCount = leads.filter((l) => !l.status || l.status === "new").length;

  // Apply filters
  function applyFilters(list: Lead[]) {
    return list.filter((l) => {
      if (entityFilter !== "all" && l.gymId !== entityFilter) return false;
      if (statusFilter !== "all") {
        const s = l.status ?? "new";
        if (s !== statusFilter) return false;
      }
      return true;
    });
  }

  const filteredGym = applyFilters(gymLeads);
  const filteredPT = applyFilters(ptLeads);
  const allFiltered = applyFilters(leads);

  // Determine which entity filter options to show
  const showEntityFilter = gyms.length + (pts ?? []).length > 1;

  function renderLead(lead: Lead) {
    const isNew = !lead.status || lead.status === "new";
    const status = (lead.status ?? "new") as LeadStatus;
    const isEditing = notesEditId === lead.id;
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
              {lead.entityType === "pt" && (
                <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">PT</span>
              )}
              {showEntityFilter && (
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
            {lead.customData && (() => {
              try {
                const data = JSON.parse(lead.customData) as Record<string, string>;
                const entries = Object.entries(data).filter(([, v]) => v);
                if (entries.length === 0) return null;
                return (
                  <div className="bg-purple-50 rounded-lg px-4 py-3 text-sm mt-2">
                    <p className="text-xs font-semibold text-purple-700 mb-1">Additional Info</p>
                    <dl className="space-y-1">
                      {entries.map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <dt className="text-gray-500 font-medium min-w-[100px]">{k}:</dt>
                          <dd className="text-gray-700">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* Notes display / edit */}
            {lead.notes && !isEditing && (
              <div className="mt-2 bg-blue-50 rounded-lg px-4 py-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-blue-700">Internal Notes</p>
                  <button
                    onClick={() => { setNotesEditId(lead.id); setNotesDraft(lead.notes ?? ""); }}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Edit
                  </button>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{lead.notes}</p>
              </div>
            )}
            {isEditing && (
              <div className="mt-2">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                  placeholder="Add internal notes — outcome, follow-up, etc."
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => saveNotes(lead.id)}
                    disabled={updatingId === lead.id}
                    className="px-3 py-1 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setNotesEditId(null); setNotesDraft(""); }}
                    className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {!lead.notes && !isEditing && (
              <button
                onClick={() => { setNotesEditId(lead.id); setNotesDraft(""); }}
                className="mt-2 text-xs text-gray-400 hover:text-brand-orange"
              >
                + Add note
              </button>
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
  }

  // Decide whether to show sectioned view (both gyms and PTs exist)
  const hasBoth = gyms.length > 0 && (pts ?? []).length > 0;

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
        {showEntityFilter && (
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          >
            <option value="all">All listings</option>
            {gyms.length > 0 && <option disabled className="font-semibold text-gray-500">— Gyms —</option>}
            {gyms.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
            {(pts ?? []).length > 0 && <option disabled className="font-semibold text-gray-500">— Personal Trainers —</option>}
            {(pts ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        {newCount > 0 && (
          <span className="text-sm font-semibold text-orange-600">
            {newCount} new {newCount === 1 ? "lead" : "leads"}
          </span>
        )}
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-5">
        {(["all", "new", "read", "contacted"] as const).map((s) => {
          const count = s === "all" ? leads.length : leads.filter((l) => (l.status ?? "new") === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-brand-orange text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "new" && statusFilter !== "new" && newCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-brand-orange shrink-0" />
              )}
              {s.charAt(0).toUpperCase() + s.slice(1)}
              <span className={`text-xs ${statusFilter === s ? "text-white/75" : "text-gray-400"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lead list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : allFiltered.length === 0 && entityFilter === "all" && statusFilter === "all" ? (
        <div className="text-center py-12">
          <p className="text-gray-400">No leads in this period.</p>
          <p className="text-sm text-gray-300 mt-1">Leads appear here when someone submits an enquiry on your listing page.</p>
        </div>
      ) : hasBoth ? (
        /* Sectioned view: Gym leads then PT leads */
        <div className="space-y-8">
          {/* Gym Leads Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900">Gym Leads</h3>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                {filteredGym.length}
              </span>
            </div>
            {filteredGym.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No gym leads match your filters.</p>
            ) : (
              <div className="space-y-3">{filteredGym.map(renderLead)}</div>
            )}
          </section>

          {/* PT Leads Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900">PT Leads</h3>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                {filteredPT.length}
              </span>
            </div>
            {filteredPT.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No PT leads match your filters.</p>
            ) : (
              <div className="space-y-3">{filteredPT.map(renderLead)}</div>
            )}
          </section>
        </div>
      ) : (
        /* Single list — only one entity type */
        <div className="space-y-3">
          {allFiltered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No leads match your filters.</p>
            </div>
          ) : (
            allFiltered.map(renderLead)
          )}
        </div>
      )}
    </div>
  );
}
