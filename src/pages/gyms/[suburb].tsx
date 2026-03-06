import { useState, useMemo } from "react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";
import GymCard from "@/components/GymCard";
import AmenityFilter from "@/components/AmenityFilter";
import MemberOfferFilter from "@/components/MemberOfferFilter";
import {
  POSTCODE_COORDS,
  POSTCODE_META,
  filterGyms,
  type GymWithDistance,
} from "@/lib/utils";
import { ownerStore } from "@/lib/ownerStore";

type SortOption = "distance-asc" | "distance-desc" | "price-asc" | "price-desc";

interface Props {
  postcode: string;
  suburbName: string;
  slug: string;
  gyms: GymWithDistance[];
}

export default function SuburbPage({ postcode, suburbName, slug, gyms }: Props) {
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedMemberOffers, setSelectedMemberOffers] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption | null>(null);

  // Client-side filter + sort on top of the server-pre-filtered set
  const results = useMemo(() => {
    let filtered = gyms;

    if (selectedAmenities.length > 0) {
      filtered = filtered.filter((g) =>
        selectedAmenities.every((a) => g.amenities.includes(a))
      );
    }

    if (selectedMemberOffers.length > 0) {
      filtered = filtered.filter((g) =>
        selectedMemberOffers.every((o) => g.memberOffers?.includes(o))
      );
    }

    if (!sortBy) return filtered;

    const sorted = [...filtered];
    if (sortBy === "distance-asc")
      sorted.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    else if (sortBy === "distance-desc")
      sorted.sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0));
    else if (sortBy === "price-asc")
      sorted.sort((a, b) => a.pricePerWeek - b.pricePerWeek);
    else if (sortBy === "price-desc")
      sorted.sort((a, b) => b.pricePerWeek - a.pricePerWeek);
    return sorted;
  }, [gyms, selectedAmenities, selectedMemberOffers, sortBy]);

  const activeFilters = selectedAmenities.length + selectedMemberOffers.length;

  const count = gyms.length;
  const title = `Gyms in ${suburbName} (${postcode}) | mynextgym.com.au`;
  const description =
    count > 0
      ? `Find ${count} gym${count !== 1 ? "s" : ""} near ${suburbName}, ${postcode} WA. Compare prices, amenities and opening hours.`
      : `Looking for gyms near ${suburbName}, ${postcode} WA? Browse gyms in surrounding Perth suburbs.`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <link
          rel="canonical"
          href={`https://www.mynextgym.com.au/gyms/${slug}`}
        />
      </Head>
      <Layout>
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-5">
          <Link href="/" className="hover:text-brand-orange">
            Home
          </Link>
          {" / "}
          <span className="text-gray-800">Gyms in {suburbName}</span>
        </nav>

        {/* Hero */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">
            Gyms in {suburbName}, {postcode}
          </h1>
          <p className="text-gray-500">
            {count > 0
              ? `${count} gym${count !== 1 ? "s" : ""} within 10 km of ${suburbName}`
              : `No gyms listed near ${suburbName} yet`}
          </p>
        </div>

        {/* CTA — search a different suburb */}
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-8">
          <span className="text-sm text-gray-600">
            Searching in <span className="font-semibold text-gray-900">{suburbName}</span>
          </span>
          <span className="text-gray-300">·</span>
          <Link
            href="/"
            className="text-sm font-semibold text-brand-orange hover:text-brand-orange-dark transition-colors"
          >
            Search a different suburb →
          </Link>
        </div>

        {count === 0 ? (
          <div className="text-center py-12 mb-12 bg-gray-50 rounded-xl">
            <p className="text-gray-500 mb-4">No gyms listed for this area yet.</p>
            <Link
              href="/"
              className="inline-block px-5 py-2 bg-brand-orange text-white text-sm font-semibold rounded-lg hover:bg-brand-orange-dark transition-colors"
            >
              Search all suburbs
            </Link>
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Sidebar filters */}
            <div className="w-52 shrink-0 hidden sm:block">
              <AmenityFilter
                selected={selectedAmenities}
                onChange={setSelectedAmenities}
              />
              <MemberOfferFilter
                selected={selectedMemberOffers}
                onChange={setSelectedMemberOffers}
              />
            </div>

            {/* Results */}
            <div className="flex-1 min-w-0">
              {/* Mobile filters */}
              <div className="sm:hidden mb-4">
                <AmenityFilter
                  selected={selectedAmenities}
                  onChange={setSelectedAmenities}
                />
                <MemberOfferFilter
                  selected={selectedMemberOffers}
                  onChange={setSelectedMemberOffers}
                />
              </div>

              {/* Results bar */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-500">
                  {results.length}{" "}
                  {results.length !== count
                    ? `of ${count} gym${count !== 1 ? "s" : ""} match your filters`
                    : `gym${count !== 1 ? "s" : ""} within 10 km`}
                  {activeFilters > 0 && (
                    <button
                      onClick={() => {
                        setSelectedAmenities([]);
                        setSelectedMemberOffers([]);
                      }}
                      className="ml-2 text-brand-orange hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </p>
                <select
                  value={sortBy ?? ""}
                  onChange={(e) =>
                    setSortBy((e.target.value || null) as SortOption | null)
                  }
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
                  <p className="text-lg font-medium text-gray-500 mb-2">
                    No gyms match your filters
                  </p>
                  <button
                    onClick={() => {
                      setSelectedAmenities([]);
                      setSelectedMemberOffers([]);
                    }}
                    className="text-sm text-brand-orange hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((gym) => (
                    <GymCard
                      key={gym.id}
                      gym={gym}
                      unclaimed={gym.ownerId === "owner-3" || gym.ownerId === "unclaimed"}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Browse other suburbs */}
        <div className="border-t pt-8 mt-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Browse gyms in other Perth suburbs
          </h2>
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

export const getServerSideProps: GetServerSideProps<Props> = async ({
  params,
}) => {
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

  const allGyms = await ownerStore.getAll();
  const gyms = filterGyms(allGyms, { postcode, amenities: [], radiusKm: 10 });

  return {
    props: {
      postcode,
      suburbName,
      slug,
      gyms,
    },
  };
};
