import { useEffect, useState } from "react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import AmenityBadge from "@/components/AmenityBadge";
import ImageCarousel from "@/components/ImageCarousel";
import type { Gym } from "@/types";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";
import { MemberOfferIcon } from "@/components/AmenityIcon";
import { getStockImage, STOCK_ATTRIBUTION } from "@/lib/stockImages";
import FeedbackModal from "@/components/FeedbackModal";
import ClaimModal from "@/components/ClaimModal";
import ShareButton from "@/components/ShareButton";
import { trackEvent } from "@/lib/gtag";
import { BASE_URL } from "@/lib/siteUrl";
import { POSTCODE_META } from "@/lib/utils";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

interface PTSummary {
  id: string;
  slug?: string;
  name: string;
  specialties: string[];
  images: string[];
  pricePerSession?: number;
  sessionDuration?: number;
}

interface Props {
  gym: Gym;
  personalTrainers: PTSummary[];
  suburbSlug?: string;
}

const SCHEMA_DAY_MAP: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
  thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

function parseHoursRange(dayName: string, value: string) {
  // Try to parse "6:00 AM - 9:00 PM" or "06:00 - 21:00" into Schema.org format
  const match = value.match(/(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)/i);
  if (!match) return null;

  function to24(t: string): string {
    t = t.trim().replace(".", ":");
    const ampm = t.match(/(AM|PM)$/i);
    if (!ampm) return t.length === 4 ? "0" + t : t;
    const [h_, m] = t.replace(/\s*(AM|PM)/i, "").split(":").map(Number);
    let h = h_;
    if (ampm[1].toUpperCase() === "PM" && h !== 12) h += 12;
    if (ampm[1].toUpperCase() === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: `https://schema.org/${dayName}`,
    opens: to24(match[1]),
    closes: to24(match[2]),
  };
}

function buildBreadcrumbJsonLd(gym: Gym, suburbSlug?: string) {
  const items = [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "Gyms", item: `${BASE_URL}/` },
  ];
  if (suburbSlug) {
    items.push({ "@type": "ListItem", position: 3, name: `Gyms in ${gym.address.suburb}`, item: `${BASE_URL}/gyms/${suburbSlug}` });
    items.push({ "@type": "ListItem", position: 4, name: gym.name, item: `${BASE_URL}/gym/${gym.slug ?? gym.id}` });
  } else {
    items.push({ "@type": "ListItem", position: 3, name: gym.name, item: `${BASE_URL}/gym/${gym.slug ?? gym.id}` });
  }
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items };
}

function buildJsonLd(gym: Gym) {
  const url = `${BASE_URL}/gym/${gym.slug}`;

  const openingHours = Object.entries(gym.hours)
    .filter(([, v]) => v && v.toLowerCase() !== "closed")
    .map(([day, value]) => parseHoursRange(SCHEMA_DAY_MAP[day] ?? day, value!))
    .filter(Boolean);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ["SportsActivityLocation", "HealthClub"],
    name: gym.name,
    description: gym.description,
    url,
    address: {
      "@type": "PostalAddress",
      streetAddress: gym.address.street,
      addressLocality: gym.address.suburb,
      addressRegion: gym.address.state,
      postalCode: gym.address.postcode,
      addressCountry: "AU",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: gym.lat,
      longitude: gym.lng,
    },
  };

  if (gym.phone) jsonLd.telephone = gym.phone;
  if (gym.email) jsonLd.email = gym.email;
  if (gym.website) jsonLd.sameAs = gym.website;
  if (gym.images.length > 0) jsonLd.image = gym.images;
  if (openingHours.length > 0) jsonLd.openingHoursSpecification = openingHours;
  if (gym.googlePlaceId) {
    jsonLd.additionalProperty = {
      "@type": "PropertyValue",
      propertyID: "googlePlaceId",
      value: gym.googlePlaceId,
    };
    jsonLd.hasMap = `https://www.google.com/maps/place/?q=place_id:${gym.googlePlaceId}`;
  }

  if (gym.priceVerified && gym.pricePerWeek > 0) {
    jsonLd.priceRange = `$${gym.pricePerWeek}/week`;
  }

  if (gym.amenities.length > 0) {
    jsonLd.amenityFeature = gym.amenities.map((a) => ({
      "@type": "LocationFeatureSpecification",
      name: a,
      value: true,
    }));
  }

  return jsonLd;
}

function track(gymId: string, event: string) {
  fetch(`/api/stats/${gymId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export default function GymProfilePage({ gym, personalTrainers, suburbSlug }: Props) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInternalUser, setIsInternalUser] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [contactForm, setContactForm] = useState<ContactForm>({ name: "", email: "", phone: "", message: "" });
  const [contactStatus, setContactStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [showFeedback, setShowFeedback] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");

  // Profile page always respects isPaid — admins edit via admin panel, not the listing view
  const effectivePaid = !!gym.isPaid;

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        const attributes = await fetchUserAttributes();
        setIsOwner(attributes["custom:ownerId"] === gym.ownerId);
        setIsAdmin(attributes["custom:isAdmin"] === "true");
        const email = user.signInDetails?.loginId ?? attributes.email ?? "";
        setIsInternalUser(email.endsWith("@mynextgym.com.au"));
        setUserEmail(email);
        setUserName(attributes.name ?? "");
        setAuthChecked(true);
      })
      .catch(() => {
        // Not signed in — isOwner/isAdmin/isInternalUser stay false
        setAuthChecked(true);
      });
    track(gym.id, "pageViews");
    trackEvent("view_item", { item_id: gym.id, item_name: gym.name, item_category: gym.address.suburb });
  }, [gym.id, gym.ownerId, gym.name, gym.address.suburb]);

  // Auto-open claim modal if redirected back from login
  useEffect(() => {
    if (authChecked && router.query.claim === "true") {
      setShowClaim(true);
      // Clean the URL without reload
      const q = { ...router.query };
      delete q.claim;
      router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true });
    }
  }, [authChecked, router]);

  // Block non-internal users from viewing test gyms
  useEffect(() => {
    if (authChecked && gym.isTest && !isInternalUser) {
      router.replace("/");
    }
  }, [authChecked, gym.isTest, isInternalUser, router]);

  // Don't render test gym content until auth is verified
  if (gym.isTest && !isInternalUser) {
    return null;
  }

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactStatus("sending");
    try {
      const r = await fetch(`/api/contact/${gym.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (r.ok) {
        setContactStatus("sent");
        track(gym.id, "contactFormSubmissions");
        trackEvent("generate_lead", { item_id: gym.id, item_name: gym.name });
      } else {
        setContactStatus("error");
      }
    } catch {
      setContactStatus("error");
    }
  }

  return (
    <>
      <Head>
        <title>{gym.name} — mynextgym.com.au</title>
        <meta name="description" content={`${gym.name} in ${gym.address.suburb} — memberships, facilities, hours and reviews. Find your next gym on MyNextGym.`.slice(0, 155)} />
        {gym.isTest && <meta name="robots" content="noindex, nofollow" />}
        <meta property="og:title" content={`${gym.name} — mynextgym.com.au`} />
        <meta property="og:description" content={gym.description || `${gym.name} in ${gym.address.suburb}, ${gym.address.state}`} />
        <meta property="og:type" content="business.business" />
        <meta property="og:url" content={`${BASE_URL}/gym/${gym.slug}`} />
        {gym.images.length > 0 && <meta property="og:image" content={gym.images[0]} />}
        <meta name="twitter:card" content={gym.images.length > 0 ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={`${gym.name} — mynextgym.com.au`} />
        <meta name="twitter:description" content={gym.description || `${gym.name} in ${gym.address.suburb}, ${gym.address.state}`} />
        {gym.images.length > 0 && <meta name="twitter:image" content={gym.images[0]} />}
        <link rel="canonical" href={`${BASE_URL}/gym/${gym.slug}`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(gym)) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBreadcrumbJsonLd(gym, suburbSlug)) }}
        />
      </Head>
      <Layout>
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-4 flex items-center justify-between" aria-label="Breadcrumb">
          <div>
            <Link href="/" className="hover:text-brand-orange">Home</Link>
            {" / "}
            {suburbSlug ? (
              <>
                <Link href={`/gyms/${suburbSlug}`} className="hover:text-brand-orange">Gyms in {gym.address.suburb}</Link>
                {" / "}
              </>
            ) : (
              <>
                <span>Gyms</span>
                {" / "}
              </>
            )}
            <span className="text-gray-800 font-medium">{gym.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShareButton
              title={gym.name}
              text={`Check out ${gym.name} in ${gym.address.suburb} on mynextgym.com.au`}
            />
            {isOwner && (
              <Link
                href={`/owner/${gym.id}`}
                className="bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                Edit Gym
              </Link>
            )}
            {isAdmin && (
              <Link
                href={`/admin?gym=${gym.id}`}
                className="bg-brand-black hover:bg-gray-800 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                Admin Edit
              </Link>
            )}
          </div>
        </nav>

        {/* Banner */}
        {(() => {
          const isUnclaimed = gym.ownerId === "unclaimed" || gym.ownerId === "owner-3";
          const isStock = gym.images.length === 0 && isUnclaimed;
          const displayImages = isStock ? [getStockImage(gym.id)] : gym.images;
          return (
        <div className="relative rounded-2xl overflow-hidden h-56 sm:h-72 mb-6 bg-brand-black">
          <div className="absolute inset-0 opacity-60">
            <ImageCarousel
              images={displayImages}
              alt={gym.name}
              sizes="100vw"
              showDots={false}
              focalPoints={gym.imageFocalPoints}
            />
          </div>
          {isStock && (
            <span className="absolute bottom-2 right-3 text-[10px] text-white/50 z-10">
              {STOCK_ATTRIBUTION}
            </span>
          )}
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
          );
        })()}

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
            {gym.amenities.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">
                  Amenities
                </h2>
                <div className="flex flex-wrap gap-2">
                  {gym.amenities.map((a) => (
                    <AmenityBadge key={a} amenity={a} />
                  ))}
                </div>
                {(gym.amenitiesNotes || gym.amenitiesVerified) && (
                  <p className="mt-3 text-xs text-gray-400 flex items-center gap-1">
                    {gym.amenitiesVerified && (
                      <svg className="w-3 h-3 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {gym.amenitiesNotes || "Verified using AI"}
                  </p>
                )}
              </section>
            )}

            {/* Specialties — paid listings only */}
            {effectivePaid && (gym.specialties?.length ?? 0) > 0 && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">
                  Specialties
                </h2>
                <div className="flex flex-wrap gap-2">
                  {gym.specialties!.map((s) => (
                    <span key={s} className="inline-flex items-center px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Member Offers — paid listings only */}
            {effectivePaid && (gym.memberOffers?.length || gym.memberOffersNotes) && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">
                  Member Offers
                </h2>
                {gym.memberOffers && gym.memberOffers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {gym.memberOffers.map((offer) => (
                      <span key={offer} className="inline-flex items-center gap-1.5 bg-orange-50 text-brand-orange border border-orange-200 rounded-full px-3 py-1 text-sm font-medium">
                        <MemberOfferIcon offer={offer} className="w-4 h-4 shrink-0" />
                        <span className="capitalize">{offer}</span>
                      </span>
                    ))}
                  </div>
                )}
                {gym.memberOffersNotes && (
                  <ul className="space-y-1 mb-2">
                    {gym.memberOffersNotes.split(/[,;]+/).map((item) => item.trim()).filter(Boolean).map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm font-semibold text-gray-800">
                        <span className="text-brand-orange mt-0.5">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                {gym.memberOffersTnC && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Terms &amp; Conditions</p>
                    <p className="text-xs text-gray-400">{gym.memberOffersTnC}</p>
                  </div>
                )}
              </section>
            )}

            {/* Hours — only shown if at least one day is populated */}
            {DAYS.some((day) => gym.hours[day]) && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">
                  Opening Hours{gym.amenities.includes("24/7 access") && (
                    <span className="ml-2 text-sm font-normal text-gray-500">(24/7 access)</span>
                  )}
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
                {effectivePaid && gym.hoursComment && (
                  <p className="mt-3 text-sm italic text-gray-500">{gym.hoursComment}</p>
                )}
              </section>
            )}

            {/* Personal Trainers */}
            {personalTrainers.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Personal Trainers</h2>
                <div className="space-y-3">
                  {personalTrainers.map((trainer) => (
                    <Link
                      key={trainer.id}
                      href={`/pt/${trainer.slug}`}
                      className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:border-brand-orange hover:bg-orange-50 transition-colors group"
                    >
                      {trainer.images.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={trainer.images[0]} alt={trainer.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 group-hover:text-brand-orange">{trainer.name}</p>
                        {trainer.specialties.length > 0 && (
                          <p className="text-sm text-gray-500 truncate">{trainer.specialties.slice(0, 3).join(" · ")}</p>
                        )}
                      </div>
                      {trainer.pricePerSession && (
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-brand-orange">${+trainer.pricePerSession.toFixed(2)}</p>
                          <p className="text-xs text-gray-400">/session</p>
                        </div>
                      )}
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-brand-orange shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              <p className="text-orange-100 text-sm mb-1">Pricing</p>
              {gym.priceVerified && gym.pricePerWeek > 0 ? (
                <>
                  <p className="text-2xl font-bold text-white">
                    ${+gym.pricePerWeek.toFixed(2)}<span className="text-base font-normal text-orange-100">/week</span>
                  </p>
                  {gym.pricingNotes && (
                    <p className="mt-1 text-xs text-orange-200 flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {gym.pricingNotes}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-base font-semibold text-orange-50">
                  Check out website for pricing
                </p>
              )}

              {/* Contact form for paid gyms with email; otherwise Visit Website button */}
              {effectivePaid && gym.bookingUrl && (
                <a
                  href={gym.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { track(gym.id, "bookingClicks"); trackEvent("booking_click", { item_id: gym.id, item_name: gym.name }); }}
                  className="block mt-4 bg-white text-brand-orange text-center font-bold py-2.5 rounded-lg hover:bg-orange-50 transition-colors text-sm"
                >
                  Book Now →
                </a>
              )}
              {effectivePaid && gym.email ? (
                <div className="mt-4">
                  {contactStatus === "sent" ? (
                    <div className="bg-white/20 rounded-lg p-4 text-center">
                      <p className="font-semibold text-white">Message sent!</p>
                      <p className="text-orange-100 text-sm mt-1">We&apos;ll be in touch shortly.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-2">
                      <p className="text-orange-100 text-sm font-medium mb-2">Send an enquiry</p>
                      <input
                        required
                        placeholder="Your name"
                        value={contactForm.name}
                        onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-gray-900 text-sm focus:outline-none"
                      />
                      <input
                        required
                        type="email"
                        placeholder="Your email"
                        value={contactForm.email}
                        onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-gray-900 text-sm focus:outline-none"
                      />
                      <input
                        placeholder="Phone (optional)"
                        value={contactForm.phone}
                        onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-gray-900 text-sm focus:outline-none"
                      />
                      <textarea
                        rows={3}
                        placeholder="Your message…"
                        value={contactForm.message}
                        onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-gray-900 text-sm focus:outline-none resize-none"
                      />
                      {contactStatus === "error" && (
                        <p className="text-orange-100 text-xs">Something went wrong. Please try again.</p>
                      )}
                      <button
                        type="submit"
                        disabled={contactStatus === "sending"}
                        className="w-full bg-white text-brand-orange font-semibold py-2 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                      >
                        {contactStatus === "sending" ? "Sending…" : "Send Enquiry"}
                      </button>
                    </form>
                  )}
                  {gym.website && (
                    <a
                      href={gym.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => { track(gym.id, "websiteClicks"); trackEvent("website_click", { item_id: gym.id, item_name: gym.name }); }}
                      className="block mt-2 text-center text-orange-100 text-xs hover:underline"
                    >
                      Visit website
                    </a>
                  )}
                </div>
              ) : (
                <a
                  href={gym.website || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => { track(gym.id, "websiteClicks"); trackEvent("website_click", { item_id: gym.id, item_name: gym.name }); }}
                  className="block mt-4 bg-white text-brand-orange text-center font-semibold py-2 rounded-lg hover:bg-orange-50 transition-colors"
                >
                  Visit Website
                </a>
              )}
            </div>

            {/* Contact — only shown if there is something to display */}
            {(gym.phone || (effectivePaid && (gym.instagram || gym.facebook)) || gym.ownerId === "unclaimed" || gym.ownerId === "owner-3") && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  {gym.phone && (
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <a
                        href={`tel:${gym.phone}`}
                        onClick={() => { track(gym.id, "phoneClicks"); trackEvent("phone_click", { item_id: gym.id, item_name: gym.name }); }}
                        className="hover:underline"
                      >
                        {gym.phone}
                      </a>
                    </li>
                  )}
                  {effectivePaid && gym.instagram && (
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                      </svg>
                      <a
                        href={gym.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline truncate"
                      >
                        Instagram
                      </a>
                    </li>
                  )}
                  {effectivePaid && gym.facebook && (
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                      <a
                        href={gym.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline truncate"
                      >
                        Facebook
                      </a>
                    </li>
                  )}
                </ul>
                {(gym.ownerId === "unclaimed" || gym.ownerId === "owner-3") && (
                  <div className={`${gym.phone || (effectivePaid && (gym.instagram || gym.facebook)) ? "mt-3 pt-3 border-t border-gray-100" : ""}`}>
                    <button
                      onClick={() => setShowClaim(true)}
                      className="text-sm text-brand-orange hover:underline"
                    >
                      Claim this listing for free →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Address */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Location</h3>
              <address className="not-italic text-sm text-gray-700 leading-relaxed">
                {gym.address.street}
                <br />
                {gym.address.suburb}, {gym.address.state}{" "}
                {gym.address.postcode}
              </address>
              <a
                href={gym.googlePlaceId
                  ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${gym.address.street}, ${gym.address.suburb} ${gym.address.state} ${gym.address.postcode}`)}&destination_place_id=${gym.googlePlaceId}`
                  : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${gym.address.street}, ${gym.address.suburb} ${gym.address.state} ${gym.address.postcode}`)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => { track(gym.id, "directionsClicks"); trackEvent("directions_click", { item_id: gym.id, item_name: gym.name }); }}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Get Directions
              </a>
            </div>

            {/* Feedback link */}
            <div className="text-center mt-3">
              <button
                onClick={() => setShowFeedback(true)}
                className="text-xs text-gray-400 hover:text-brand-orange transition-colors"
              >
                See something wrong? Let us know
              </button>
            </div>
          </aside>
        </div>

        {showFeedback && (
          <FeedbackModal gymId={gym.id} gymName={gym.name} onClose={() => setShowFeedback(false)} />
        )}
        {showClaim && (
          <ClaimModal gym={gym} onClose={() => setShowClaim(false)} initialEmail={userEmail} initialName={userName} />
        )}
      </Layout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
  params,
}) => {
  const param = params?.id as string;

  // Try direct ID lookup first (handles old /gym/gym-044 URLs)
  let gym = await ownerStore.getById(param);
  if (gym && gym.isActive !== false && param !== gym.slug) {
    // 301 redirect from old ID URL to new slug URL
    return { redirect: { destination: `/gym/${gym.slug}`, permanent: true } };
  }

  // If not found by ID, try slug lookup
  if (!gym) {
    gym = await ownerStore.getBySlug(param);
  }

  if (!gym || gym.isActive === false) return { redirect: { destination: "/", permanent: false } };

  // Fetch personal trainers affiliated with this gym
  const allPTs = await ptStore.getByGymId(gym.id);
  const personalTrainers: PTSummary[] = allPTs
    .filter((pt) => pt.isActive !== false)
    .map((pt) => ({
      id: pt.id,
      slug: pt.slug,
      name: pt.name,
      specialties: pt.specialties,
      images: pt.images,
      pricePerSession: pt.pricePerSession,
      sessionDuration: pt.sessionDuration,
    }));

  // Resolve suburb slug for breadcrumb
  const meta = POSTCODE_META[gym.address.postcode];
  const suburbSlug = meta?.slug;

  return { props: { gym, personalTrainers, suburbSlug } };
};
