import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import SearchBar from "@/components/SearchBar";
import PTCard, { type PTWithDistance } from "@/components/PTCard";
import {
  POSTCODE_COORDS,
  POSTCODE_META,
  haversineKm,
} from "@/lib/utils";
import { ptStore } from "@/lib/ptStore";
import { BASE_URL } from "@/lib/siteUrl";

interface Props {
  postcode: string;
  suburbName: string;
  slug: string;
  ptCount: number;
}

export default function TrainerSuburbPage({ postcode, suburbName, slug, ptCount }: Props) {
  const router = useRouter();
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [cache, setCache] = useState<PTWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  const fetchPTs = useCallback(async () => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/pts/search?postcode=${postcode}&radius=10`);
      if (res.ok) {
        setCache(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [postcode]);

  useEffect(() => { fetchPTs(); }, [fetchPTs]);

  function handleSearch(pc: string) {
    const meta = POSTCODE_META[pc];
    if (meta) {
      router.push(`/trainers/${meta.slug}`);
    } else {
      router.push(`/?postcode=${pc}`);
    }
  }

  const results = useMemo(() => {
    let filtered = cache;
    if (selectedSpecialties.length > 0) {
      filtered = filtered.filter((p) =>
        selectedSpecialties.every((s) => p.specialties.includes(s))
      );
    }
    return filtered;
  }, [cache, selectedSpecialties]);

  useEffect(() => { setPage(1); }, [selectedSpecialties]);

  const activeFilters = selectedSpecialties.length;
  const count = ptCount;

  const totalPages = pageSize === 0 ? 1 : Math.ceil(results.length / pageSize);
  const safePage = Math.min(page, totalPages || 1);
  const start = pageSize === 0 ? 0 : (safePage - 1) * pageSize;
  const paged = pageSize === 0 ? results : results.slice(start, start + pageSize);

  const title = `Personal Trainers in ${suburbName} (${postcode}) | mynextgym.com.au`;
  const description =
    count > 0
      ? `Find ${count} personal trainer${count !== 1 ? "s" : ""} near ${suburbName}, ${postcode}. Compare specialties, pricing and experience.`
      : `Looking for personal trainers near ${suburbName}, ${postcode}? Browse trainers in surrounding suburbs.`;

  // PT hero icons — matching homepage style
  const ptHeroIcons = [
    {
      key: "Weight Loss", label: "weight loss",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
          <path d="M12 3v18M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 13a7 7 0 0014 0" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "Strength Training", label: "strength",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
          <path d="M6 12h12" strokeLinecap="round" />
          <path d="M3 9v6M6 9v6M18 9v6M21 9v6" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "Boxing", label: "boxing",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
          <path d="M18 11V8a4 4 0 00-4-4H9a4 4 0 00-4 4v5a4 4 0 004 4h1l2 3 2-3h1a4 4 0 004-4v-2z" strokeLinejoin="round" />
          <path d="M9 9h0M14 9h0" strokeLinecap="round" strokeWidth="2" />
        </svg>
      ),
    },
    {
      key: "HIIT", label: "HIIT",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: "Yoga", label: "yoga",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
          <circle cx="12" cy="5" r="2" />
          <path d="M12 9v5M8 21l4-7 4 7" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 13l6 1 6-1" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "Rehab", label: "rehab",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
          <path d="M9 12h6M12 9v6" strokeLinecap="round" />
          <path d="M19.07 4.93a10 10 0 010 14.14M4.93 19.07a10 10 0 010-14.14" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {ptCount === 0 && <meta name="robots" content="noindex, follow" />}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={`${BASE_URL}/trainers/${slug}`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
              { "@type": "ListItem", position: 2, name: "Personal Trainers", item: `${BASE_URL}/` },
              { "@type": "ListItem", position: 3, name: `Trainers in ${suburbName}`, item: `${BASE_URL}/trainers/${slug}` },
            ],
          }) }}
        />
      </Head>
      <Layout>
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-5" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-brand-orange">Home</Link>
          {" / "}
          <span className="text-gray-800">Personal trainers in {suburbName}</span>
        </nav>

        {/* Hero */}
        <div className="relative rounded-2xl mb-8" style={{ height: 340 }}>
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            <Image src="/stock/Hero.jpg" alt="" fill className="object-cover" priority sizes="100vw" />
            <div className="absolute inset-0 bg-black/60" />
          </div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-2 drop-shadow-lg">
              Personal Trainers in {suburbName}
            </h1>
            <p className="text-white/75 mb-6">
              {count > 0
                ? `${count} trainer${count !== 1 ? "s" : ""} within 10 km of ${postcode}`
                : `No trainers found within 10 km of ${suburbName}`}
            </p>
            <div className="w-full max-w-xl">
              <SearchBar onSearch={handleSearch} />
            </div>
            <div className="flex items-end justify-evenly w-full max-w-2xl mt-6">
              {ptHeroIcons.map(({ key, label, icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setSelectedSpecialties((prev) =>
                      prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]
                    )
                  }
                  className={`flex flex-col items-center gap-1.5 transition-all ${
                    selectedSpecialties.includes(key)
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
            <p className="text-lg font-medium text-gray-700 mb-2">
              No personal trainers found within 10 km of {suburbName} ({postcode})
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
            <p className="text-lg font-medium text-gray-500">Loading trainers...</p>
          </div>
        ) : (
          <div>
            {/* Results bar */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {results.length}{" "}
                {results.length !== cache.length
                  ? `of ${cache.length} trainer${cache.length !== 1 ? "s" : ""} match your filters`
                  : `trainer${cache.length !== 1 ? "s" : ""} within 10 km`}
                {activeFilters > 0 && (
                  <button
                    onClick={() => setSelectedSpecialties([])}
                    className="ml-2 text-brand-orange hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </p>
            </div>

            {results.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-lg font-medium text-gray-500 mb-2">No trainers match your filters</p>
                <button
                  onClick={() => setSelectedSpecialties([])}
                  className="text-sm text-brand-orange hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {paged.map((pt) => (
                    <PTCard key={pt.id} pt={pt} />
                  ))}
                </div>
                <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100 text-xs text-gray-500">
                  <span>Showing {start + 1}–{Math.min(start + paged.length, results.length)} of {results.length}</span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1} className="px-2 py-1 border border-gray-200 rounded disabled:opacity-30 hover:bg-gray-50">&lsaquo;</button>
                      <span className="px-2">Page {safePage} of {totalPages}</span>
                      <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} className="px-2 py-1 border border-gray-200 rounded disabled:opacity-30 hover:bg-gray-50">&rsaquo;</button>
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
        )}

        {/* Browse other suburbs */}
        <div className="border-t pt-8 mt-12">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Browse trainers in other suburbs</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-2">
            {Object.entries(POSTCODE_META)
              .filter(([pc]) => pc !== postcode)
              .map(([pc, meta]) => (
                <Link
                  key={pc}
                  href={`/trainers/${meta.slug}`}
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
  const UPPER_WORDS = new Set(["cbd", "wa", "nsw", "vic", "qld", "sa", "tas", "nt", "act"]);
  const suburbFromSlug =
    match?.[1]
      ?.split("-")
      .map((w) => UPPER_WORDS.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") ?? "";

  if (!postcode || !POSTCODE_COORDS[postcode]) {
    return { notFound: true };
  }

  const suburbName = POSTCODE_META[postcode]?.name ?? suburbFromSlug;

  const allPTs = await ptStore.getAll();
  const activePTs = allPTs.filter((p) => p.isActive !== false && !p.isTest);
  const origin = POSTCODE_COORDS[postcode];
  const ptCount = activePTs.filter(
    (p) => haversineKm(origin[0], origin[1], p.lat, p.lng) <= 10
  ).length;

  return { props: { postcode, suburbName, slug, ptCount } };
};
