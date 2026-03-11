import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";
import { BASE_URL } from "@/lib/siteUrl";

const FAQS = [
  {
    q: "Is mynextgym.com.au free to use?",
    a: "Yes — searching for gyms and personal trainers is completely free. Gym owners and PTs can also create a basic listing at no cost.",
  },
  {
    q: "How do I find a gym near me?",
    a: "Enter your suburb or postcode on the home page and hit search. We'll show gyms within your chosen radius, sorted by distance. You can filter by amenities, member offers, and more.",
  },
  {
    q: "What cities and states do you cover?",
    a: "We cover gyms and personal trainers across all of Australia including WA, NSW, VIC, QLD, SA, and TAS. Our largest coverage is in Perth and we're expanding nationally every week.",
  },
  {
    q: "How do I list my gym on mynextgym.com.au?",
    a: "Click 'Create a free listing' in the navigation bar. Fill out your gym details and submit — our team will review and publish your listing, usually within 24 hours.",
  },
  {
    q: "How do I claim my gym or PT profile?",
    a: "If your gym or PT profile already exists, visit the profile page and click the 'Claim this listing' button. You'll need to verify your identity and ownership before gaining edit access.",
  },
  {
    q: "What's included in a free listing?",
    a: "Free listings include your gym or PT name, location, description, amenities, and opening hours. Paid plans unlock additional features like a contact form, social links, featured placement, and lead tracking.",
  },
  {
    q: "How do I find a personal trainer near me?",
    a: "Switch to the 'Trainers' tab on the home page, enter your suburb or postcode, and browse personal trainers in your area. You can filter by specialty, availability, and more.",
  },
  {
    q: "Are gym prices and amenities accurate?",
    a: "We do our best to keep information up to date. Listings marked with a verified badge have been confirmed by our team or the gym owner. We recommend contacting the gym directly to confirm current pricing.",
  },
  {
    q: "How do I update my gym's information?",
    a: "Log in to the Owner Portal and select your gym. You can update photos, prices, amenities, opening hours, and more. Changes by verified owners go live immediately; other edits are reviewed first.",
  },
  {
    q: "How does qualification verification work for PTs?",
    a: "Personal trainers can submit evidence for each qualification (certificates, registration numbers). Our team reviews the evidence and marks individual qualifications as verified, giving potential clients confidence in your credentials.",
  },
  {
    q: "Can I compare gyms side by side?",
    a: "Search results show key details like price, amenities, and distance for each gym, making it easy to compare options at a glance. Click into any gym for full details including photos, hours, and member offers.",
  },
  {
    q: "How do I contact a gym or personal trainer?",
    a: "Visit the gym or PT profile page where you'll find their phone number, website, and location. Paid listings also include a direct enquiry form so you can send a message without leaving the site.",
  },
];

export default function AboutPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "About & FAQ", item: `${BASE_URL}/about` },
    ],
  };

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "mynextgym.com.au",
    url: BASE_URL,
    logo: `${BASE_URL}/icon-192.png`,
    description:
      "Australia's gym and personal trainer directory. Search, compare, and connect with fitness facilities and trainers across WA, NSW, VIC, QLD, SA, and TAS.",
    foundingDate: "2026",
    areaServed: {
      "@type": "Country",
      name: "Australia",
    },
    sameAs: [],
  };

  return (
    <>
      <Head>
        <title>About Us & FAQ — mynextgym.com.au</title>
        <meta
          name="description"
          content="Learn about mynextgym.com.au — Australia's gym and personal trainer directory. Find answers to frequently asked questions about searching, listing, and managing gym profiles."
        />
        <meta property="og:title" content="About Us & FAQ — mynextgym.com.au" />
        <meta
          property="og:description"
          content="Australia's gym and personal trainer directory. Search, compare, and connect with fitness facilities across WA, NSW, VIC, QLD, SA, and TAS."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${BASE_URL}/about`} />
        <meta property="og:image" content={`${BASE_URL}/icon-192.png`} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="About Us & FAQ — mynextgym.com.au" />
        <meta name="twitter:description" content="Australia's gym and personal trainer directory. Search, compare, and connect with fitness facilities across WA, NSW, VIC, QLD, SA, and TAS." />
        <link rel="canonical" href={`${BASE_URL}/about`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      </Head>
      <Layout>
        {/* About Section */}
        <section className="max-w-3xl mx-auto mb-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
            About mynextgym.com.au
          </h1>

          <div className="prose prose-gray max-w-none space-y-4 text-gray-700 leading-relaxed">
            <p>
              <strong>mynextgym.com.au</strong> is Australia&apos;s gym and personal trainer
              directory, built to make finding the right fitness facility or trainer as simple as
              searching by your suburb or postcode.
            </p>
            <p>
              Whether you&apos;re looking for a 24/7 gym close to home, a boutique studio with
              group classes, or a qualified personal trainer who specialises in your goals — we
              help you compare options, check prices, and connect with the right fit.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">What we offer</h2>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-brand-orange font-bold mt-0.5">&#10003;</span>
                <span>
                  <strong>Search by location</strong> — find gyms and PTs within your chosen
                  radius, sorted by distance
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-orange font-bold mt-0.5">&#10003;</span>
                <span>
                  <strong>Compare at a glance</strong> — prices, amenities, opening hours, and
                  member offers side by side
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-orange font-bold mt-0.5">&#10003;</span>
                <span>
                  <strong>Verified information</strong> — gym details and PT qualifications
                  reviewed by our team
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-orange font-bold mt-0.5">&#10003;</span>
                <span>
                  <strong>Free listings</strong> — gym owners and personal trainers can create a
                  profile at no cost
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-orange font-bold mt-0.5">&#10003;</span>
                <span>
                  <strong>National coverage</strong> — WA, NSW, VIC, QLD, SA, and TAS with more
                  suburbs added weekly
                </span>
              </li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">For gym owners & PTs</h2>
            <p>
              Claim or create your listing to reach thousands of Australians searching for their
              next gym or trainer. The{" "}
              <Link href="/owner" className="text-brand-orange hover:underline font-medium">
                Owner Portal
              </Link>{" "}
              gives you full control over your profile — update photos, pricing, amenities, and
              opening hours anytime. Personal trainers can verify qualifications to build trust
              with potential clients.
            </p>

            <div className="flex flex-wrap gap-3 mt-6">
              <Link
                href="/"
                className="inline-flex items-center px-5 py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Search gyms
              </Link>
              <Link
                href="/list"
                className="inline-flex items-center px-5 py-2.5 bg-white border border-gray-300 hover:border-brand-orange text-gray-700 hover:text-brand-orange text-sm font-semibold rounded-lg transition-colors"
              >
                Create a listing
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="max-w-3xl mx-auto scroll-mt-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <details
                key={i}
                className="group bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <summary className="flex items-center justify-between cursor-pointer px-6 py-4 text-gray-900 font-medium hover:bg-gray-50 transition-colors">
                  <span className="pr-4">{faq.q}</span>
                  <svg
                    className="w-5 h-5 shrink-0 text-gray-400 group-open:rotate-180 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      </Layout>
    </>
  );
}
