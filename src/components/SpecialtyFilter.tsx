import { useState, useEffect, useCallback } from "react";
import { ALL_SPECIALTIES } from "@/lib/utils";

interface Props {
  selected: string[];
  onChange: (specialties: string[]) => void;
}

export default function SpecialtyFilter({ selected, onChange }: Props) {
  const [specialties, setSpecialties] = useState<string[]>([...ALL_SPECIALTIES]);

  const load = useCallback(() => {
    fetch("/api/datasets/specialties")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.entries?.length) setSpecialties(data.entries); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-fetch when tab regains focus (picks up admin dataset changes)
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  function toggle(s: string) {
    if (selected.includes(s)) {
      onChange(selected.filter((x) => x !== s));
    } else {
      onChange([...selected, s]);
    }
  }

  return (
    <aside className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
          Specialties
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
      <ul className="space-y-2 max-h-48 overflow-y-auto">
        {specialties.map((s) => {
          const checked = selected.includes(s);
          return (
            <li key={s}>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s)}
                  className="w-4 h-4 rounded accent-brand-orange"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  {s}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
