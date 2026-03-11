import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import SearchBar from "@/components/SearchBar";
import GymCard from "@/components/GymCard";
import AmenityFilter from "@/components/AmenityFilter";
import MemberOfferFilter from "@/components/MemberOfferFilter";
import SpecialtyFilter from "@/components/SpecialtyFilter";
import {
  POSTCODE_COORDS,
  POSTCODE_META,
  type GymWithDistance,
} from "@/lib/utils";
import { ownerStore } from "@/lib/ownerStore";
import { filterGyms } from "@/lib/utils";
import { BASE_URL } from "@/lib/siteUrl";

type SortOption = "distance-asc" | "distance-desc" | "price-asc" | "price-desc";

interface Props {
  postcode: string;
  suburbName: string;
  slug: string;
  gymCount: number;
}

export default function SuburbPage({ postcode, suburbName, slug, gymCount }: Props) {
  const router = useRouter();
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedMemberOffers, setSelectedMemberOffers] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  // Client-side data fetching
  const [cache, setCache] = useState<GymWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  const fetchGyms = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/gyms/search?postcode=${postcode}&radius=10`);
      if (res.ok) {
        setCache(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [postcode]);

  useEffect(() => { fetchGyms(); }, [fetchGyms]);

  function handleSearch(pc: string) {
    const meta = POSTCODE_META[pc];
    if (meta) {
      router.push(`/gyms/${meta.slug}`);
    } else {
      router.push(`/?postcode=${pc}`);
    }
  }

  // Client-side filter + sort
  const results = useMemo(() => {
    let filtered = cache;

    if (selectedAmenities.length > 0) {
      filtered = filtered.filter((g) =>
        selectedAmenities.every((a) => g.amenities.includes(a))
      );
    }

    if (selectedMemberOffers.length > 0) {
      filtered = filtered.filter((g) =>
        g.isPaid &&
        selectedMemberOffers.every((o) => (g.memberOffers ?? []).includes(o))
      );
    }

    if (selectedSpecialties.length > 0) {
      filtered = filtered.filter((g) =>
        g.isPaid &&
        selectedSpecialties.every((s) => (g.specialties ?? []).includes(s))
      );
    }

    if (!sortBy) return filtered;

    const sorted = [...filtered];
    const hasPublicPrice = (g: GymWithDistance) => g.priceVerified && g.pricePerWeek > 0;
    if (sortBy === "distance-asc")
      sorted.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    else if (sortBy === "distance-desc")
      sorted.sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0));
    else if (sortBy === "price-asc")
      sorted.sort((a, b) => {
        const aP = hasPublicPrice(a), bP = hasPublicPrice(b);
        if (aP && !bP) return -1;
        if (!aP && bP) return 1;
        if (!aP && !bP) return 0;
        return a.pricePerWeek - b.pricePerWeek;
      });
    else if (sortBy === "price-desc")
      sorted.sort((a, b) => {
        const aP = hasPublicPrice(a), bP = hasPublicPrice(b);
        if (aP && !bP) return -1;
        if (!aP && bP) return 1;
        if (!aP && !bP) return 0;
        return b.pricePerWeek - a.pricePerWeek;
      });
    return sorted;
  }, [cache, selectedAmenities, selectedMemberOffers, selectedSpecialties, sortBy]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [selectedAmenities, selectedMemberOffers, selectedSpecialties, sortBy]);

  const activeFilters = selectedAmenities.length + selectedMemberOffers.length + selectedSpecialties.length;
  const count = gymCount;

  // Pagination
  const totalPages = pageSize === 0 ? 1 : Math.ceil(results.length / pageSize);
  const safePage = Math.min(page, totalPages || 1);
  const start = pageSize === 0 ? 0 : (safePage - 1) * pageSize;
  const paged = pageSize === 0 ? results : results.slice(start, start + pageSize);

  const title = `Gyms in ${suburbName} (${postcode}) | mynextgym.com.au`;
  const description =
    count > 0
      ? `Find ${count} gym${count !== 1 ? "s" : ""} near ${suburbName}, ${postcode}. Compare prices, amenities and opening hours.`
      : `Looking for gyms near ${suburbName}, ${postcode}? Browse gyms in surrounding suburbs.`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {gymCount === 0 && <meta name="robots" content="noindex, follow" />}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={`${BASE_URL}/gyms/${slug}`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
              { "@type": "ListItem", position: 2, name: "Gyms", item: `${BASE_URL}/` },
              { "@type": "ListItem", position: 3, name: `Gyms in ${suburbName}`, item: `${BASE_URL}/gyms/${slug}` },
            ],
          }) }}
        />
      </Head>
      <Layout>
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-5" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-brand-orange">Home</Link>
          {" / "}
          <span className="text-gray-800">Gyms in {suburbName}</span>
        </nav>

        {/* Hero */}
        <div className="relative rounded-2xl mb-8" style={{ height: 340 }}>
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            <Image src="/stock/Hero.jpg" alt="" fill className="object-cover" priority sizes="100vw" />
            <div className="absolute inset-0 bg-black/60" />
          </div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-2 drop-shadow-lg">
              Gyms in {suburbName}
            </h1>
            <p className="text-white/75 mb-6">
              {count > 0
                ? `${count} gym${count !== 1 ? "s" : ""} within 10 km of ${postcode}`
                : `No gyms found within 10 km of ${suburbName}`}
            </p>
            <div className="w-full max-w-xl">
              <SearchBar
                onSearch={handleSearch}
              />
            </div>
            <div className="flex items-end justify-evenly w-full max-w-2xl mt-6">
              {([
                {
                  key: "pool", label: "pool",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
                      <path d="M2 18c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3-2 4.5 0" strokeLinecap="round" />
                      <circle cx="16" cy="7" r="2" />
                      <path d="M4 13l4-5 3 3 2.5-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  key: "spa", label: "spa",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
                      <path d="M12 3C9 7 6 9 6 13a6 6 0 0012 0c0-4-3-6-6-10z" strokeLinejoin="round" />
                      <path d="M12 19v3M9 22h6" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  key: "sauna", label: "sauna",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
                      <path d="M8 2c0 2.5-2 3.5-2 6M12 2c0 2.5-2 3.5-2 6M16 2c0 2.5-2 3.5-2 6" strokeLinecap="round" />
                      <rect x="3" y="12" width="18" height="9" rx="2" />
                      <path d="M7 17h10" strokeLinecap="round" />
                    </svg>
                  ),
                },
                {
                  key: "24/7 access", label: "24/7",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  key: "personal training", label: "PT",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
                      <circle cx="12" cy="5" r="2" />
                      <path d="M12 9v6M9 12h6" strokeLinecap="round" />
                      <path d="M6 8l2 2M18 8l-2 2M8 19l2-4M16 19l-2-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                },
                {
                  key: "childcare", label: "crèche",
                  icon: (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
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

        {count === 0 ? (
          <div className="text-center py-12 mb-12 bg-gray-50 rounded-xl">
            <p className="text-5xl mb-4">😕</p>
            <p className="text-lg font-medium text-gray-700 mb-2">
              No gyms found within 10 km of {suburbName} ({postcode})
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Try searching a nearby suburb or browse all locations below
            </p>
            <Link
              href="/"
              className="inline-block px-5 py-2 bg-brand-orange text-white text-sm font-semibold rounded-lg hover:bg-brand-orange-dark transition-colors"
            >
              Search all suburbs
            </Link>
          </div>
        ) : loading ? (
          <div className="text-center py-20 text-gray-400">
            <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-brand-orange rounded-full animate-spin mb-4" />
            <p className="text-lg font-medium text-gray-500">Loading gyms...</p>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Sidebar filters */}
            <div className="w-52 shrink-0 hidden sm:block">
              <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
              <MemberOfferFilter selected={selectedMemberOffers} onChange={setSelectedMemberOffers} />
              <SpecialtyFilter selected={selectedSpecialties} onChange={setSelectedSpecialties} />
            </div>

            {/* Results */}
            <div className="flex-1 min-w-0">
              {/* Mobile filters */}
              <div className="sm:hidden mb-4">
                <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
                <MemberOfferFilter selected={selectedMemberOffers} onChange={setSelectedMemberOffers} />
                <SpecialtyFilter selected={selectedSpecialties} onChange={setSelectedSpecialties} />
              </div>

              {/* Results bar */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                  {results.length}{" "}
                  {results.length !== cache.length
                    ? `of ${cache.length} gym${cache.length !== 1 ? "s" : ""} match your filters`
                    : `gym${cache.length !== 1 ? "s" : ""} within 10 km`}
                  {activeFilters > 0 && (
                    <button
                      onClick={() => { setSelectedAmenities([]); setSelectedMemberOffers([]); setSelectedSpecialties([]); }}
                      className="ml-2 text-brand-orange hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </p>
                <select
                  value={sortBy ?? ""}
                  onChange={(e) => setSortBy((e.target.value || null) as SortOption | null)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-orange"
                >
                  <option value="">Sort by</option>
                  <option value="distance-asc">Distance: Nearest first</option>
                  <option value="distance-desc">Distance: Farthest first</option>
                  <option value="price-asc">Price: Low to high</option>
                  <option value="price-desc">Price: High to low</option>
                </select>
              </div>

              {results.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p className="text-lg font-medium text-gray-500 mb-2">No gyms match your filters</p>
                  <button
                    onClick={() => { setSelectedAmenities([]); setSelectedMemberOffers([]); setSelectedSpecialties([]); }}
                    className="text-sm text-brand-orange hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {paged.map((gym) => (
                      <GymCard
                        key={gym.id}
                        gym={gym}
                        unclaimed={gym.ownerId === "owner-3" || gym.ownerId === "unclaimed"}
                      />
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
                      <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                        className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-orange"
                      >
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                        <option value={0}>All</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Browse other suburbs */}
        <div className="border-t pt-8 mt-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Browse gyms in other suburbs</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-2">
            {Object.entries(POSTCODE_META)
              .filter(([pc]) => pc !== postcode)
              .map(([pc, meta]) => (
                <Link
                  key={pc}
                  href={`/gyms/${meta.slug}`}
                  className="text-sm text-brand-orange hover:underline py-0.5"
                >
                  {meta.name}
                </Link>
              ))}
          </div>
        </div>
      </Layout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const slug = params?.suburb as string;

  const match = slug?.match(/^(.*?)-?(\d{4})$/);
  const postcode = match?.[2];
  const suburbFromSlug =
    match?.[1]
      ?.split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") ?? "";

  if (!postcode || !POSTCODE_COORDS[postcode]) {
    return { notFound: true };
  }

  const suburbName = POSTCODE_META[postcode]?.name ?? suburbFromSlug;

  // Only compute the count for SEO — gym data is fetched client-side
  const allGyms = await ownerStore.getAll();
  const activeGyms = allGyms.filter((g) => g.isActive !== false && !g.isTest);
  const gymCount = filterGyms(activeGyms, { postcode, amenities: [], radiusKm: 10 }).length;

  return { props: { postcode, suburbName, slug, gymCount } };
};
