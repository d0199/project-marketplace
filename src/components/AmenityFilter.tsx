import { useState, useEffect, useCallback } from "react";
import { ALL_AMENITIES } from "@/lib/utils";
import AmenityIcon from "./AmenityIcon";

interface Props {
  selected: string[];
  onChange: (amenities: string[]) => void;
}

export default function AmenityFilter({ selected, onChange }: Props) {
  const [amenities, setAmenities] = useState<string[]>([...ALL_AMENITIES]);

  const load = useCallback(() => {
    fetch("/api/datasets/amenities")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.entries) setAmenities(data.entries); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  function toggle(amenity: string) {
    if (selected.includes(amenity)) {
      onChange(selected.filter((a) => a !== amenity));
    } else {
      onChange([...selected, amenity]);
    }
  }

  return (
    <aside className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
          Amenities
        </h3>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-xs text-brand-orange hover:underline"
          >
            Clear
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {amenities.map((amenity) => {
          const checked = selected.includes(amenity);
          return (
            <li key={amenity}>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(amenity)}
                  className="w-4 h-4 rounded accent-brand-orange"
                />
                <span className="flex items-center gap-1.5 text-sm text-gray-700 group-hover:text-gray-900">
                  <AmenityIcon amenity={amenity} className="w-4 h-4 shrink-0 text-gray-500 group-hover:text-brand-orange transition-colors" />
                  <span className="capitalize">{amenity}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
