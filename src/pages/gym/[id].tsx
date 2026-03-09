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
import { MemberOfferIcon } from "@/components/AmenityIcon";
import { getStockImage, STOCK_ATTRIBUTION } from "@/lib/stockImages";
import FeedbackModal from "@/components/FeedbackModal";

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

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export default function GymProfilePage({ gym }: Props) {
  const router = useRouter();
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInternalUser, setIsInternalUser] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [contactForm, setContactForm] = useState<ContactForm>({ name: "", email: "", phone: "", message: "" });
  const [contactStatus, setContactStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [showFeedback, setShowFeedback] = useState(false);

  // Admins and internal users on test gyms see all paid fields for maintenance
  const effectivePaid = gym.isPaid || isAdmin || (gym.isTest && isInternalUser);

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        const attributes = await fetchUserAttributes();
        setIsOwner(attributes["custom:ownerId"] === gym.ownerId);
        setIsAdmin(attributes["custom:isAdmin"] === "true");
        const email = user.signInDetails?.loginId ?? attributes.email ?? "";
        setIsInternalUser(email.endsWith("@mynextgym.com.au"));
        setAuthChecked(true);
      })
      .catch(() => {
        // Not signed in — isOwner/isAdmin/isInternalUser stay false
        setAuthChecked(true);
      });
    track(gym.id, "pageViews");
  }, [gym.id, gym.ownerId]);

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
        <meta name="description" content={gym.description} />
        {gym.isTest && <meta name="robots" content="noindex, nofollow" />}
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
          <div className="flex items-center gap-2">
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

            {/* Specialties */}
            {(gym.specialties?.length ?? 0) > 0 && (
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
                  onClick={() => track(gym.id, "bookingClicks")}
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
                      onClick={() => track(gym.id, "websiteClicks")}
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
                  onClick={() => track(gym.id, "websiteClicks")}
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
                  {effectivePaid && gym.instagram && (
                    <li className="flex items-center gap-2">
                      <span>📷</span>
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
                      <span>💬</span>
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
                    <Link
                      href="/claim-gym"
                      className="text-sm text-brand-orange hover:underline"
                    >
                      Claim this listing for free →
                    </Link>
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
      </Layout>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
  params,
}) => {
  const gym = await ownerStore.getById(params?.id as string);
  if (!gym || gym.isActive === false) return { redirect: { destination: "/", permanent: false } };
  return { props: { gym } };
};
