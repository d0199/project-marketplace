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
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      const r = await fetch("/api/affiliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ptId: selectedPtId,
          gymId,
          requestedBy: "pt",
        }),
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
    setBusy(false);
  }

  const pending = affiliations.filter((a) => a.status === "pending");
  const active = affiliations.filter((a) => a.status === "approved");
  const rejected = affiliations.filter((a) => a.status === "rejected" || a.status === "removed");

  if (loading) {
    return <p className="text-gray-400 text-sm py-8 text-center">Loading affiliations...</p>;
  }

  return (
    <div>
      {toast && (
        <div className="mb-4 px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
          {toast}
        </div>
      )}

      {/* Request Affiliation */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Request Gym Affiliation</h3>
          {!showSearch && (
            <button
              onClick={() => setShowSearch(true)}
              className="px-4 py-2 bg-brand-orange text-white text-sm font-medium rounded-lg hover:bg-brand-orange-dark transition-colors"
            >
              + Find a Gym
            </button>
          )}
        </div>

        {showSearch && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            {/* PT selector (if multiple PTs) */}
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
                        <p className="font-medium text-gray-900">{gym.name}</p>
                        <p className="text-sm text-gray-500">{gym.suburb}, {gym.state}</p>
                      </div>
                      {existingAff ? (
                        <span className="text-xs text-gray-400 font-medium capitalize">{existingAff.status}</span>
                      ) : (
                        <button
                          onClick={() => requestAffiliation(gym.id)}
                          disabled={busy}
                          className="px-3 py-1.5 bg-brand-orange text-white text-sm rounded-lg hover:bg-brand-orange-dark disabled:opacity-50"
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
              className="mt-3 text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            Pending Requests
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
          </h3>
          <div className="space-y-3">
            {pending.map((aff) => (
              <div key={aff.id} className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{aff.gymName || aff.gymId}</p>
                  <p className="text-sm text-gray-500">
                    Awaiting approval from gym owner
                    {pts.length > 1 && <span className="text-gray-400"> · as {aff.ptName || aff.ptId}</span>}
                  </p>
                  {aff.requestedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Requested {new Date(aff.requestedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-800 font-medium px-2 py-0.5 rounded-full">Pending</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active Affiliations */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Active Affiliations</h3>
        {active.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm mb-2">No active gym affiliations yet.</p>
            {!showSearch && (
              <button
                onClick={() => setShowSearch(true)}
                className="text-sm text-brand-orange hover:underline"
              >
                Find a gym to affiliate with
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((aff) => (
              <div key={aff.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    <Link href={`/gym/${aff.gymId}`} className="hover:text-brand-orange">
                      {aff.gymName || aff.gymId}
                    </Link>
                  </p>
                  {pts.length > 1 && (
                    <p className="text-sm text-gray-500">as {aff.ptName || aff.ptId}</p>
                  )}
                </div>
                <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Active</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rejected */}
      {rejected.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Past Requests</h3>
          <div className="space-y-2">
            {rejected.map((aff) => (
              <div key={aff.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg">
                <p className="text-sm text-gray-600">{aff.gymName || aff.gymId}</p>
                <span className="text-xs bg-red-50 text-red-600 font-medium px-2 py-0.5 rounded-full capitalize">{aff.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-gray-400 mt-6">
        To remove or edit an affiliation, please contact admin.
      </p>
    </div>
  );
}
