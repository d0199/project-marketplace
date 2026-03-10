import { useEffect, useState, useCallback } from "react";
import { adminFetch } from "@/lib/adminFetch";

interface FeatureFlags {
  ptSearch: boolean;
  specialties: boolean;
  memberOffers: boolean;
  amenities: boolean;
  radiusSlider: boolean;
}

interface FlagMeta {
  key: keyof FeatureFlags;
  label: string;
  description: string;
}

const FLAGS: FlagMeta[] = [
  {
    key: "ptSearch",
    label: "Personal Trainer Search",
    description: "Show the Gyms / Personal Trainers toggle on the search page. When off, only gym search is available.",
  },
  {
    key: "amenities",
    label: "Amenities",
    description: "Show amenity filters — hero icons (pool, sauna, 24/7, etc.) and sidebar filter. When off, amenities are hidden from search entirely.",
  },
  {
    key: "specialties",
    label: "Specialties",
    description: "Show specialty filters — hero chips and sidebar filter. When off, specialties are hidden from search entirely.",
  },
  {
    key: "memberOffers",
    label: "Member Offers",
    description: "Show the member offers filter in the search sidebar.",
  },
  {
    key: "radiusSlider",
    label: "Radius Slider",
    description: "Show the search radius slider in the sidebar. When off, a default radius is used.",
  },
];

export default function FeatureFlagsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [liveFlags, setLiveFlags] = useState<FeatureFlags | null>(null);
  const [draft, setDraft] = useState<FeatureFlags | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(() => {
    adminFetch("/api/admin/feature-flags")
      .then((r) => r.json())
      .then((data: FeatureFlags) => {
        setLiveFlags(data);
        setDraft(data);
      })
      .catch(() => setError("Failed to load feature flags"));
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleDraft(key: keyof FeatureFlags) {
    if (!draft) return;
    setDraft({ ...draft, [key]: !draft[key] });
    setSuccess("");
  }

  function discardChanges() {
    if (liveFlags) setDraft({ ...liveFlags });
    setSuccess("");
  }

  // Compute which flags changed
  const changes: { key: keyof FeatureFlags; label: string; from: boolean; to: boolean }[] = [];
  if (liveFlags && draft) {
    for (const f of FLAGS) {
      if (liveFlags[f.key] !== draft[f.key]) {
        changes.push({ key: f.key, label: f.label, from: liveFlags[f.key], to: draft[f.key] });
      }
    }
  }
  const hasChanges = changes.length > 0;

  async function confirmChanges() {
    if (!hasChanges || !draft) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const partial: Partial<FeatureFlags> = {};
      for (const c of changes) {
        partial[c.key] = c.to;
      }
      const res = await adminFetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setLiveFlags(updated);
      setDraft(updated);
      setSuccess("Feature flags updated successfully.");
    } catch {
      setError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Super Admin Required</h2>
        <p className="text-sm text-gray-500">
          Feature flag management is restricted to super administrators.
        </p>
      </div>
    );
  }

  if (!liveFlags || !draft) {
    return <p className="text-gray-500 py-8 text-center">Loading feature flags...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Feature Flags</h2>
          <p className="text-sm text-gray-500 mt-1">
            Toggle features below, then review and confirm your changes before they go live.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
      )}
      {success && (
        <div className="mb-4 px-4 py-2 bg-green-50 text-green-700 text-sm rounded-lg">{success}</div>
      )}

      {/* Pending changes banner */}
      {hasChanges && (
        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">
            Pending changes ({changes.length})
          </h3>
          <div className="space-y-2 mb-4">
            {changes.map((c) => (
              <div key={c.key} className="flex items-center gap-2 text-sm">
                <span className={`inline-block w-2 h-2 rounded-full ${c.to ? "bg-green-500" : "bg-red-500"}`} />
                <span className="font-medium text-gray-900">{c.label}</span>
                <span className="text-gray-400">—</span>
                <span className={c.to ? "text-green-700" : "text-red-700"}>
                  {c.to ? "Turning ON" : "Turning OFF"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={confirmChanges}
              disabled={saving}
              className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Confirm changes"}
            </button>
            <button
              type="button"
              onClick={discardChanges}
              disabled={saving}
              className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {FLAGS.map(({ key, label, description }) => {
          const enabled = draft[key];
          const changed = liveFlags[key] !== draft[key];
          return (
            <div key={key} className={`flex items-center justify-between px-6 py-5 ${changed ? "bg-amber-50/50" : ""}`}>
              <div className="pr-8">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
                  {changed && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {enabled ? "will turn on" : "will turn off"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleDraft(key)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2 ${
                  enabled ? "bg-brand-orange" : "bg-gray-200"
                }`}
                role="switch"
                aria-checked={enabled}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        Flags are cached server-side for 30 seconds. After confirming, wait a moment then refresh the search page to see the change.
      </p>
    </div>
  );
}
