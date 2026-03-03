import { useState, useMemo } from "react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Layout from "@/components/Layout";
import SearchBar from "@/components/SearchBar";
import AmenityFilter from "@/components/AmenityFilter";
import GymCard from "@/components/GymCard";
import { filterGyms, type GymWithDistance } from "@/lib/utils";
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
  const [hasSearched, setHasSearched] = useState(false);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS);

  const results: GymWithDistance[] = useMemo(() => {
    if (!hasSearched) return [];
    return filterGyms(gyms, {
      postcode: postcode || undefined,
      amenities: selectedAmenities,
      radiusKm,
    });
  }, [gyms, postcode, selectedAmenities, hasSearched, radiusKm]);

  function handleSearch(pc: string) {
    setPostcode(pc);
    setHasSearched(true);
  }

  return (
    <>
      <Head>
        <title>mynextgym.com.au — Find Gyms in Australia</title>
        <meta name="description" content="Discover and compare gyms near you across Australia." />
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
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0">
            <div className="sm:hidden mb-4">
              <AmenityFilter selected={selectedAmenities} onChange={setSelectedAmenities} />
            </div>

            {!hasSearched ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-5xl mb-4">🏋️</p>
                <p className="text-lg font-medium text-gray-500">Enter a postcode above to find gyms near you</p>
                <p className="text-sm mt-2">Try <strong>6028</strong> to explore Kinross / Joondalup</p>
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
                <p className="text-sm text-gray-500 mb-4">
                  {results.length} gym{results.length !== 1 ? "s" : ""} within {radiusKm} km of {postcode}
                </p>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((gym) => (
                    <GymCard key={gym.id} gym={gym} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </Layout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  return { props: { gyms: ownerStore.getAll() } };
};
