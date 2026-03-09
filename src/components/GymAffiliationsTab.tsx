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

      {/* Pending Requests */}
      {pending.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            Pending Requests
            <span className="w-2 h-2 rounded-full bg-brand-orange" />
          </h3>
          <div className="space-y-3">
            {pending.map((aff) => {
              const gym = gyms.find((g) => g.id === aff.gymId);
              return (
                <div key={aff.id} className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      <Link href={`/pt/${aff.ptId}`} className="hover:text-brand-orange">
                        {aff.ptName || aff.ptId}
                      </Link>
                    </p>
                    <p className="text-sm text-gray-500">
                      wants to affiliate with <strong>{gym?.name || aff.gymName || aff.gymId}</strong>
                    </p>
                    {aff.requestedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(aff.requestedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => respond(aff.id, "approved")}
                      disabled={busy === aff.id}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => respond(aff.id, "rejected")}
                      disabled={busy === aff.id}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Active Affiliations */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Active Affiliations</h3>
        {active.length === 0 ? (
          <p className="text-gray-400 text-sm py-4">No active PT affiliations yet.</p>
        ) : (
          <div className="space-y-3">
            {active.map((aff) => {
              const gym = gyms.find((g) => g.id === aff.gymId);
              return (
                <div key={aff.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      <Link href={`/pt/${aff.ptId}`} className="hover:text-brand-orange">
                        {aff.ptName || aff.ptId}
                      </Link>
                    </p>
                    <p className="text-sm text-gray-500">
                      at <strong>{gym?.name || aff.gymName || aff.gymId}</strong>
                    </p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">Active</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Rejected / Removed */}
      {rejected.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900 mb-3 text-gray-500">Past Requests</h3>
          <div className="space-y-2">
            {rejected.map((aff) => (
              <div key={aff.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">{aff.ptName || aff.ptId}</p>
                  <p className="text-xs text-gray-400">{aff.gymName || aff.gymId}</p>
                </div>
                <span className="text-xs bg-red-50 text-red-600 font-medium px-2 py-0.5 rounded-full capitalize">{aff.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
