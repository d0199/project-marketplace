import { useState, useRef, useEffect, useCallback } from "react";
import { adminFetch } from "@/lib/adminFetch";

interface PlacePrediction {
  placeId: string;
  description: string;
}

interface AddressResult {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
}

interface Props {
  onSelect: (result: AddressResult) => void;
  inputClassName?: string;
}

export default function AddressAutocomplete({ onSelect, inputClassName }: Props) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShow(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      return;
    }
    setLoading(true);
    try {
      const r = await adminFetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
      const data = await r.json();
      setPredictions(data.predictions ?? []);
      setShow(true);
    } catch {
      setPredictions([]);
    }
    setLoading(false);
  }, []);

  function handleInput(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchPredictions(value), 300);
  }

  async function selectPlace(prediction: PlacePrediction) {
    setShow(false);
    setQuery(prediction.description);
    try {
      const r = await adminFetch(`/api/places/detail?placeId=${encodeURIComponent(prediction.placeId)}`);
      const data = await r.json();
      if (data.error) {
        console.error("[AddressAutocomplete] API error:", data.error);
        return;
      }
      onSelect({
        street: data.street ?? "",
        suburb: data.suburb ?? "",
        state: data.state ?? "",
        postcode: data.postcode ?? "",
        lat: data.lat ?? null,
        lng: data.lng ?? null,
      });
      setQuery("");
    } catch (err) {
      console.error("[AddressAutocomplete] selectPlace error:", err);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        placeholder="Search address..."
        className={inputClassName}
      />
      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-brand-orange rounded-full animate-spin" />
        </div>
      )}
      {show && predictions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((p) => (
            <li
              key={p.placeId}
              onClick={() => selectPlace(p)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-orange-50 border-b border-gray-100 last:border-0"
            >
              {p.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
