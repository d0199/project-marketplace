import { useState } from "react";
import { POSTCODE_COORDS } from "@/lib/utils";

interface Props {
  initialValue?: string;
  onSearch: (postcode: string) => void;
}

export default function SearchBar({ initialValue = "", onSearch }: Props) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!/^\d{4}$/.test(trimmed)) {
      setError("Please enter a valid 4-digit postcode.");
      return;
    }
    if (!POSTCODE_COORDS[trimmed]) {
      setError("Sorry, we don't have coverage for that postcode yet. Try 6028.");
      return;
    }
    setError("");
    onSearch(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            placeholder="Enter postcode (e.g. 6028)"
            maxLength={4}
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
  );
}
