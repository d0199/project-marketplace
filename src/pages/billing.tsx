import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { getCurrentUser, fetchUserAttributes, signOut } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import type { OwnerSession, Gym } from "@/types";

type Interval = "month" | "year";

const PRICES = {
  paid: { month: 19, year: 190 },
  featured: { month: 99, year: 990 },
};

const PAID_FEATURES = [
  "Contact enquiry form",
  "Instagram & Facebook links",
  "Hours comment / notes",
  "Member offers section",
];

const FEATURED_FEATURES = [
  "Pinned to top of search results",
  "Rotated among max 3 per postcode",
];

function PriceTag({ plan, interval }: { plan: "paid" | "featured"; interval: Interval }) {
  const price = PRICES[plan][interval === "month" ? "month" : "year"];
  const monthly = interval === "year" ? Math.round(PRICES[plan].year / 12) : PRICES[plan].month;
  return (
    <div>
      <span className="text-3xl font-bold text-gray-900">${price}</span>
      <span className="text-sm text-gray-500">/{interval === "month" ? "mo" : "yr"}</span>
      {interval === "year" && (
        <div className="text-xs text-green-600 font-medium mt-0.5">${monthly}/mo — 2 months free</div>
      )}
    </div>
  );
}

function GymRow({
  gym,
  interval,
  busy,
  onUpgrade,
  onManage,
  onCancel,
}: {
  gym: Gym;
  interval: Interval;
  email?: string;
  busy: string | null;
  onUpgrade: (gym: Gym, plan: "paid" | "featured") => void;
  onManage: () => void;
  onCancel: (gym: Gym) => void;
}) {
  const currentPlan =
    gym.stripePlan ?? (gym.isFeatured ? "featured" : gym.isPaid ? "paid" : null);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Gym header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <div className="font-semibold text-gray-900">{gym.name}</div>
          <div className="text-sm text-gray-500">{gym.address.suburb}, {gym.address.state} {gym.address.postcode}</div>
        </div>
        <Link
          href={`/owner/${gym.id}`}
          className="text-sm font-bold text-gray-700 hover:text-brand-orange transition-colors"
        >
          Edit listing →
        </Link>
      </div>

      {/* Plan columns */}
      <div className="grid grid-cols-3 divide-x divide-gray-100">

        {/* Free */}
        <div className={`p-5 flex flex-col ${!currentPlan ? "bg-gray-50" : ""}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-700">Free</span>
            {!currentPlan && (
              <span className="text-xs bg-gray-200 text-gray-600 font-semibold px-2 py-0.5 rounded-full">Current</span>
            )}
          </div>
          <div className="text-2xl font-bold text-gray-400 mb-3">$0</div>
          <ul className="space-y-1.5 text-xs text-gray-400 flex-1">
            <li>✓ Basic listing</li>
            <li>✓ Search visibility</li>
            <li className="text-gray-300">✗ Contact form</li>
            <li className="text-gray-300">✗ Social links</li>
            <li className="text-gray-300">✗ Member offers</li>
            <li className="text-gray-300">✗ Featured placement</li>
          </ul>
          {currentPlan && (
            <div className="mt-4">
              <button
                onClick={() => onCancel(gym)}
                disabled={busy === `${gym.id}-cancel`}
                className="w-full text-xs py-2 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
              >
                {busy === `${gym.id}-cancel` ? "Cancelling…" : "Downgrade to Free"}
              </button>
            </div>
          )}
        </div>

        {/* Paid */}
        <div className={`p-5 flex flex-col ${currentPlan === "paid" ? "bg-green-50" : ""}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-700">Paid</span>
            {currentPlan === "paid" && (
              <span className="text-xs bg-green-200 text-green-800 font-semibold px-2 py-0.5 rounded-full">Current</span>
            )}
          </div>
          <div className="mb-3">
            <PriceTag plan="paid" interval={interval} />
          </div>
          <ul className="space-y-1.5 text-xs text-gray-600 flex-1">
            <li>✓ Basic listing</li>
            <li>✓ Search visibility</li>
            {PAID_FEATURES.map((f) => <li key={f}>✓ {f}</li>)}
            <li className="text-gray-300">✗ Featured placement</li>
          </ul>
          <div className="mt-4">
            {currentPlan === "paid" ? (
              <button
                onClick={onManage}
                disabled={busy === "portal"}
                className="w-full text-sm py-2 border border-green-400 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                {busy === "portal" ? "Loading…" : "Manage Billing ↗"}
              </button>
            ) : currentPlan === "featured" ? (
              <button
                onClick={onManage}
                disabled={busy === "portal"}
                className="w-full text-sm py-2 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {busy === "portal" ? "Loading…" : "Switch plan ↗"}
              </button>
            ) : (
              <button
                onClick={() => onUpgrade(gym, "paid")}
                disabled={busy === `${gym.id}-paid`}
                className="w-full text-sm py-2 bg-brand-orange hover:bg-brand-orange-dark text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {busy === `${gym.id}-paid` ? "Loading…" : "Upgrade to Paid"}
              </button>
            )}
          </div>
        </div>

        {/* Featured */}
        <div className={`p-5 flex flex-col ${currentPlan === "featured" ? "bg-amber-50" : ""}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-700">Featured</span>
            {currentPlan === "featured" && (
              <span className="text-xs bg-amber-200 text-amber-800 font-semibold px-2 py-0.5 rounded-full">Current</span>
            )}
          </div>
          <div className="mb-3">
            <PriceTag plan="featured" interval={interval} />
          </div>
          <ul className="space-y-1.5 text-xs text-gray-600 flex-1">
            <li>✓ Basic listing</li>
            <li>✓ Search visibility</li>
            {PAID_FEATURES.map((f) => <li key={f}>✓ {f}</li>)}
            {FEATURED_FEATURES.map((f) => <li key={f} className="font-medium text-amber-700">★ {f}</li>)}
          </ul>
          <div className="mt-4">
            {currentPlan === "featured" ? (
              <button
                onClick={onManage}
                disabled={busy === "portal"}
                className="w-full text-sm py-2 border border-amber-400 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                {busy === "portal" ? "Loading…" : "Manage Billing ↗"}
              </button>
            ) : (
              <button
                onClick={() => onUpgrade(gym, "featured")}
                disabled={busy === `${gym.id}-featured`}
                className="w-full text-sm py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {busy === `${gym.id}-featured` ? "Loading…" : "Upgrade to Featured"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<Interval>("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelToast, setCancelToast] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        const attributes = await fetchUserAttributes();
        if (attributes["custom:isAdmin"] === "true") {
          router.replace("/admin");
          return;
        }
        setSession({
          ownerId: attributes["custom:ownerId"] ?? "",
          email: user.signInDetails?.loginId ?? "",
          name: attributes.name ?? attributes.email ?? "",
        });
      })
      .catch(() => router.replace("/owner"));
  }, [router]);

  useEffect(() => {
    if (!session) return;
    fetch(`/api/owner/gyms?ownerId=${session.ownerId}`)
      .then((r) => r.json())
      .then((data: Gym[]) => {
        setGyms(data);
        setLoading(false);
      });
  }, [session]);

  async function handleUpgrade(gym: Gym, plan: "paid" | "featured") {
    if (!session) return;
    setBusy(`${gym.id}-${plan}`);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: gym.id,
          ownerId: session.ownerId,
          email: session.email,
          plan,
          interval,
        }),
      });
      const data = await res.json();
      if (data.redirect === "portal") {
        await handleManage();
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Something went wrong");
      }
    } catch {
      alert("Network error. Please try again.");
    }
    setBusy(null);
  }

  async function handleManage() {
    if (!session) return;
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.email, returnUrl: `${window.location.origin}/billing` }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Network error. Please try again.");
    }
    setBusy(null);
  }

  async function handleCancel(gym: Gym) {
    if (!session) return;
    if (!confirm(`Downgrade ${gym.name} to Free? Your paid features will remain active until the end of the current billing period.`)) return;
    setBusy(`${gym.id}-cancel`);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId: gym.id, email: session.email }),
      });
      const data = await res.json();
      if (data.ok) {
        setCancelToast(`Subscription cancelled. ${gym.name} will revert to Free on ${data.periodEnd}.`);
      } else {
        alert(data.error ?? "Something went wrong");
      }
    } catch {
      alert("Network error. Please try again.");
    }
    setBusy(null);
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20 text-gray-400">Loading…</div>
      </Layout>
    );
  }

  return (
    <>
      <Head>
        <title>Billing — mynextgym.com.au</title>
      </Head>
      <Layout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Listings</h1>
            <p className="text-sm text-gray-500 mt-1">
              {session?.name && `Welcome back, ${session.name} · `}Choose a plan for each gym
            </p>
          </div>
          <button
            onClick={async () => { await signOut(); router.replace("/owner"); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Sign out
          </button>
        </div>

        {cancelToast && (
          <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center justify-between">
            <span>{cancelToast}</span>
            <button onClick={() => setCancelToast(null)} className="ml-4 text-green-600 hover:text-green-800">✕</button>
          </div>
        )}

        {/* Interval toggle */}
        <div className="flex items-center gap-3 mb-8">
          <span className="text-sm text-gray-600">Billing period:</span>
          <div className="flex items-center bg-gray-100 rounded-lg p-1 text-sm font-medium">
            <button
              onClick={() => setInterval("month")}
              className={`px-4 py-1.5 rounded-md transition-colors ${
                interval === "month" ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("year")}
              className={`px-4 py-1.5 rounded-md transition-colors ${
                interval === "year" ? "bg-white shadow text-gray-900" : "text-gray-500"
              }`}
            >
              Annual <span className="text-green-600 font-semibold text-xs ml-1">Save 17%</span>
            </button>
          </div>
        </div>

        {gyms.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No gym listings yet.</p>
            <div className="flex gap-3 justify-center">
              <Link href="/list-gym" className="px-5 py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg text-sm transition-colors">
                Create a listing
              </Link>
              <Link href="/claim-gym" className="px-5 py-2.5 border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-lg text-sm transition-colors">
                Claim your gym
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {gyms.map((gym) => (
              <GymRow
                key={gym.id}
                gym={gym}
                interval={interval}
                email={session?.email ?? ""}
                busy={busy}
                onUpgrade={handleUpgrade}
                onManage={handleManage}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </Layout>
    </>
  );
}
