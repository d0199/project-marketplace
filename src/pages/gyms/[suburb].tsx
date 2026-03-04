import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";
import GymCard from "@/components/GymCard";
import {
  POSTCODE_COORDS,
  POSTCODE_META,
  filterGyms,
  type GymWithDistance,
} from "@/lib/utils";
import { ownerStore } from "@/lib/ownerStore";

interface Props {
  postcode: string;
  suburbName: string;
  slug: string;
  gyms: GymWithDistance[];
}

export default function SuburbPage({ postcode, suburbName, slug, gyms }: Props) {
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Gyms in {suburbName}, {postcode}
          </h1>
          <p className="text-gray-500">
            {count > 0
              ? `${count} gym${count !== 1 ? "s" : ""} within 10 km of ${suburbName}`
              : `No gyms listed near ${suburbName} yet — try a nearby suburb below`}
          </p>
        </div>

        {/* Gym grid */}
        {count > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-12">
            {gyms.map((gym) => (
              <GymCard
                key={gym.id}
                gym={gym}
                unclaimed={gym.ownerId === "owner-3"}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 mb-12 bg-gray-50 rounded-xl">
            <p className="text-4xl mb-3">🏋️</p>
            <p className="text-gray-500 mb-4">No gyms listed for this area yet.</p>
            <Link
              href="/"
              className="inline-block px-5 py-2 bg-brand-orange text-white text-sm font-semibold rounded-lg hover:bg-brand-orange-dark transition-colors"
            >
              Search all suburbs
            </Link>
          </div>
        )}

        {/* Browse other suburbs */}
        <div className="border-t pt-8">
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

  // Extract postcode from slug — last 4 digits
  const match = slug?.match(/(\d{4})$/);
  const postcode = match?.[1];

  if (!postcode || !POSTCODE_COORDS[postcode] || !POSTCODE_META[postcode]) {
    return { notFound: true };
  }

  const allGyms = await ownerStore.getAll();
  const gyms = filterGyms(allGyms, { postcode, amenities: [], radiusKm: 10 });

  return {
    props: {
      postcode,
      suburbName: POSTCODE_META[postcode].name,
      slug,
      gyms,
    },
  };
};
