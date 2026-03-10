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

export default function FeatureFlagsTab() {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    adminFetch("/api/admin/feature-flags")
      .then((r) => r.json())
      .then(setFlags)
      .catch(() => setError("Failed to load feature flags"));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(key: keyof FeatureFlags) {
    if (!flags) return;
    const newVal = !flags[key];
    setSaving(key);
    setError("");
    try {
      const res = await adminFetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newVal }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setFlags(updated);
    } catch {
      setError(`Failed to update ${key}`);
    } finally {
      setSaving(null);
    }
  }

  if (!flags) {
    return <p className="text-gray-500 py-8 text-center">Loading feature flags...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Feature Flags</h2>
          <p className="text-sm text-gray-500 mt-1">
            Control which features are visible on the public search page. Changes take effect on next page load.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {FLAGS.map(({ key, label, description }) => {
          const enabled = flags[key];
          const isSaving = saving === key;
          return (
            <div key={key} className="flex items-center justify-between px-6 py-5">
              <div className="pr-8">
                <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggle(key)}
                disabled={isSaving}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-orange focus:ring-offset-2 ${
                  enabled ? "bg-brand-orange" : "bg-gray-200"
                } ${isSaving ? "opacity-50" : ""}`}
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
        Flags are cached server-side for 30 seconds. After toggling, wait a moment then refresh the search page to see the change.
      </p>
    </div>
  );
}
