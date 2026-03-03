import { AMENITY_ICONS } from "@/lib/utils";

interface Props {
  amenity: string;
}

export default function AmenityBadge({ amenity }: Props) {
  const icon = AMENITY_ICONS[amenity] ?? "✓";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
      <span>{icon}</span>
      <span className="capitalize">{amenity}</span>
    </span>
  );
}
