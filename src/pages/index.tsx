import { useState, useMemo } from "react";
import Head from "next/head";
import Layout from "@/components/Layout";
import SearchBar from "@/components/SearchBar";
import AmenityFilter from "@/components/AmenityFilter";
import GymCard from "@/components/GymCard";
import { filterGyms, type GymWithDistance } from "@/lib/utils";
import type { Gym } from "@/types";
import gymsData from "../../data/gyms.json";

const ALL_GYMS = gymsData as Gym[];

export default function HomePage() {
  const [postcode, setPostcode] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const results: GymWithDistance[] = useMemo(() => {
    if (!hasSearched && selectedAmenities.length === 0) return [];
    return filterGyms(ALL_GYMS, {
      postcode: postcode || undefined,
      amenities: selectedAmenities,
    });
  }, [postcode, selectedAmenities, hasSearched]);

  function handleSearch(pc: string) {
    setPostcode(pc);
    setHasSearched(true);
  }

  function handleAmenityChange(amenities: string[]) {
    setSelectedAmenities(amenities);
    if (!hasSearched && amenities.length > 0) setHasSearched(true);
  }

  return (
    <>
      <Head>
        <title>mynextgym.com.au — Find Gyms in Australia</title>
        <meta
          name="description"
          content="Discover and compare gyms near you across Australia."
        />
      </Head>
      <Layout>
        {/* Hero */}
        <div className="bg-gradient-to-r from-brand-orange to-brand-orange-dark rounded-2xl px-8 py-12 mb-8 text-white">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Find your perfect gym
          </h1>
          <p className="text-orange-100 mb-6 text-lg">
            Search hundreds of gyms across Australia by postcode and amenities.
          </p>
          <SearchBar onSearch={handleSearch} initialValue={postcode} />
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-52 shrink-0 hidden sm:block">
            <AmenityFilter
              selected={selectedAmenities}
              onChange={handleAmenityChange}
            />
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {/* Mobile filter toggle (shown inline on small screens) */}
            <div className="sm:hidden mb-4">
              <AmenityFilter
                selected={selectedAmenities}
                onChange={handleAmenityChange}
              />
            </div>

            {!hasSearched && selectedAmenities.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-5xl mb-4">🏋️</p>
                <p className="text-lg font-medium text-gray-500">
                  Enter a postcode above to find gyms near you
                </p>
                <p className="text-sm mt-2">
                  Try <strong>6028</strong> to explore Kinross / Joondalup
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-5xl mb-4">😕</p>
                <p className="text-lg font-medium text-gray-500">
                  No gyms match your filters
                </p>
                <p className="text-sm mt-2">Try removing some amenity filters</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  {results.length} gym{results.length !== 1 ? "s" : ""} found
                  {postcode ? ` near ${postcode}` : ""}
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
