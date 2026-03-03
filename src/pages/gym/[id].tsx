import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import AmenityBadge from "@/components/AmenityBadge";
import ImageCarousel from "@/components/ImageCarousel";
import type { Gym } from "@/types";
import { ownerStore } from "@/lib/ownerStore";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

interface Props {
  gym: Gym;
}

function track(gymId: string, event: string) {
  fetch(`/api/stats/${gymId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

export default function GymProfilePage({ gym }: Props) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then(async () => {
        const attributes = await fetchUserAttributes();
        setIsOwner(attributes["custom:ownerId"] === gym.ownerId);
      })
      .catch(() => {
        // Not signed in — isOwner stays false
      });
    track(gym.id, "pageViews");
  }, [gym.id, gym.ownerId]);

  return (
    <>
      <Head>
        <title>{gym.name} — mynextgym.com.au</title>
        <meta name="description" content={gym.description} />
      </Head>
      <Layout>
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-4 flex items-center justify-between">
          <div>
            <Link href="/" className="hover:text-brand-orange">
              Home
            </Link>
            {" / "}
            <span className="text-gray-800 font-medium">{gym.name}</span>
          </div>
          {isOwner && (
            <Link
              href={`/owner/${gym.id}`}
              className="bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
            >
              Edit Gym
            </Link>
          )}
        </nav>

        {/* Banner */}
        <div className="relative rounded-2xl overflow-hidden h-56 sm:h-72 mb-6 bg-brand-black">
          <div className="absolute inset-0 opacity-60">
            <ImageCarousel
              images={gym.images}
              alt={gym.name}
              sizes="100vw"
              showDots={false}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 pointer-events-none">
            <h1 className="text-3xl font-bold text-white drop-shadow-md">
              {gym.name}
            </h1>
            <p className="text-orange-100 mt-1">
              {gym.address.street}, {gym.address.suburb}{" "}
              {gym.address.postcode}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-3 text-gray-900">
                About
              </h2>
              <p className="text-gray-700 leading-relaxed">{gym.description}</p>
            </section>

            {/* Amenities */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                Amenities
              </h2>
              <div className="flex flex-wrap gap-2">
                {gym.amenities.map((a) => (
                  <AmenityBadge key={a} amenity={a} />
                ))}
              </div>
            </section>

            {/* Hours */}
            <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">
                Opening Hours
              </h2>
              <dl className="grid gap-2">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="flex justify-between text-sm border-b border-gray-50 pb-2 last:border-0"
                  >
                    <dt className="font-medium text-gray-700 capitalize">
                      {day}
                    </dt>
                    <dd className="text-gray-600">
                      {gym.hours[day] ?? "Closed"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Pricing */}
            <div className="bg-brand-orange rounded-xl p-5 text-white">
              <p className="text-orange-100 text-sm mb-1">Membership from</p>
              <p className="text-4xl font-bold">
                ${gym.pricePerWeek}
                <span className="text-lg font-normal text-orange-200">/wk</span>
              </p>
              <a
                href={gym.website || "#"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track(gym.id, "websiteClicks")}
                className="block mt-4 bg-white text-brand-orange text-center font-semibold py-2 rounded-lg hover:bg-orange-50 transition-colors"
              >
                Visit Website
              </a>
            </div>

            {/* Contact */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                {gym.phone && (
                  <li className="flex items-center gap-2">
                    <span>📞</span>
                    <a
                      href={`tel:${gym.phone}`}
                      onClick={() => track(gym.id, "phoneClicks")}
                      className="hover:underline"
                    >
                      {gym.phone}
                    </a>
                  </li>
                )}
                {gym.email && (
                  <li className="flex items-center gap-2">
                    <span>✉️</span>
                    <a
                      href={`mailto:${gym.email}`}
                      onClick={() => track(gym.id, "emailClicks")}
                      className="hover:underline truncate"
                    >
                      {gym.email}
                    </a>
                  </li>
                )}
              </ul>
            </div>

            {/* Address */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Location</h3>
              <address className="not-italic text-sm text-gray-700 leading-relaxed">
                {gym.address.street}
                <br />
                {gym.address.suburb}, {gym.address.state}{" "}
                {gym.address.postcode}
              </address>
            </div>
          </aside>
        </div>
      </Layout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
  params,
}) => {
  const gym = await ownerStore.getById(params?.id as string);
  if (!gym) return { notFound: true };
  return { props: { gym } };
};
