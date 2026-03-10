import { useState, useEffect } from "react";
import Link from "next/link";
import type { Gym } from "@/types";

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

interface Props {
  gyms: Gym[];
  onPendingCount?: (n: number) => void;
}

export default function GymAffiliationsTab({ gyms, onPendingCount }: Props) {
  const [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const gymIds = gyms.map((g) => g.id);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gyms.length]);

  async function load() {
    setLoading(true);
    try {
      const allAffs: Affiliation[] = [];
      for (const gymId of gymIds) {
        const r = await fetch(`/api/affiliations?gymId=${gymId}`);
        const data = await r.json();
        if (Array.isArray(data)) allAffs.push(...data);
      }
      setAffiliations(allAffs);
      onPendingCount?.(allAffs.filter((a) => a.status === "pending").length);
    } catch { /* */ }
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function respond(id: string, status: "approved" | "rejected") {
    setBusy(id);
    try {
      const r = await fetch("/api/affiliations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (r.ok) {
        showToast(status === "approved" ? "Affiliation approved" : "Request rejected");
        load();
      }
    } catch {
      showToast("Something went wrong");
    }
    setBusy(null);
  }

  if (loading) {
    return <p className="text-gray-400 text-sm py-8 text-center">Loading affiliations...</p>;
  }

  // Group affiliations by gym
  const byGym = new Map<string, { gym: Gym; pending: Affiliation[]; active: Affiliation[]; past: Affiliation[] }>();
  for (const gym of gyms) {
    byGym.set(gym.id, { gym, pending: [], active: [], past: [] });
  }
  for (const aff of affiliations) {
    const bucket = byGym.get(aff.gymId);
    if (!bucket) continue;
    if (aff.status === "pending") bucket.pending.push(aff);
    else if (aff.status === "approved") bucket.active.push(aff);
    else bucket.past.push(aff);
  }

  const totalPending = affiliations.filter((a) => a.status === "pending").length;
  const totalActive = affiliations.filter((a) => a.status === "approved").length;

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white bg-green-600">
          {toast}
        </div>
      )}

      {totalPending === 0 && totalActive === 0 && (
        <p className="text-gray-400 text-sm py-4 text-center">No affiliation requests yet. PTs can request to affiliate with your gyms from their portal.</p>
      )}

      {[...byGym.values()].map(({ gym, pending, active, past }) => {
        const hasContent = pending.length > 0 || active.length > 0 || past.length > 0;
        if (!hasContent && gyms.length === 1) return null; // skip empty section for single gym

        return (
          <div key={gym.id} className={`${gyms.length > 1 ? "mb-6 bg-white border border-gray-100 rounded-xl p-5" : ""}`}>
            {gyms.length > 1 && (
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                {gym.name}
                {pending.length > 0 && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 font-medium px-2 py-0.5 rounded-full">
                    {pending.length} pending
                  </span>
                )}
                {active.length > 0 && (
                  <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                    {active.length} active
                  </span>
                )}
              </h4>
            )}

            {!hasContent && (
              <p className="text-gray-400 text-sm py-2">No affiliations yet.</p>
            )}

            {/* Pending */}
            {pending.length > 0 && (
              <div className="space-y-2 mb-3">
                {pending.map((aff) => (
                  <div key={aff.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        <Link href={`/pt/${aff.ptId}`} className="hover:text-brand-orange">
                          {aff.ptName || aff.ptId}
                        </Link>
                      </p>
                      {aff.requestedAt && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Requested {new Date(aff.requestedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0 ml-4">
                      <button
                        onClick={() => respond(aff.id, "approved")}
                        disabled={busy === aff.id}
                        className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => respond(aff.id, "rejected")}
                        disabled={busy === aff.id}
                        className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg font-medium disabled:opacity-50"
                      >
                        Reject
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
                    <p className="font-medium text-gray-900 text-sm">
                      <Link href={`/pt/${aff.ptId}`} className="hover:text-brand-orange">
                        {aff.ptName || aff.ptId}
                      </Link>
                    </p>
                    <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Active</span>
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
                      <span className="text-sm text-gray-500">{aff.ptName || aff.ptId}</span>
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
