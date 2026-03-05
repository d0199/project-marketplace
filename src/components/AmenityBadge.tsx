import { AMENITY_ICONS } from "@/lib/utils";

interface Props {
  amenity: string;
  size?: "sm" | "md";
}

export default function AmenityBadge({ amenity, size = "md" }: Props) {
  const icon = AMENITY_ICONS[amenity] ?? "✓";
  const cls = size === "sm"
    ? "inline-flex items-center gap-0.5 bg-orange-50 text-brand-orange border border-orange-200 rounded-full px-2 py-0.5 text-xs font-medium"
    : "inline-flex items-center gap-1 bg-orange-50 text-brand-orange border border-orange-200 rounded-full px-3 py-1 text-sm font-medium";
  return (
    <span className={cls}>
      <span>{icon}</span>
      <span className="capitalize">{amenity}</span>
    </span>
  );
}
