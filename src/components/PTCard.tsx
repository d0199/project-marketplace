import { useState } from "react";
import Link from "next/link";
import ImageCarousel from "./ImageCarousel";
import PTClaimModal from "./PTClaimModal";
import { getStockImage, STOCK_ATTRIBUTION } from "@/lib/stockImages";

export interface PTWithDistance {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  address: { suburb: string; state: string; postcode: string };
  specialties: string[];
  qualifications: string[];
  experienceYears?: number;
  pricePerSession?: number;
  sessionDuration?: number;
  images: string[];
  imageFocalPoints?: number[];
  isFeatured?: boolean;
  isPaid?: boolean;
  distanceKm?: number;
  gender?: string;
}

interface Props {
  pt: PTWithDistance;
}

export default function PTCard({ pt }: Props) {
  const [showClaim, setShowClaim] = useState(false);
  const unclaimed = pt.ownerId === "unclaimed" || pt.ownerId === "owner-3";
  const isStock = pt.images.length === 0;
  const displayImages = isStock ? [getStockImage(pt.id)] : pt.images;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <div className="relative h-44 w-full bg-gray-100">
        <ImageCarousel
          images={displayImages}
          alt={pt.name}
          sizes="(max-width: 768px) 100vw, 33vw"
          focalPoints={pt.imageFocalPoints}
        />
        {isStock && unclaimed && (
          <span className="absolute bottom-1 right-1 text-[10px] text-white/60 bg-black/30 px-1.5 py-0.5 rounded">
            {STOCK_ATTRIBUTION}
          </span>
        )}
        {pt.isFeatured && (
          <span className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-xs font-bold px-2 py-1 rounded-full">
            ★ Featured
          </span>
        )}
        {pt.distanceKm !== undefined && (
          <span className="absolute top-2 right-2 bg-brand-black/80 text-white text-xs font-semibold px-2 py-1 rounded-full">
            {pt.distanceKm < 1
              ? `${Math.round(pt.distanceKm * 1000)} m`
              : `${pt.distanceKm.toFixed(1)} km`}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="font-semibold text-gray-900 text-lg leading-tight">
            {pt.name}
          </h2>
          {pt.pricePerSession && pt.pricePerSession > 0 ? (
            <span className="text-sm font-semibold text-brand-orange whitespace-nowrap">
              ${pt.pricePerSession}/session
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic whitespace-nowrap">
              Contact for pricing
            </span>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-1">
          {pt.address.suburb}, {pt.address.state} {pt.address.postcode}
          {pt.experienceYears ? ` · ${pt.experienceYears} yrs exp` : ""}
        </p>

        <p className="text-sm text-gray-600 line-clamp-2 mb-3 flex-1">
          {pt.description}
        </p>

        {pt.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {pt.specialties.slice(0, 4).map((s) => (
              <span key={s} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                {s}
              </span>
            ))}
            {pt.specialties.length > 4 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                +{pt.specialties.length - 4} more
              </span>
            )}
          </div>
        )}

        <Link
          href={`/pt/${pt.id}`}
          className="block text-center bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold py-2 rounded-lg transition-colors"
        >
          View Trainer
        </Link>

        {unclaimed && (
          <button
            onClick={() => setShowClaim(true)}
            className="mt-2 w-full text-center text-xs text-gray-400 hover:text-brand-orange transition-colors"
          >
            Own this profile? Claim listing
          </button>
        )}
      </div>

      {showClaim && (
        <PTClaimModal pt={pt} onClose={() => setShowClaim(false)} />
      )}
    </div>
  );
}
