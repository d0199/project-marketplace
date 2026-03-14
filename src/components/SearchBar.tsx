import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { trackEvent } from "@/lib/gtag";
import { gymUrl } from "@/lib/slugify";

export interface SuburbSuggestion {
  name: string;
  postcode: string;
  state: string;
}

export interface GymSuggestion {
  id: string;
  slug: string;
  suburbSlug: string;
  name: string;
  suburb: string;
  state: string;
}

interface Props {
  initialValue?: string;
  onSearch: (postcode: string, label?: string) => void;
  suburbIndex?: SuburbSuggestion[];
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

export default function SearchBar({
  initialValue = "",
  onSearch,
  suburbIndex,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [suburbMatches, setSuburbMatches] = useState<SuburbSuggestion[]>([]);
  const [gymMatches, setGymMatches] = useState<GymSuggestion[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const gymAbortRef = useRef<AbortController | null>(null);

  // Close dropdown on outside click; dismiss error on any click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
      // Dismiss error on any click anywhere on the page
      setError("");
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const query = value.trim();
  const isPostcodeInput = /^\d+$/.test(query);

  // Fetch suburb/postcode suggestions from API (debounced)
  useEffect(() => {
    if (query.length < 2) {
      setSuburbMatches([]);
      return;
    }

    // If suburbIndex was passed as prop (e.g. from other pages), use it directly
    if (suburbIndex) {
      const q = normalize(query);
      let matches: SuburbSuggestion[];
      if (isPostcodeInput) {
        // Postcode prefix — show all suburbs for matching postcodes
        matches = [];
        for (const s of suburbIndex) {
          if (!s.postcode.startsWith(query)) continue;
          matches.push(s);
          if (matches.length >= 8) break;
        }
      } else {
        matches = suburbIndex
          .filter((s) => normalize(s.name).includes(q))
          .sort((a, b) => {
            const aS = normalize(a.name).startsWith(q) ? 0 : 1;
            const bS = normalize(b.name).startsWith(q) ? 0 : 1;
            return aS - bS || a.name.localeCompare(b.name);
          })
          .slice(0, 5);
      }
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
    }, 80);

    return () => clearTimeout(timer);
  }, [query, isPostcodeInput, suburbIndex]);

  // Fetch gym name suggestions from API (debounced)
  useEffect(() => {
    if (query.length < 2 || isPostcodeInput) {
      setGymMatches([]);
      return;
    }

    const timer = setTimeout(() => {
      gymAbortRef.current?.abort();
      const ctrl = new AbortController();
      gymAbortRef.current = ctrl;
      fetch(`/api/gyms/names?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data: GymSuggestion[]) => setGymMatches(data))
        .catch(() => {});
    }, 80);

    return () => clearTimeout(timer);
  }, [query, isPostcodeInput]);

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
    trackEvent("search", { search_term: `${s.name}, ${s.state}`, postcode: s.postcode });
    onSearch(s.postcode, `${s.name}, ${s.state}`);
  }

  function pickGym(g: GymSuggestion) {
    setOpen(false);
    router.push(gymUrl(g));
  }

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          console.log("[GeoLocate] coords:", latitude, longitude, "accuracy:", accuracy, "m");

          // Accuracy > 5 km means IP-based fallback — too unreliable
          if (accuracy > 5000) {
            setLocating(false);
            setError("Location too imprecise. Please enter your suburb or postcode instead.");
            return;
          }

          const res = await fetch(`/api/postcodes/nearest?lat=${latitude}&lng=${longitude}`);
          const nearest = res.ok ? await res.json() as { postcode: string; distance: number } : null;
          console.log("[GeoLocate] nearest:", nearest);
          setLocating(false);
          if (nearest) {
            setValue(nearest.postcode);
            setOpen(false);
            onSearch(nearest.postcode);
          } else {
            setError("No coverage found near your location.");
          }
        } catch {
          setLocating(false);
          setError("Something went wrong finding nearby postcodes.");
        }
      },
      (err) => {
        setLocating(false);
        console.log("[GeoLocate] error:", err.code, err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location access denied. Please allow location access in your browser settings.");
        } else if (err.code === err.TIMEOUT) {
          setError("Location request timed out. Please try again.");
        } else {
          setError("Unable to get your location. Please try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, [onSearch]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = value.trim();
    if (/^\d{4}$/.test(t)) {
      // If we have a dropdown match for this postcode, use it (gives suburb name label)
      const exactMatch = suburbMatches.find((s) => s.postcode === t);
      if (exactMatch) {
        pickSuburb(exactMatch);
        return;
      }
      // Otherwise validate via API
      try {
        const res = await fetch(`/api/postcodes/validate?postcode=${t}`);
        const data = await res.json() as { valid: boolean; suburb?: string; lat?: number; lng?: number };
        if (!data.valid) {
          setError("Sorry, we don't have coverage for that postcode yet.");
          return;
        }
        setError("");
        setOpen(false);
        const label = data.suburb ? `${data.suburb}` : undefined;
        trackEvent("search", { search_term: t, postcode: t });
        onSearch(t, label);
      } catch {
        setError("Something went wrong. Please try again.");
      }
      return;
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
          <div className="flex-1 relative">
            <input
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
                setOpen(true);
                setActiveIdx(-1);
              }}
              onFocus={() => { setError(""); if (items.length > 0) setOpen(true); }}
              onKeyDown={handleKeyDown}
              placeholder="Enter postcode (e.g. 6000) or search for your suburb or gym"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-orange text-gray-900 placeholder-gray-400"
            />
            {error && <p className="absolute left-0 mt-1 text-sm font-bold text-white">{error}</p>}
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            Search Gyms
          </button>
          <button
            type="button"
            onClick={handleLocate}
            disabled={locating}
            className="px-3 py-3 hover:text-brand-orange text-white/55 hover:text-white/90 transition-colors disabled:opacity-50"
            title="Use my location"
            aria-label="Use my location"
          >
            {locating ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" className="opacity-75" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="4" />
                <line x1="12" y1="20" x2="12" y2="22" />
                <line x1="2" y1="12" x2="4" y2="12" />
                <line x1="20" y1="12" x2="22" y2="12" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {hasDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden max-h-72 overflow-y-auto">
          {suburbMatches.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                {isPostcodeInput ? "Postcodes" : "Suburbs"}
              </div>
              {suburbMatches.map((s, i) => (
                <button
                  key={`${s.postcode}-${s.name}`}
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
