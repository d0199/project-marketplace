/**
 * TEST PAGE — preview unified Gym + PT search with toggle.
 * Access at /test-hero — do NOT push to production.
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import SearchBar from "@/components/SearchBar";
import AmenityFilter from "@/components/AmenityFilter";
import MemberOfferFilter from "@/components/MemberOfferFilter";
import SpecialtyFilter from "@/components/SpecialtyFilter";
import GymCard from "@/components/GymCard";
import PTCard, { type PTWithDistance } from "@/components/PTCard";
import { POSTCODE_META, type GymWithDistance } from "@/lib/utils";

const DEFAULT_RADIUS = 10;
const MIN_RADIUS = 1;
const MAX_RADIUS = 50;

type SearchMode = "gyms" | "trainers";
type SortOption = "distance-asc" | "distance-desc" | "price-asc" | "price-desc";

// PT-specific specialty options for the sidebar
const PT_SPECIALTIES = [
  "Strength Training", "Weight Loss", "HIIT", "Boxing", "Yoga", "Pilates",
  "Rehabilitation", "Sports Performance", "Powerlifting", "CrossFit",
  "Functional Training", "Pre & Postnatal", "Nutrition", "MMA",
  "Athletic Conditioning", "Flexibility", "Mindfulness", "Competition Prep",
];

export default function TestHeroPage() {
  const router = useRouter();
  const [searchMode, setSearchMode] = useState<SearchMode>("gyms");
  const [postcode, setPostcode] = useState("");
  const [searchLabel, setSearchLabel] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedMemberOffers, setSelectedMemberOffers] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedPTSpecialties, setSelectedPTSpecialties] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS);
  const [sortBy, setSortBy] = useState<SortOption | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Gym cache
  const [gymCache, setGymCache] = useState<GymWithDistance[]>([]);
  const cachedGymPostcode = useRef("");

  // PT mock data (in production this would come from an API)
  const [ptCache, setPtCache] = useState<PTWithDistance[]>([]);
  const cachedPTPostcode = useRef("");

  useEffect(() => {
    const pc = router.query.postcode as string | undefined;
    if (pc) {
      setPostcode(pc);
      setHasSearched(true);
    }
  }, [router.query.postcode]);

  // Fetch gyms
  const fetchGyms = useCallback(async (pc: string) => {
    if (!pc || cachedGymPostcode.current === pc) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("postcode", pc);
      params.set("radius", String(MAX_RADIUS));
      const res = await fetch(`/api/gyms/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        setGymCache(data);
        cachedGymPostcode.current = pc;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch PTs (uses the pts/search API if available, else falls back to mock data)
  const fetchPTs = useCallback(async (pc: string) => {
    if (!pc || cachedPTPostcode.current === pc) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/pts/search?postcode=${pc}&radius=${MAX_RADIUS}`);
      if (res.ok) {
        const data = await res.json();
        setPtCache(data);
        cachedPTPostcode.current = pc;
      }
    } catch {
      // API not built yet — leave ptCache empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasSearched || !postcode) return;
    if (searchMode === "gyms") fetchGyms(postcode);
    else fetchPTs(postcode);
  }, [hasSearched, postcode, searchMode, fetchGyms, fetchPTs]);

  // Gym results (filtered)
  const gymResults = useMemo<GymWithDistance[]>(() => {
    if (searchMode !== "gyms" || !hasSearched || gymCache.length === 0) return [];
    let filtered = gymCache.filter((g) => (g.distanceKm ?? Infinity) <= radiusKm);
    if (selectedAmenities.length > 0) {
      filtered = filtered.filter((g) => selectedAmenities.every((a) => g.amenities.includes(a)));
    }
    if (selectedMemberOffers.length > 0) {
      filtered = filtered.filter((g) => g.isPaid && selectedMemberOffers.every((o) => (g.memberOffers ?? []).includes(o)));
    }
    if (selectedSpecialties.length > 0) {
      filtered = filtered.filter((g) => g.isPaid && selectedSpecialties.every((s) => (g.specialties ?? []).includes(s)));
    }
    if (!sortBy) return filtered;
    const sorted = [...filtered];
    const hasPublicPrice = (g: GymWithDistance) => g.priceVerified && g.pricePerWeek > 0;
    if (sortBy === "distance-asc") sorted.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    else if (sortBy === "distance-desc") sorted.sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0));
    else if (sortBy === "price-asc") sorted.sort((a, b) => {
      const aP = hasPublicPrice(a), bP = hasPublicPrice(b);
      if (aP && !bP) return -1; if (!aP && bP) return 1; if (!aP && !bP) return 0;
      return a.pricePerWeek - b.pricePerWeek;
    });
    else if (sortBy === "price-desc") sorted.sort((a, b) => {
      const aP = hasPublicPrice(a), bP = hasPublicPrice(b);
      if (aP && !bP) return -1; if (!aP && bP) return 1; if (!aP && !bP) return 0;
      return b.pricePerWeek - a.pricePerWeek;
    });
    return sorted;
  }, [gymCache, hasSearched, searchMode, radiusKm, selectedAmenities, selectedMemberOffers, selectedSpecialties, sortBy]);

  // PT results (filtered)
  const ptResults = useMemo<PTWithDistance[]>(() => {
    if (searchMode !== "trainers" || !hasSearched || ptCache.length === 0) return [];
    let filtered = ptCache.filter((p) => (p.distanceKm ?? Infinity) <= radiusKm);
    if (selectedPTSpecialties.length > 0) {
      filtered = filtered.filter((p) => selectedPTSpecialties.every((s) => p.specialties.includes(s)));
    }
    if (!sortBy) return filtered;
    const sorted = [...filtered];
    if (sortBy === "distance-asc") sorted.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    else if (sortBy === "distance-desc") sorted.sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0));
    else if (sortBy === "price-asc") sorted.sort((a, b) => (a.pricePerSession ?? Infinity) - (b.pricePerSession ?? Infinity));
    else if (sortBy === "price-desc") sorted.sort((a, b) => (b.pricePerSession ?? 0) - (a.pricePerSession ?? 0));
    return sorted;
  }, [ptCache, hasSearched, searchMode, radiusKm, selectedPTSpecialties, sortBy]);

  const results = searchMode === "gyms" ? gymResults : ptResults;

  // Reset page when filters / mode changes
  useEffect(() => { setPage(1); }, [selectedAmenities, selectedMemberOffers, selectedSpecialties, selectedPTSpecialties, radiusKm, sortBy, searchMode]);

  function handleSearch(pc: string, label?: string) {
    setPostcode(pc);
    setSearchLabel(label || pc);
    setHasSearched(true);
    setPageSize(25);
    setPage(1);
  }

  function handleModeSwitch(mode: SearchMode) {
    setSearchMode(mode);
    setSortBy(null);
    setPage(1);
    // Trigger fetch for the new mode if we already have a postcode
    if (hasSearched && postcode) {
      if (mode === "gyms") fetchGyms(postcode);
      else fetchPTs(postcode);
    }
  }

  // Quick-filter icons for hero (gym mode)
  const gymHeroIcons = [
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
  ];

  // Quick-filter chips for hero (PT mode)
  const ptHeroSpecialties = [
    "Strength Training", "Weight Loss", "Boxing", "Yoga", "HIIT", "Pilates", "Rehab", "Sports Performance",
  ];

  return (
    <>
      <Head>
        <title>TEST — Gym + PT Search | mynextgym.com.au</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Layout hero={
        <div className="relative" style={{ height: 480 }}>
          <div className="absolute inset-0 overflow-hidden">
            <Image src="/stock/Hero.jpg" alt="" fill className="object-cover" priority sizes="100vw" />
            <div className="absolute inset-0 bg-black/60" />
          </div>
          <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-3 drop-shadow-lg">
              {searchMode === "gyms" ? "Your Next Move Starts Here." : "Find Your Perfect Trainer."}
            </h1>
            <p className="text-white/75 text-lg mb-5">
              {searchMode === "gyms"
                ? "Discover thousands of premium gyms, studios and clubs across Australia"
                : "Connect with certified personal trainers near you"}
            </p>

            {/* ── Search mode toggle ── */}
            <div className="flex items-center bg-white/10 backdrop-blur-sm rounded-full p-1 mb-5 border border-white/20">
              <button
                type="button"
                onClick={() => handleModeSwitch("gyms")}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  searchMode === "gyms"
                    ? "bg-brand-orange text-white shadow-md"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                  <path d="M6 12h12" strokeLinecap="round" />
                  <path d="M3 9v6M6 9v6M18 9v6M21 9v6" strokeLinecap="round" />
                </svg>
                Gyms
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch("trainers")}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  searchMode === "trainers"
                    ? "bg-brand-orange text-white shadow-md"
                    : "text-white/70 hover:text-white"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-4 h-4">
                  <circle cx="12" cy="7" r="3" />
                  <path d="M5 21v-2a5 5 0 0110 0v2" strokeLinecap="round" />
                  <path d="M17 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Personal Trainers
              </button>
            </div>

            {/* ── Search bar ── */}
            <div className="w-full max-w-2xl">
              <SearchBar
                onSearch={handleSearch}
                initialValue={postcode}
              />
            </div>

            {/* ── Quick filters: icons for gyms, chips for PTs ── */}
            {searchMode === "gyms" ? (
              <div className="flex items-end justify-evenly w-full max-w-2xl mt-6">
                {gymHeroIcons.map(({ key, label, icon }) => (
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
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 w-full max-w-2xl">
                {ptHeroSpecialties.map((s) => {
                  const active = selectedPTSpecialties.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setSelectedPTSpecialties((prev) =>
                          active ? prev.filter((x) => x !== s) : [...prev, s]
                        )
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        active
                          ? "bg-brand-orange border-brand-orange text-white scale-105"
                          : "bg-white/10 border-white/25 text-white/70 hover:bg-white/20 hover:text-white hover:border-white/40"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      }>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-52 shrink-0 hidden sm:block">
            {/* Radius — shared */}
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

            {/* Gym-specific filters */}
            {searchMode === "gyms" && (
              <>
                <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
                <MemberOfferFilter selected={selectedMemberOffers} onChange={setSelectedMemberOffers} />
                <SpecialtyFilter selected={selectedSpecialties} onChange={setSelectedSpecialties} />
              </>
            )}

            {/* PT-specific filters */}
            {searchMode === "trainers" && (
              <>
                {/* PT Specialties filter */}
                <aside className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mt-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide">Specialties</h3>
                    {selectedPTSpecialties.length > 0 && (
                      <button onClick={() => setSelectedPTSpecialties([])} className="text-xs text-brand-orange hover:underline">Clear</button>
                    )}
                  </div>
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {PT_SPECIALTIES.map((s) => {
                      const checked = selectedPTSpecialties.includes(s);
                      return (
                        <li key={s}>
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setSelectedPTSpecialties((prev) =>
                                checked ? prev.filter((x) => x !== s) : [...prev, s]
                              )}
                              className="w-4 h-4 rounded accent-brand-orange"
                            />
                            <span className="text-sm text-gray-700 group-hover:text-gray-900">{s}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </aside>

                {/* Gender filter */}
                <aside className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mt-3">
                  <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-3">Gender</h3>
                  <ul className="space-y-2">
                    {["Any", "Male", "Female"].map((g) => (
                      <li key={g}>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="pt-gender"
                            defaultChecked={g === "Any"}
                            className="w-4 h-4 accent-brand-orange"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">{g}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </aside>

                {/* Price range filter */}
                <aside className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mt-3">
                  <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-3">Session Price</h3>
                  <ul className="space-y-2">
                    {["Any price", "Under $80", "$80–$100", "$100–$120", "$120+"].map((r) => (
                      <li key={r}>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="pt-price"
                            defaultChecked={r === "Any price"}
                            className="w-4 h-4 accent-brand-orange"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-gray-900">{r}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </aside>
              </>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {/* Mobile filters */}
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
              </div>
              {searchMode === "gyms" && (
                <>
                  <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
                  <MemberOfferFilter selected={selectedMemberOffers} onChange={setSelectedMemberOffers} />
                  <SpecialtyFilter selected={selectedSpecialties} onChange={setSelectedSpecialties} />
                </>
              )}
            </div>

            {!hasSearched ? (
              <div className="text-center py-20 text-gray-400">
                {searchMode === "gyms" ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-14 h-14 mx-auto mb-4 text-gray-300">
                      <path d="M6 12h12" />
                      <path d="M3 9v6M6 9v6M18 9v6M21 9v6" />
                    </svg>
                    <p className="text-lg font-medium text-gray-500">Search by suburb, postcode or gym name</p>
                    <p className="text-sm mt-2">Try <strong className="text-gray-600">Perth</strong>, <strong className="text-gray-600">6000</strong> or your gym name</p>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-14 h-14 mx-auto mb-4 text-gray-300">
                      <circle cx="12" cy="7" r="3" />
                      <path d="M5 21v-2a5 5 0 0110 0v2" />
                      <path d="M17 11l2 2 4-4" strokeLinejoin="round" />
                    </svg>
                    <p className="text-lg font-medium text-gray-500">Search for personal trainers near you</p>
                    <p className="text-sm mt-2">Enter your suburb or postcode to find trainers</p>
                  </>
                )}
              </div>
            ) : loading ? (
              <div className="text-center py-20 text-gray-400">
                <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-brand-orange rounded-full animate-spin mb-4" />
                <p className="text-lg font-medium text-gray-500">
                  Searching {searchMode === "gyms" ? "gyms" : "trainers"}...
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                </div>
                <p className="text-lg font-medium text-gray-500">
                  No {searchMode === "gyms" ? "gyms" : "trainers"} found within {radiusKm} km of {searchLabel || postcode}
                </p>
                <p className="text-sm mt-2">Try increasing the search radius or removing filters</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    {results.length} {searchMode === "gyms" ? "gym" : "trainer"}{results.length !== 1 ? "s" : ""} within {radiusKm} km of {searchLabel || postcode}
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
                        {searchMode === "gyms"
                          ? (paged as GymWithDistance[]).map((gym) => (
                              <GymCard key={gym.id} gym={gym} unclaimed={gym.ownerId === "owner-3" || gym.ownerId === "unclaimed"} />
                            ))
                          : (paged as PTWithDistance[]).map((pt) => (
                              <PTCard key={pt.id} pt={pt} />
                            ))
                        }
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

        {/* Browse by suburb */}
        {!hasSearched && (
          <div className="mt-12 border-t pt-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-6">
              Browse {searchMode === "gyms" ? "gyms" : "trainers"} by suburb
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
                            {searchMode === "gyms" ? "Gyms" : "Trainers"} in {meta.name}
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
