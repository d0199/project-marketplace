import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";

export default function ListChoicePage() {
  return (
    <>
      <Head>
        <title>Create a Free Listing — mynextgym.com.au</title>
        <meta name="description" content="List your gym or personal trainer profile on MyNextGym for free. Manage your listing, connect with local clients and grow your business." />
      </Head>
      <Layout>
        <div className="max-w-xl mx-auto text-center py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create a free listing
          </h1>
          <p className="text-gray-500 mb-10">
            What best describes you?
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Gym option */}
            <Link
              href="/list-gym"
              className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-gray-200 hover:border-brand-orange transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-brand-orange">
                  <path d="M6 12h12" strokeLinecap="round" />
                  <path d="M3 8v8M6 8v8M18 8v8M21 8v8" strokeLinecap="round" />
                  <rect x="8" y="10" width="8" height="4" rx="1" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-brand-orange transition-colors">
                  I own a gym
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Create your gym listing for free
                </p>
              </div>
            </Link>

            {/* PT option */}
            <Link
              href="/list-pt"
              className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-gray-200 hover:border-brand-orange transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-brand-orange">
                  <circle cx="12" cy="7" r="4" />
                  <path d="M5.5 21v-2a6.5 6.5 0 0113 0v2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-brand-orange transition-colors">
                  I&apos;m a personal trainer
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Create your PT listing for free
                </p>
              </div>
            </Link>
          </div>

          <p className="text-xs text-gray-400 mt-10">
            All listings are reviewed by our team before going live.
          </p>
        </div>
      </Layout>
    </>
  );
}
