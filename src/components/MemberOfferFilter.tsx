import { ALL_MEMBER_OFFERS, MEMBER_OFFER_ICONS } from "@/lib/utils";

interface Props {
  selected: string[];
  onChange: (offers: string[]) => void;
}

export default function MemberOfferFilter({ selected, onChange }: Props) {
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
        {ALL_MEMBER_OFFERS.map((offer) => {
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
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  {MEMBER_OFFER_ICONS[offer]} {offer}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
