import { AMENITY_ICONS } from "@/lib/utils";

interface Props {
  amenity: string;
}

export default function AmenityBadge({ amenity }: Props) {
  const icon = AMENITY_ICONS[amenity] ?? "✓";
  return (
    <span className="inline-flex items-center gap-1 bg-orange-50 text-brand-orange border border-orange-200 rounded-full px-3 py-1 text-sm font-medium">
      <span>{icon}</span>
      <span className="capitalize">{amenity}</span>
    </span>
  );
}
