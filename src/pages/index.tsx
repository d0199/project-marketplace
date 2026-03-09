import React, { useState, useCallback, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import SearchBar from "@/components/SearchBar";
import AmenityFilter from "@/components/AmenityFilter";
import MemberOfferFilter from "@/components/MemberOfferFilter";
import GymCard from "@/components/GymCard";
import { POSTCODE_META, type GymWithDistance } from "@/lib/utils";

const DEFAULT_RADIUS = 10;
const MIN_RADIUS = 1;
const MAX_RADIUS = 50;

export default function HomePage() {
  const router = useRouter();
  const [postcode, setPostcode] = useState("");
  const [searchLabel, setSearchLabel] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedMemberOffers, setSelectedMemberOffers] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS);
  const [sortBy, setSortBy] = useState<"distance-asc" | "distance-desc" | "price-asc" | "price-desc" | null>(null);
  const [canSeeTestGyms, setCanSeeTestGyms] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<GymWithDistance[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-search when arriving from suburb page with ?postcode=xxx
  useEffect(() => {
    const pc = router.query.postcode as string | undefined;
    if (pc) {
      setPostcode(pc);
      setHasSearched(true);
    }
  }, [router.query.postcode]);

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        const attrs = await fetchUserAttributes();
        const email = user.signInDetails?.loginId ?? attrs.email ?? "";
        setCanSeeTestGyms(email.endsWith("@mynextgym.com.au"));
      })
      .catch(() => {});
  }, []);

  // Fetch results from API whenever search params change
  const fetchResults = useCallback(async (
    pc: string,
    radius: number,
    amenities: string[],
    memberOffers: string[],
    sort: string | null,
    includeTest: boolean,
  ) => {
    if (!pc) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("postcode", pc);
      params.set("radius", String(radius));
      if (amenities.length) params.set("amenities", amenities.join(","));
      if (memberOffers.length) params.set("memberOffers", memberOffers.join(","));
      if (sort) params.set("sort", sort);
      if (includeTest) params.set("test", "1");
      const res = await fetch(`/api/gyms/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when filters change (only after initial search)
  useEffect(() => {
    if (!hasSearched || !postcode) return;
    fetchResults(postcode, radiusKm, selectedAmenities, selectedMemberOffers, sortBy, canSeeTestGyms);
  }, [hasSearched, postcode, radiusKm, selectedAmenities, selectedMemberOffers, sortBy, canSeeTestGyms, fetchResults]);

  function handleSearch(pc: string, label?: string) {
    setPostcode(pc);
    setSearchLabel(label || pc);
    setHasSearched(true);
    setPageSize(25);
    setPage(1);
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
      <Layout hero={
        <div className="relative" style={{ height: 460 }}>
          <div className="absolute inset-0 overflow-hidden">
            <Image src="/stock/Hero.jpg" alt="" fill className="object-cover" priority sizes="100vw" />
            <div className="absolute inset-0 bg-black/60" />
          </div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-3 drop-shadow-lg">
              Your Next Move Starts Here.
            </h1>
            <p className="text-white/75 text-lg mb-7">
              Discover thousands of premium gyms across Australia
            </p>

            <div className="w-full max-w-2xl">
              <SearchBar
                onSearch={handleSearch}
                initialValue={postcode}
              />
            </div>

            <div className="flex items-end justify-evenly w-full max-w-2xl mt-7">
              {([
                {
                  key: "pool", label: "pool",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
                      <path d="M2 18c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3-2 4.5 0" strokeLinecap="round" />
                      <circle cx="16" cy="7" r="2" />
                      <path d="M4 13l4-5 3 3 2.5-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  key: "spa", label: "spa",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
                      <path d="M12 3C9 7 6 9 6 13a6 6 0 0012 0c0-4-3-6-6-10z" strokeLinejoin="round" />
                      <path d="M12 19v3M9 22h6" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  key: "sauna", label: "sauna",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
                      <path d="M8 2c0 2.5-2 3.5-2 6M12 2c0 2.5-2 3.5-2 6M16 2c0 2.5-2 3.5-2 6" strokeLinecap="round" />
                      <rect x="3" y="12" width="18" height="9" rx="2" />
                      <path d="M7 17h10" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  key: "24/7 access", label: "24/7",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  key: "personal training", label: "PT",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
                      <circle cx="12" cy="5" r="2" />
                      <path d="M12 9v6M9 12h6" strokeLinecap="round" />
                      <path d="M6 8l2 2M18 8l-2 2M8 19l2-4M16 19l-2-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  key: "childcare", label: "crèche",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
                      <circle cx="12" cy="6" r="2.5" />
                      <path d="M9 11c-2 .5-3 2-3 4v1h12v-1c0-2-1-3.5-3-4" strokeLinecap="round" />
                      <path d="M8 20c0-1.5 4-2.5 4-2.5s4 1 4 2.5" strokeLinecap="round" />
                    </svg>
                  ),
                },
              ] as { key: string; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setSelectedAmenities((prev) =>
                      prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]
                    )
                  }
                  className={`flex flex-col items-center gap-1.5 transition-all ${
                    selectedAmenities.includes(key)
                      ? "text-brand-orange scale-110"
                      : "text-white/55 hover:text-white/90"
                  }`}
                >
                  {icon}
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      }>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-52 shrink-0 hidden sm:block">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Search Radius</h3>
                <span className="text-brand-orange font-bold text-sm tabular-nums">{radiusKm} km</span>
              </div>
              <input
                type="range"
                min={MIN_RADIUS}
                max={MAX_RADIUS}
                step={1}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{MIN_RADIUS} km</span>
                <span>{MAX_RADIUS} km</span>
              </div>
            </div>
            <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
            <MemberOfferFilter selected={selectedMemberOffers} onChange={setSelectedMemberOffers} />
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <div className="sm:hidden mb-4">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Search Radius</h3>
                  <span className="text-brand-orange font-bold text-sm tabular-nums">{radiusKm} km</span>
                </div>
                <input
                  type="range"
                  min={MIN_RADIUS}
                  max={MAX_RADIUS}
                  step={1}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="w-full cursor-pointer accent-orange-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{MIN_RADIUS} km</span>
                  <span>{MAX_RADIUS} km</span>
                </div>
              </div>
              <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
              <MemberOfferFilter selected={selectedMemberOffers} onChange={setSelectedMemberOffers} />
            </div>

            {!hasSearched ? (
              <div className="text-center py-20 text-gray-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-14 h-14 mx-auto mb-4 text-gray-300">
                  <path d="M6 12h12" />
                  <path d="M3 9v6M6 9v6M18 9v6M21 9v6" />
                </svg>
                <p className="text-lg font-medium text-gray-500">Search by suburb, postcode or gym name</p>
                <p className="text-sm mt-2">Try <strong className="text-gray-600">Perth</strong>, <strong className="text-gray-600">6000</strong> or your gym name</p>
              </div>
            ) : loading ? (
              <div className="text-center py-20 text-gray-400">
                <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-brand-orange rounded-full animate-spin mb-4" />
                <p className="text-lg font-medium text-gray-500">Searching gyms...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-5xl mb-4">😕</p>
                <p className="text-lg font-medium text-gray-500">
                  No gyms found within {radiusKm} km of {searchLabel || postcode}
                </p>
                <p className="text-sm mt-2">Try increasing the search radius or removing amenity filters</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    {results.length} gym{results.length !== 1 ? "s" : ""} within {radiusKm} km of {searchLabel || postcode}
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
                {(() => {
                  const totalPages = pageSize === 0 ? 1 : Math.ceil(results.length / pageSize);
                  const safePage = Math.min(page, totalPages);
                  const start = pageSize === 0 ? 0 : (safePage - 1) * pageSize;
                  const paged = pageSize === 0 ? results : results.slice(start, start + pageSize);
                  return (
                    <>
                      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {paged.map((gym) => (
                          <GymCard key={gym.id} gym={gym} unclaimed={gym.ownerId === "owner-3" || gym.ownerId === "unclaimed"} />
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100 text-xs text-gray-500">
                        <span>Showing {start + 1}–{Math.min(start + paged.length, results.length)} of {results.length}</span>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="px-2 py-1 border border-gray-200 rounded disabled:opacity-30 hover:bg-gray-50">‹</button>
                            <span className="px-2">Page {safePage} of {totalPages}</span>
                            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="px-2 py-1 border border-gray-200 rounded disabled:opacity-30 hover:bg-gray-50">›</button>
                          </div>
                          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-orange">
                            <option value={25}>25 / page</option>
                            <option value={50}>50 / page</option>
                            <option value={100}>100 / page</option>
                            <option value={0}>All</option>
                          </select>
                        </div>
                      </div>
                    </>
                  );
                })()}
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
