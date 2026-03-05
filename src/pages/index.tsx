import { useState, useMemo, useEffect } from "react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import SearchBar from "@/components/SearchBar";
import AmenityFilter from "@/components/AmenityFilter";
import MemberOfferFilter from "@/components/MemberOfferFilter";
import GymCard from "@/components/GymCard";
import { filterGyms, rankGyms, POSTCODE_META, type GymWithDistance } from "@/lib/utils";
import { ownerStore } from "@/lib/ownerStore";
import type { Gym } from "@/types";

const DEFAULT_RADIUS = 10;
const MIN_RADIUS = 1;
const MAX_RADIUS = 50;

interface Props {
  gyms: Gym[];
}

export default function HomePage({ gyms }: Props) {
  const [postcode, setPostcode] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedMemberOffers, setSelectedMemberOffers] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS);
  const [sortBy, setSortBy] = useState<"distance-asc" | "distance-desc" | "price-asc" | "price-desc" | null>(null);
  const [canSeeTestGyms, setCanSeeTestGyms] = useState(false);
  // Rotation seed changes every 8 hours — stable for the session
  const rotationSeed = useMemo(() => Math.floor(Date.now() / (8 * 60 * 60 * 1000)), []);

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        const attrs = await fetchUserAttributes();
        const email = user.signInDetails?.loginId ?? attrs.email ?? "";
        setCanSeeTestGyms(email.endsWith("@mynextgym.com.au"));
      })
      .catch(() => {});
  }, []);

  const visibleGyms = useMemo(
    () => gyms
      .filter((g) => g.isActive !== false)
      .filter((g) => canSeeTestGyms || !g.isTest),
    [gyms, canSeeTestGyms]
  );

  const results: GymWithDistance[] = useMemo(() => {
    if (!hasSearched) return [];
    const filtered = filterGyms(visibleGyms, {
      postcode: postcode || undefined,
      amenities: selectedAmenities,
      memberOffers: selectedMemberOffers,
      radiusKm,
    });
    if (!sortBy) return rankGyms(filtered, rotationSeed);
    const sorted = [...filtered];
    if (sortBy === "distance-asc") sorted.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    else if (sortBy === "distance-desc") sorted.sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0));
    else if (sortBy === "price-asc") sorted.sort((a, b) => a.pricePerWeek - b.pricePerWeek);
    else if (sortBy === "price-desc") sorted.sort((a, b) => b.pricePerWeek - a.pricePerWeek);
    return sorted;
  }, [visibleGyms, postcode, selectedAmenities, selectedMemberOffers, hasSearched, radiusKm, sortBy, rotationSeed]);

  function handleSearch(pc: string) {
    setPostcode(pc);
    setHasSearched(true);
  }

  return (
    <>
      <Head>
        <title>Find Gyms across Australia | mynextgym.com.au</title>
        <meta name="description" content="Search gyms across Australia by suburb and postcode. Compare prices, amenities and opening hours in WA, NSW, VIC, QLD and SA." />
        <meta property="og:title" content="Find Gyms across Australia | mynextgym.com.au" />
        <meta property="og:description" content="Search gyms across Australia by suburb and postcode. Compare prices, amenities and opening hours." />
        <meta property="og:type" content="website" />
      </Head>
      <Layout>
        {/* Hero */}
        <div className="bg-gradient-to-r from-brand-orange to-brand-orange-dark rounded-2xl px-8 py-12 mb-8 text-white">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Find your perfect gym</h1>
          <p className="text-orange-100 mb-6 text-lg">
            Search hundreds of gyms across Australia by postcode and amenities.
          </p>
          <SearchBar onSearch={handleSearch} initialValue={postcode} />

          {/* Radius control — half-width, left-aligned */}
          <div className="mt-5 max-w-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-orange-100 text-sm">Search radius</span>
              <span className="text-white font-bold text-sm tabular-nums">{radiusKm} km</span>
            </div>
            <input
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step={1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full cursor-pointer accent-white"
            />
            <div className="flex justify-between text-xs text-orange-200 mt-1">
              <span>{MIN_RADIUS} km</span>
              <span>{MAX_RADIUS} km</span>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-52 shrink-0 hidden sm:block">
            <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
            <MemberOfferFilter selected={selectedMemberOffers} onChange={setSelectedMemberOffers} />
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <div className="sm:hidden mb-4">
              <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
              <MemberOfferFilter selected={selectedMemberOffers} onChange={setSelectedMemberOffers} />
            </div>

            {!hasSearched ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-5xl mb-4">🏋️</p>
                <p className="text-lg font-medium text-gray-500">Enter a postcode above to find gyms near you</p>
                <p className="text-sm mt-2">Try <strong className="text-gray-600">6000</strong> for Perth CBD or <strong className="text-gray-600">2000</strong> for Sydney CBD</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-5xl mb-4">😕</p>
                <p className="text-lg font-medium text-gray-500">
                  No gyms found within {radiusKm} km of {postcode}
                </p>
                <p className="text-sm mt-2">Try increasing the radius or removing amenity filters</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    {results.length} gym{results.length !== 1 ? "s" : ""} within {radiusKm} km of {postcode}
                  </p>
                  <select
                    value={sortBy ?? ""}
                    onChange={(e) => setSortBy((e.target.value || null) as typeof sortBy)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  >
                    <option value="">Sort by</option>
                    <option value="distance-asc">Distance: Nearest first</option>
                    <option value="distance-desc">Distance: Farthest first</option>
                    <option value="price-asc">Price: Low to high</option>
                    <option value="price-desc">Price: High to low</option>
                  </select>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((gym) => (
                    <GymCard key={gym.id} gym={gym} unclaimed={gym.ownerId === "owner-3" || gym.ownerId === "unclaimed"} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Browse by suburb — grouped by state, hidden once user has searched */}
        {!hasSearched && (
          <div className="mt-12 border-t pt-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-6">
              Browse gyms by suburb
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {(["WA", "NSW", "VIC", "QLD", "SA"] as const).map((state) => {
                const suburbs = Object.values(POSTCODE_META).filter((m) => m.state === state);
                return (
                  <div key={state}>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{state}</p>
                    <ul className="space-y-1">
                      {suburbs.map((meta) => (
                        <li key={meta.slug}>
                          <Link
                            href={`/gyms/${meta.slug}`}
                            className="text-sm text-brand-orange hover:underline"
                          >
                            Gyms in {meta.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Layout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  return { props: { gyms: await ownerStore.getAll() } };
};
