import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { PersonalTrainer } from "@/types";

interface Affiliation {
  id: string;
  ptId: string;
  ptName?: string;
  gymId: string;
  gymName?: string;
  requestedBy: string;
  status: string;
  requestedAt?: string;
}

interface GymSearchResult {
  id: string;
  name: string;
  suburb: string;
  state: string;
}

interface Props {
  pts: PersonalTrainer[];
}

export default function PTAffiliationsTab({ pts }: Props) {
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; gymName: string; ptName: string; action: "cancelled" | "removed" } | null>(null);

  // Gym search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GymSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPtId, setSelectedPtId] = useState<string>(pts[0]?.id ?? "");
  const [showSearch, setShowSearch] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const ptIds = pts.map((p) => p.id);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pts.length]);

  async function load() {
    setLoading(true);
    try {
      const allAffs: Affiliation[] = [];
      for (const ptId of ptIds) {
        const r = await fetch(`/api/affiliations?ptId=${ptId}`);
        const data = await r.json();
        if (Array.isArray(data)) allAffs.push(...data);
      }
      setAffiliations(allAffs);
    } catch { /* */ }
    setLoading(false);
  }

  function showToastMsg(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // Debounced gym search
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      fetch(`/api/gyms/names?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: GymSearchResult[]) => {
          setSearchResults(data);
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function requestAffiliation(gymId: string) {
    if (!selectedPtId) {
      showToastMsg("Select a PT profile first");
      return;
    }
    setBusy("request");
    try {
      const r = await fetch("/api/affiliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ptId: selectedPtId, gymId, requestedBy: "pt" }),
      });
      if (r.ok) {
        showToastMsg("Affiliation request sent! The gym owner will review it.");
        setSearchQuery("");
        setSearchResults([]);
        setShowSearch(false);
        load();
      } else {
        const err = await r.json();
        if (r.status === 409) {
          showToastMsg("You already have a pending or active affiliation with this gym.");
        } else {
          showToastMsg(err.error || "Request failed");
        }
      }
    } catch {
      showToastMsg("Something went wrong");
    }
    setBusy(null);
  }

  async function respond(id: string, status: "cancelled" | "removed") {
    setBusy(id);
    try {
      const r = await fetch("/api/affiliations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (r.ok) {
        const msgs = { cancelled: "Affiliation request cancelled", removed: "Affiliation removed" };
        showToastMsg(msgs[status]);
        load();
      }
    } catch {
      showToastMsg("Something went wrong");
    }
    setBusy(null);
    setConfirmAction(null);
  }

  if (loading) {
    return <p className="text-gray-400 text-sm py-8 text-center">Loading affiliations...</p>;
  }

  // Group affiliations by PT
  const byPt = new Map<string, { pt: PersonalTrainer; pending: Affiliation[]; active: Affiliation[]; past: Affiliation[] }>();
  for (const pt of pts) {
    byPt.set(pt.id, { pt, pending: [], active: [], past: [] });
  }
  for (const aff of affiliations) {
    const bucket = byPt.get(aff.ptId);
    if (!bucket) continue;
    if (aff.status === "pending") bucket.pending.push(aff);
    else if (aff.status === "approved") bucket.active.push(aff);
    else bucket.past.push(aff);
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white bg-green-600">
          {toast}
        </div>
      )}

      {/* Confirmation modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              {confirmAction.action === "removed" ? "Remove Gym Affiliation" : "Cancel Affiliation Request"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {confirmAction.action === "removed"
                ? <>Are you sure you want to remove <strong>{confirmAction.ptName}</strong>&apos;s affiliation with <strong>{confirmAction.gymName}</strong>? You will no longer appear as an affiliated PT on their gym profile.</>
                : <>Cancel the pending affiliation request from <strong>{confirmAction.ptName}</strong> to <strong>{confirmAction.gymName}</strong>?</>
              }
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button
                onClick={() => respond(confirmAction.id, confirmAction.action)}
                disabled={busy === confirmAction.id}
                className="px-4 py-2 text-sm font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {busy === confirmAction.id ? "Processing..." : confirmAction.action === "removed" ? "Remove" : "Cancel Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search / Request section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Request Gym Affiliation</h3>
          {!showSearch && (
            <button
              onClick={() => setShowSearch(true)}
              className="px-4 py-2 bg-brand-orange text-white text-sm font-semibold rounded-lg hover:bg-brand-orange-dark transition-colors"
            >
              + Find a Gym
            </button>
          )}
        </div>

        {showSearch && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            {pts.length > 1 && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Requesting as:</label>
                <select
                  value={selectedPtId}
                  onChange={(e) => setSelectedPtId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                >
                  {pts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name || p.id}</option>
                  ))}
                </select>
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-1">Search for a gym:</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type gym name or suburb..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
              autoFocus
            />

            {searching && <p className="text-xs text-gray-400 mt-2">Searching...</p>}

            {searchResults.length > 0 && (
              <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
                {searchResults.map((gym) => {
                  const existingAff = affiliations.find(
                    (a) => a.gymId === gym.id && a.ptId === selectedPtId && (a.status === "pending" || a.status === "approved")
                  );
                  return (
                    <div
                      key={gym.id}
                      className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50"
                    >
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{gym.name}</p>
                        <p className="text-xs text-gray-500">{gym.suburb}, {gym.state}</p>
                      </div>
                      {existingAff ? (
                        <span className="text-xs text-gray-400 font-medium capitalize">{existingAff.status}</span>
                      ) : (
                        <button
                          onClick={() => requestAffiliation(gym.id)}
                          disabled={busy === "request"}
                          className="px-4 py-1.5 bg-brand-orange text-white text-sm font-semibold rounded-lg hover:bg-brand-orange-dark disabled:opacity-50"
                        >
                          Request
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-sm text-gray-400 mt-2">No gyms found. Try a different name or suburb.</p>
            )}

            <button
              onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}
              className="mt-3 text-sm text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Grouped by PT */}
      {[...byPt.values()].map(({ pt, pending, active, past }) => {
        const hasContent = pending.length > 0 || active.length > 0 || past.length > 0;

        return (
          <div key={pt.id} className={`${pts.length > 1 ? "mb-6 bg-white border border-gray-100 rounded-xl p-5" : ""}`}>
            {pts.length > 1 && (
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                {pt.name || pt.id}
                <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">PT</span>
                {pending.length > 0 && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 font-medium px-2 py-0.5 rounded-full">
                    {pending.length} pending
                  </span>
                )}
              </h4>
            )}

            {!hasContent && (
              <p className="text-gray-400 text-sm py-2">
                No gym affiliations yet.
                {!showSearch && (
                  <button onClick={() => { setSelectedPtId(pt.id); setShowSearch(true); }} className="ml-1 text-brand-orange hover:underline">
                    Find a gym
                  </button>
                )}
              </p>
            )}

            {/* Pending */}
            {pending.length > 0 && (
              <div className="space-y-2 mb-3">
                {pending.map((aff) => (
                  <div key={aff.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{aff.gymName || aff.gymId}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Awaiting gym owner approval
                        {aff.requestedAt && ` · ${new Date(aff.requestedAt).toLocaleDateString()}`}
                      </p>
                      <Link href={`/gym/${aff.gymId}`} className="text-xs text-brand-orange hover:underline mt-1 inline-block">
                        View Profile
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <span className="text-xs bg-yellow-100 text-yellow-800 font-medium px-2 py-0.5 rounded-full">Pending</span>
                      <button
                        onClick={() => setConfirmAction({ id: aff.id, ptName: pt.name || pt.id, gymName: aff.gymName || aff.gymId, action: "cancelled" })}
                        disabled={busy === aff.id}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Active */}
            {active.length > 0 && (
              <div className="space-y-2 mb-3">
                {active.map((aff) => (
                  <div key={aff.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{aff.gymName || aff.gymId}</p>
                      <Link href={`/gym/${aff.gymId}`} className="text-xs text-brand-orange hover:underline mt-1 inline-block">
                        View Profile
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Active</span>
                      <button
                        onClick={() => setConfirmAction({ id: aff.id, ptName: pt.name || pt.id, gymName: aff.gymName || aff.gymId, action: "removed" })}
                        disabled={busy === aff.id}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Past */}
            {past.length > 0 && (
              <details className="text-sm">
                <summary className="text-gray-400 cursor-pointer hover:text-gray-600">
                  {past.length} past request{past.length !== 1 ? "s" : ""}
                </summary>
                <div className="space-y-1 mt-2">
                  {past.map((aff) => (
                    <div key={aff.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-500">{aff.gymName || aff.gymId}</span>
                      <span className="text-xs bg-red-50 text-red-600 font-medium px-2 py-0.5 rounded-full capitalize">{aff.status}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        );
      })}

    </div>
  );
}
