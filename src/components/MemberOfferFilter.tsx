import { useState, useEffect, useCallback } from "react";
import { ALL_MEMBER_OFFERS } from "@/lib/utils";
import { MemberOfferIcon } from "./AmenityIcon";

interface Props {
  selected: string[];
  onChange: (offers: string[]) => void;
}

export default function MemberOfferFilter({ selected, onChange }: Props) {
  const [offers, setOffers] = useState<string[]>([...ALL_MEMBER_OFFERS]);

  const load = useCallback(() => {
    fetch("/api/datasets/member-offers")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.entries?.length) setOffers(data.entries); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  function toggle(offer: string) {
    if (selected.includes(offer)) {
      onChange(selected.filter((o) => o !== offer));
    } else {
      onChange([...selected, offer]);
    }
  }

  return (
    <aside className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">
          Member Offers
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
        {offers.map((offer) => {
          const checked = selected.includes(offer);
          return (
            <li key={offer}>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(offer)}
                  className="w-4 h-4 rounded accent-brand-orange"
                />
                <span className="flex items-center gap-1.5 text-sm text-gray-700 group-hover:text-gray-900">
                  <MemberOfferIcon offer={offer} className="w-4 h-4 shrink-0 text-gray-500 group-hover:text-brand-orange transition-colors" />
                  <span className="capitalize">{offer}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
