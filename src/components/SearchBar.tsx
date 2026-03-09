import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { POSTCODE_COORDS } from "@/lib/utils";

export interface SuburbSuggestion {
  name: string;
  postcode: string;
  state: string;
}

export interface GymSuggestion {
  id: string;
  name: string;
  suburb: string;
  state: string;
}

interface Props {
  initialValue?: string;
  onSearch: (postcode: string, label?: string) => void;
  suburbIndex?: SuburbSuggestion[];
  gymIndex?: GymSuggestion[];
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

export default function SearchBar({
  initialValue = "",
  onSearch,
  suburbIndex,
  gymIndex = [],
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [suburbMatches, setSuburbMatches] = useState<SuburbSuggestion[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const query = value.trim();
  const isPostcodeInput = /^\d+$/.test(query);

  // Fetch suburb suggestions from API (debounced)
  useEffect(() => {
    if (query.length < 2 || isPostcodeInput) {
      setSuburbMatches([]);
      return;
    }

    // If suburbIndex was passed as prop (e.g. from other pages), use it directly
    if (suburbIndex) {
      const q = normalize(query);
      const matches = suburbIndex
        .filter((s) => normalize(s.name).includes(q))
        .sort((a, b) => {
          const aS = normalize(a.name).startsWith(q) ? 0 : 1;
          const bS = normalize(b.name).startsWith(q) ? 0 : 1;
          return aS - bS || a.name.localeCompare(b.name);
        })
        .slice(0, 5);
      setSuburbMatches(matches);
      return;
    }

    // Debounce API calls
    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      fetch(`/api/suburbs?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: SuburbSuggestion[]) => setSuburbMatches(data))
        .catch(() => {});
    }, 150);

    return () => clearTimeout(timer);
  }, [query, isPostcodeInput, suburbIndex]);

  const gymMatches = useMemo<GymSuggestion[]>(() => {
    if (query.length < 2 || isPostcodeInput) return [];
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return gymIndex
      .filter((g) => {
        const combined = normalize(`${g.name} ${g.suburb} ${g.state}`);
        return words.every((w) => combined.includes(w));
      })
      .sort((a, b) => {
        const first = words[0];
        const aS = normalize(a.name).startsWith(first) ? 0 : 1;
        const bS = normalize(b.name).startsWith(first) ? 0 : 1;
        return aS - bS || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [query, gymIndex, isPostcodeInput]);

  type Item =
    | { kind: "suburb"; data: SuburbSuggestion }
    | { kind: "gym"; data: GymSuggestion };

  const items: Item[] = [
    ...suburbMatches.map((s) => ({ kind: "suburb" as const, data: s })),
    ...gymMatches.map((g) => ({ kind: "gym" as const, data: g })),
  ];

  const hasDropdown = open && items.length > 0;

  function pickSuburb(s: SuburbSuggestion) {
    setValue(`${s.name}, ${s.state}`);
    setOpen(false);
    setError("");
    onSearch(s.postcode, `${s.name}, ${s.state}`);
  }

  function pickGym(g: GymSuggestion) {
    setOpen(false);
    router.push(`/gym/${g.id}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = value.trim();
    if (/^\d{4}$/.test(t)) {
      if (!POSTCODE_COORDS[t]) {
        setError("Sorry, we don't have coverage for that postcode yet.");
        return;
      }
      setError("");
      setOpen(false);
      onSearch(t);
    } else if (suburbMatches.length > 0) {
      pickSuburb(suburbMatches[0]);
    } else {
      // Handle "Suburb, STATE" format (set by pickSuburb) — re-submitted via Search button
      const nameState = t.match(/^([^,]+),\s*([A-Za-z]{2,3})$/);
      if (nameState) {
        // Try local suburbIndex first, then fall back to API
        const localMatch = suburbIndex?.find(
          (s) =>
            normalize(s.name) === normalize(nameState[1]) &&
            s.state.toUpperCase() === nameState[2].toUpperCase()
        );
        if (localMatch) { pickSuburb(localMatch); return; }
        // Try API lookup
        fetch(`/api/suburbs?q=${encodeURIComponent(nameState[1])}`)
          .then((r) => r.json())
          .then((data: SuburbSuggestion[]) => {
            const found = data.find(
              (s) =>
                normalize(s.name) === normalize(nameState![1]) &&
                s.state.toUpperCase() === nameState![2].toUpperCase()
            );
            if (found) pickSuburb(found);
            else setError("Enter a postcode, suburb or gym name.");
          })
          .catch(() => setError("Enter a postcode, suburb or gym name."));
        return;
      }
      if (gymMatches.length > 0) {
        pickGym(gymMatches[0]);
      } else {
        setError("Enter a postcode, suburb or gym name.");
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!hasDropdown) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      const item = items[activeIdx];
      if (item.kind === "suburb") pickSuburb(item.data);
      else pickGym(item.data);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  const gymOffset = suburbMatches.length;

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
                setOpen(true);
                setActiveIdx(-1);
              }}
              onFocus={() => { if (items.length > 0) setOpen(true); }}
              onKeyDown={handleKeyDown}
              placeholder="Enter postcode (e.g. 6000) or search for your suburb or gym"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900 placeholder-gray-400"
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            Search Gyms
          </button>
        </div>
      </form>

      {hasDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden max-h-72 overflow-y-auto">
          {suburbMatches.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                Suburbs
              </div>
              {suburbMatches.map((s, i) => (
                <button
                  key={s.postcode}
                  type="button"
                  onMouseDown={() => pickSuburb(s)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                    activeIdx === i ? "bg-orange-50" : "hover:bg-orange-50"
                  }`}
                >
                  <span className="font-medium text-gray-800">{s.name}</span>
                  <span className="text-sm text-gray-400 shrink-0 ml-4">
                    {s.state} · {s.postcode}
                  </span>
                </button>
              ))}
            </>
          )}
          {gymMatches.length > 0 && (
            <>
              <div className={`px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 ${suburbMatches.length > 0 ? "border-t border-gray-100" : ""}`}>
                Gyms
              </div>
              {gymMatches.map((g, i) => (
                <button
                  key={g.id}
                  type="button"
                  onMouseDown={() => pickGym(g)}
                  onMouseEnter={() => setActiveIdx(gymOffset + i)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                    activeIdx === gymOffset + i ? "bg-orange-50" : "hover:bg-orange-50"
                  }`}
                >
                  <span className="font-medium text-gray-800 truncate pr-4">{g.name}</span>
                  <span className="text-sm text-gray-400 shrink-0">
                    {g.suburb}, {g.state}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
