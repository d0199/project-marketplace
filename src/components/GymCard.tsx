import Link from "next/link";
import type { GymWithDistance } from "@/lib/utils";
import AmenityBadge from "./AmenityBadge";
import ImageCarousel from "./ImageCarousel";

interface Props {
  gym: GymWithDistance;
}

export default function GymCard({ gym }: Props) {
  const MAX_BADGES = 4;
  const shown = gym.amenities.slice(0, MAX_BADGES);
  const extra = gym.amenities.length - MAX_BADGES;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <div className="relative h-44 w-full bg-gray-100">
        <ImageCarousel
          images={gym.images}
          alt={gym.name}
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        {gym.distanceKm !== undefined && (
          <span className="absolute top-2 right-2 bg-brand-black/80 text-white text-xs font-semibold px-2 py-1 rounded-full">
            {gym.distanceKm < 1
              ? `${Math.round(gym.distanceKm * 1000)} m`
              : `${gym.distanceKm.toFixed(1)} km`}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="font-semibold text-gray-900 text-lg leading-tight">
            {gym.name}
          </h2>
          <span className="text-xs text-gray-400 italic whitespace-nowrap">
            Check website for pricing
          </span>
        </div>

        <p className="text-sm text-gray-500 mb-1">
          {gym.address.suburb}, {gym.address.state} {gym.address.postcode}
        </p>

        <p className="text-sm text-gray-600 line-clamp-2 mb-3 flex-1">
          {gym.description}
        </p>

        <div className="flex flex-wrap gap-1 mb-4">
          {shown.map((a) => (
            <AmenityBadge key={a} amenity={a} />
          ))}
          {extra > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              +{extra} more
            </span>
          )}
        </div>

        <Link
          href={`/gym/${gym.id}`}
          className="block text-center bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold py-2 rounded-lg transition-colors"
        >
          View Gym
        </Link>
      </div>
    </div>
  );
}
