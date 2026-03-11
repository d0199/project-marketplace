import { useState } from "react";
import { adminFetch } from "@/lib/adminFetch";

export interface ScrapedFields {
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  bookingUrl?: string;
  amenities?: string[];
  specialties?: string[];
  description?: string;
  pricePerWeek?: number;
  pricePerSession?: number;
  sessionDuration?: number;
  availability?: string;
  qualifications?: string[];
  languages?: string[];
  experienceYears?: number;
  hours?: Record<string, string>;
  memberOffers?: string[];
}

interface ScanButtonProps {
  websiteUrl: string;
  type: "gym" | "pt";
  onResults: (fields: ScrapedFields) => void;
}

/** Trigger button — placed at the top of admin edit panels */
export function ScanButton({ websiteUrl, type, onResults }: ScanButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleScrape() {
    if (!websiteUrl?.trim()) {
      setError("No website URL on this profile. Add one first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await adminFetch("/api/admin/scrape-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl, type }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Scrape failed");
      if (!data.fields || Object.keys(data.fields).length === 0) {
        setError("No useful data could be extracted from this website.");
      } else {
        onResults(data.fields);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    }
    setLoading(false);
  }

  return (
    <div className="mb-4">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <p className="text-xs text-indigo-700 truncate">
            {websiteUrl ? (
              <>Scan <span className="font-medium">{websiteUrl}</span></>
            ) : (
              "Add a website URL to enable scanning"
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleScrape}
          disabled={loading || !websiteUrl?.trim()}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 shrink-0 ml-3"
        >
          {loading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scanning…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              Scan Website
            </>
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

/** Inline suggestion banner — placed under each field that has a scraped suggestion */
export function FieldSuggestion({
  value,
  onApply,
  onDismiss,
}: {
  value: string;
  onApply: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 flex items-start gap-2">
      <svg className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
      <p className="flex-1 text-xs text-indigo-800 break-words min-w-0">{value}</p>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onApply}
          className="px-2 py-0.5 text-[11px] font-medium bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-2 py-0.5 text-[11px] font-medium text-gray-500 bg-white border border-gray-200 rounded hover:bg-gray-100 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
