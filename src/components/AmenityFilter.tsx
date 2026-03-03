import { ALL_AMENITIES, AMENITY_ICONS } from "@/lib/utils";

interface Props {
  selected: string[];
  onChange: (amenities: string[]) => void;
}

export default function AmenityFilter({ selected, onChange }: Props) {
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
        {ALL_AMENITIES.map((amenity) => {
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
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  {AMENITY_ICONS[amenity]} {amenity}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
