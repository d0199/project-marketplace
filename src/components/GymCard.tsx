import { useState } from "react";
import Link from "next/link";
import type { GymWithDistance } from "@/lib/utils";
import AmenityBadge from "./AmenityBadge";
import ImageCarousel from "./ImageCarousel";
import ClaimModal from "./ClaimModal";
import { getStockImage, STOCK_ATTRIBUTION } from "@/lib/stockImages";
import { trackEvent } from "@/lib/gtag";
import { gymUrl } from "@/lib/slugify";

interface Props {
  gym: GymWithDistance;
  unclaimed?: boolean;
}

export default function GymCard({ gym, unclaimed = false }: Props) {
  const [showClaim, setShowClaim] = useState(false);
  const MAX_BADGES = 4;
  const shown = gym.amenities.slice(0, MAX_BADGES);
  const extra = gym.amenities.length - MAX_BADGES;
  const isStock = gym.images.length === 0 && unclaimed;
  const displayImages = isStock ? [getStockImage(gym.id)] : gym.images;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <div className="relative h-44 w-full bg-gray-100">
        <ImageCarousel
          images={displayImages}
          alt={gym.name}
          sizes="(max-width: 768px) 100vw, 33vw"
          focalPoints={gym.imageFocalPoints}
        />
        {isStock && (
          <span className="absolute bottom-1 right-1 text-[10px] text-white/60 bg-black/30 px-1.5 py-0.5 rounded">
            {STOCK_ATTRIBUTION}
          </span>
        )}
        {gym.isFeatured && (
          <span className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-1 rounded-full">
            ★ Featured
          </span>
        )}
        {gym.distanceKm !== undefined && (
          <span className="absolute top-2 right-2 bg-brand-black/80 text-white text-xs font-semibold px-2 py-1 rounded-full">
            {gym.distanceKm < 1
              ? `${Math.round(gym.distanceKm * 1000)} m`
              : `${gym.distanceKm.toFixed(1)} km`}
          </span>
        )}
        {gym.isPaid && gym.memberOffersScroll && gym.memberScrollText && (
          <div className="absolute bottom-0 left-0 right-0 bg-brand-black/75 overflow-hidden py-1">
            <span className="marquee-text text-white text-xs font-medium px-2">
              {gym.memberScrollText}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="font-semibold text-gray-900 text-lg leading-tight">
            {gym.name}
          </h2>
          {gym.priceVerified && gym.pricePerWeek > 0 ? (
            <span className="text-sm font-semibold text-brand-orange whitespace-nowrap">
              ${+gym.pricePerWeek.toFixed(2)}/wk
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic whitespace-nowrap">
              Check website for pricing
            </span>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-1">
          {gym.address.suburb}, {gym.address.state} {gym.address.postcode}
        </p>

        <p className="text-sm text-gray-600 line-clamp-2 mb-3 flex-1">
          {gym.description}
        </p>

        <div className="flex flex-wrap gap-1 mb-2">
          {shown.map((a) => (
            <AmenityBadge key={a} amenity={a} size="sm" />
          ))}
          {extra > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              +{extra} more
            </span>
          )}
        </div>

        {gym.specialties && gym.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {gym.specialties.slice(0, 3).map((s) => (
              <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                {s}
              </span>
            ))}
            {gym.specialties.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                +{gym.specialties.length - 3}
              </span>
            )}
          </div>
        )}

        <Link
          href={gymUrl(gym)}
          onClick={() => trackEvent("select_content", { content_type: "gym", item_id: gym.id, content_id: gym.name })}
          className="block text-center bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold py-2 rounded-lg transition-colors"
        >
          View Gym
        </Link>

        {unclaimed && (
          <button
            onClick={() => setShowClaim(true)}
            className="mt-2 w-full text-center text-xs text-gray-400 hover:text-brand-orange transition-colors"
          >
            Own this gym? Claim listing
          </button>
        )}
      </div>

      {showClaim && (
        <ClaimModal gym={gym} onClose={() => setShowClaim(false)} />
      )}
    </div>
  );
}
