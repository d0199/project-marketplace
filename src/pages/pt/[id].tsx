import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import ImageCarousel from "@/components/ImageCarousel";
import type { PersonalTrainer } from "@/types";
import { ptStore } from "@/lib/ptStore";
import { ownerStore } from "@/lib/ownerStore";
import { getStockImage, STOCK_ATTRIBUTION } from "@/lib/stockImages";
import ShareButton from "@/components/ShareButton";

interface AffiliatedGym {
  id: string;
  name: string;
  suburb: string;
  state: string;
}

interface Props {
  pt: PersonalTrainer;
  affiliatedGyms: AffiliatedGym[];
}

function buildJsonLd(pt: PersonalTrainer) {
  const url = `https://www.mynextgym.com.au/pt/${pt.id}`;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: pt.name,
    description: pt.description,
    url,
    jobTitle: "Personal Trainer",
    address: {
      "@type": "PostalAddress",
      streetAddress: pt.address.street,
      addressLocality: pt.address.suburb,
      addressRegion: pt.address.state,
      postalCode: pt.address.postcode,
      addressCountry: "AU",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: pt.lat,
      longitude: pt.lng,
    },
  };

  if (pt.phone) jsonLd.telephone = pt.phone;
  if (pt.email) jsonLd.email = pt.email;
  if (pt.website) jsonLd.sameAs = pt.website;
  if (pt.images.length > 0) jsonLd.image = pt.images;
  if (pt.specialties.length > 0) jsonLd.knowsAbout = pt.specialties;
  if (pt.qualifications.length > 0) {
    jsonLd.hasCredential = pt.qualifications.map((q) => ({
      "@type": "EducationalOccupationalCredential",
      credentialCategory: q,
    }));
  }
  if (pt.pricePerSession) {
    jsonLd.makesOffer = {
      "@type": "Offer",
      name: "Personal Training Session",
      price: pt.pricePerSession,
      priceCurrency: "AUD",
      ...(pt.sessionDuration && { description: `${pt.sessionDuration} minute session` }),
    };
  }

  return jsonLd;
}

export default function PTProfilePage({ pt, affiliatedGyms }: Props) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInternalUser, setIsInternalUser] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        const attributes = await fetchUserAttributes();
        setIsAdmin(attributes["custom:isAdmin"] === "true");
        const email = user.signInDetails?.loginId ?? attributes.email ?? "";
        setIsInternalUser(email.endsWith("@mynextgym.com.au"));
        setAuthChecked(true);
      })
      .catch(() => {
        setAuthChecked(true);
      });
  }, []);

  // Block non-internal users from viewing test PTs
  useEffect(() => {
    if (authChecked && pt.isTest && !isInternalUser) {
      router.replace("/");
    }
  }, [authChecked, pt.isTest, isInternalUser, router]);

  if (pt.isTest && !isInternalUser) return null;

  const hasImages = pt.images.length > 0;
  const displayImages = hasImages ? pt.images : [getStockImage(pt.id)];
  const metaDesc = pt.description || `${pt.name} — Personal Trainer in ${pt.address.suburb}, ${pt.address.state}`;

  return (
    <>
      <Head>
        <title>{`${pt.name} — Personal Trainer | mynextgym.com.au`}</title>
        <meta name="description" content={metaDesc} />
        {pt.isTest && <meta name="robots" content="noindex, nofollow" />}
        <link rel="canonical" href={`https://www.mynextgym.com.au/pt/${pt.id}`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(pt)) }}
        />
      </Head>
      <Layout>
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-4 flex items-center justify-between">
          <div>
            <Link href="/" className="hover:text-brand-orange">Home</Link>
            {" / "}
            <span className="text-gray-800 font-medium">{pt.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShareButton
              title={pt.name}
              text={`Check out ${pt.name} — Personal Trainer in ${pt.address.suburb} on mynextgym.com.au`}
            />
            {isAdmin && (
              <Link
                href={`/admin?tab=pts`}
                className="bg-brand-black hover:bg-gray-800 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                Admin Edit
              </Link>
            )}
          </div>
        </nav>

        {/* Banner */}
        <div className={`relative rounded-2xl h-56 sm:h-72 bg-brand-black ${hasImages ? "mb-10" : "mb-6"}`}>
          <div className="absolute inset-0 rounded-2xl overflow-hidden">
            <div className="absolute inset-0 opacity-60">
              <ImageCarousel
                images={hasImages && pt.images.length > 1 ? pt.images.slice(1) : displayImages}
                alt={pt.name}
                sizes="100vw"
                showDots={false}
                focalPoints={pt.imageFocalPoints}
              />
            </div>
            {!hasImages && (
              <span className="absolute bottom-2 right-3 text-[10px] text-white/50 z-10">
                {STOCK_ATTRIBUTION}
              </span>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          </div>
          <div className="absolute inset-0 flex flex-col justify-end p-6 pointer-events-none">
            <p className="text-orange-200 text-sm font-medium mb-1">Personal Trainer</p>
            <h1 className="text-3xl font-bold text-white drop-shadow-md">{pt.name}</h1>
            <p className="text-orange-100 mt-1">
              {pt.address.suburb}, {pt.address.state} {pt.address.postcode}
            </p>
          </div>
          {/* Profile photo — overlaps banner bottom-right */}
          {hasImages && (
            <div className="absolute -bottom-8 right-6 sm:right-8 z-10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pt.images[0]}
                alt={pt.name}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover border-4 border-white shadow-lg"
              />
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            {pt.description && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-3 text-gray-900">About</h2>
                <p className="text-gray-700 leading-relaxed">{pt.description}</p>
              </section>
            )}

            {/* Specialties */}
            {pt.specialties.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Specialties</h2>
                <div className="flex flex-wrap gap-2">
                  {pt.specialties.map((s) => (
                    <span key={s} className="inline-flex items-center px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Qualifications */}
            {pt.qualifications.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Qualifications</h2>
                <ul className="space-y-2">
                  {pt.qualifications.map((q) => (
                    <li key={q} className="flex items-center gap-2 text-sm text-gray-700">
                      <svg className="w-4 h-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {q}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Affiliated Gyms */}
            {affiliatedGyms.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Affiliated Gyms</h2>
                <div className="space-y-3">
                  {affiliatedGyms.map((gym) => (
                    <Link
                      key={gym.id}
                      href={`/gym/${gym.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-brand-orange hover:bg-orange-50 transition-colors group"
                    >
                      <div>
                        <p className="font-medium text-gray-900 group-hover:text-brand-orange">{gym.name}</p>
                        <p className="text-sm text-gray-500">{gym.suburb}, {gym.state}</p>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-brand-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Pricing */}
            <div className="bg-brand-orange rounded-xl p-5 text-white">
              <p className="text-orange-100 text-sm mb-1">Session Rate</p>
              {pt.pricePerSession ? (
                <>
                  <p className="text-2xl font-bold text-white">
                    ${+pt.pricePerSession.toFixed(2)}
                    <span className="text-base font-normal text-orange-100">
                      /session{pt.sessionDuration ? ` (${pt.sessionDuration}min)` : ""}
                    </span>
                  </p>
                  {pt.pricingNotes && (
                    <p className="mt-1 text-xs text-orange-200">{pt.pricingNotes}</p>
                  )}
                </>
              ) : (
                <p className="text-base font-semibold text-orange-50">
                  Contact for pricing
                </p>
              )}

              {pt.bookingUrl && (
                <a
                  href={pt.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-4 bg-white text-brand-orange text-center font-bold py-2.5 rounded-lg hover:bg-orange-50 transition-colors text-sm"
                >
                  Book a Session →
                </a>
              )}

              {pt.website && (
                <a
                  href={pt.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block ${pt.bookingUrl ? "mt-2 text-center text-orange-100 text-xs hover:underline" : "mt-4 bg-white text-brand-orange text-center font-semibold py-2 rounded-lg hover:bg-orange-50 transition-colors"}`}
                >
                  {pt.bookingUrl ? "Visit website" : "Visit Website"}
                </a>
              )}
            </div>

            {/* Details */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Details</h3>
              <dl className="space-y-2 text-sm">
                {pt.experienceYears && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Experience</dt>
                    <dd className="text-gray-900 font-medium">{pt.experienceYears} year{pt.experienceYears !== 1 ? "s" : ""}</dd>
                  </div>
                )}
                {pt.gender && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Gender</dt>
                    <dd className="text-gray-900 font-medium capitalize">{pt.gender}</dd>
                  </div>
                )}
                {pt.languages && pt.languages.length > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Languages</dt>
                    <dd className="text-gray-900 font-medium">{pt.languages.join(", ")}</dd>
                  </div>
                )}
                {pt.availability && (
                  <div>
                    <dt className="text-gray-500 mb-1">Availability</dt>
                    <dd className="text-gray-900 text-sm">{pt.availability}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Contact */}
            {(pt.phone || pt.instagram || pt.facebook || pt.tiktok) && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  {pt.phone && (
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <a href={`tel:${pt.phone}`} className="hover:underline">{pt.phone}</a>
                    </li>
                  )}
                  {pt.instagram && (
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                      </svg>
                      <a href={pt.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">Instagram</a>
                    </li>
                  )}
                  {pt.facebook && (
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      <a href={pt.facebook} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">Facebook</a>
                    </li>
                  )}
                  {pt.tiktok && (
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.15V11.7a4.83 4.83 0 01-3.77-1.24V6.69h3.77z" />
                      </svg>
                      <a href={pt.tiktok} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">TikTok</a>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Location */}
            {pt.address.street && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-900 mb-2">Location</h3>
                <address className="not-italic text-sm text-gray-700 leading-relaxed">
                  {pt.address.street}<br />
                  {pt.address.suburb}, {pt.address.state} {pt.address.postcode}
                </address>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${pt.address.street}, ${pt.address.suburb} ${pt.address.state} ${pt.address.postcode}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Get Directions
                </a>
              </div>
            )}
          </aside>
        </div>
      </Layout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ params }) => {
  const pt = await ptStore.getById(params?.id as string);
  if (!pt || pt.isActive === false) return { redirect: { destination: "/", permanent: false } };

  // Resolve affiliated gym names
  const affiliatedGyms: AffiliatedGym[] = [];
  for (const gymId of pt.gymIds) {
    const gym = await ownerStore.getById(gymId);
    if (gym && gym.isActive !== false) {
      affiliatedGyms.push({
        id: gym.id,
        name: gym.name,
        suburb: gym.address.suburb,
        state: gym.address.state,
      });
    }
  }

  return { props: { pt, affiliatedGyms } };
};
