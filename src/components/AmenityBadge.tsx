import AmenityIcon from "./AmenityIcon";

interface Props {
  amenity: string;
  size?: "sm" | "md";
  dynamicIcons?: Record<string, string>;
}

export default function AmenityBadge({ amenity, size = "md", dynamicIcons }: Props) {
  const cls = size === "sm"
    ? "inline-flex items-center gap-0.5 bg-orange-50 text-brand-orange border border-orange-200 rounded-full px-2 py-0.5 text-xs font-medium"
    : "inline-flex items-center gap-1.5 bg-orange-50 text-brand-orange border border-orange-200 rounded-full px-3 py-1 text-sm font-medium";
  return (
    <span className={cls}>
      <AmenityIcon amenity={amenity} className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} dynamicIcons={dynamicIcons} />
      <span className="capitalize">{amenity}</span>
    </span>
  );
}
