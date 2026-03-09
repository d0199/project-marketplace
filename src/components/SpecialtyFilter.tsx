import { useState, useEffect, useCallback, useMemo } from "react";
import { ALL_SPECIALTIES } from "@/lib/utils";

interface Props {
  selected: string[];
  onChange: (specialties: string[]) => void;
}

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  // Simple substring + prefix match — covers most use cases
  if (t.includes(q)) return true;
  // Match initials / abbreviations (e.g. "pt" matches "Personal Training")
  const words = t.split(/\s+/);
  const initials = words.map((w) => w[0]).join("");
  if (initials.includes(q)) return true;
  return false;
}

export default function SpecialtyFilter({ selected, onChange }: Props) {
  const [specialties, setSpecialties] = useState<string[]>([...ALL_SPECIALTIES]);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    fetch("/api/datasets/specialties")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.entries) setSpecialties(data.entries); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-fetch when tab regains focus (picks up admin dataset changes)
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return specialties;
    return specialties.filter((s) => fuzzyMatch(search.trim(), s));
  }, [specialties, search]);

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
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search specialties..."
        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent"
      />
      <ul className="space-y-2 max-h-48 overflow-y-auto">
        {/* Always show selected items first */}
        {selected
          .filter((s) => !filtered.includes(s))
          .map((s) => (
            <li key={s}>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked
                  onChange={() => toggle(s)}
                  className="w-4 h-4 rounded accent-brand-orange"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  {s}
                </span>
              </label>
            </li>
          ))}
        {filtered.map((s) => {
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
        {filtered.length === 0 && !selected.some((s) => !filtered.includes(s)) && (
          <li className="text-xs text-gray-400 py-1">No matches</li>
        )}
      </ul>
    </aside>
  );
}
