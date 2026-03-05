import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import type { OwnerSession, Gym } from "@/types";

type Interval = "month" | "year";

const PRICES = {
  paid: { month: 19, year: 190 },
  featured: { month: 99, year: 990 },
};

export default function BillingPage() {
  const router = useRouter();
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<Interval>("month");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        const attributes = await fetchUserAttributes();
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
            <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
            <p className="text-sm text-gray-500 mt-1">Manage plans for your gym listings</p>
          </div>
          <Link href="/owner" className="text-sm text-brand-orange hover:text-brand-orange-dark font-medium">
            ← Dashboard
          </Link>
        </div>

        {/* Interval toggle */}
        <div className="flex items-center gap-3 mb-6">
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
              Annual <span className="text-green-600 font-semibold text-xs">Save 17%</span>
            </button>
          </div>
        </div>

        {gyms.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">No gym listings found.</p>
        ) : (
          <div className="space-y-3">
            {gyms.map((gym) => {
              const currentPlan =
                gym.stripePlan ?? (gym.isFeatured ? "featured" : gym.isPaid ? "paid" : null);
              const hasActiveSub = !!gym.stripeSubscriptionId;

              return (
                <div
                  key={gym.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{gym.name}</div>
                    <div className="text-sm text-gray-500">{gym.address.suburb}, {gym.address.postcode}</div>
                  </div>

                  {/* Current plan badge */}
                  <div className="shrink-0">
                    {currentPlan === "featured" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                        ★ Featured ${PRICES.featured[interval]}/{interval === "month" ? "mo" : "yr"}
                      </span>
                    ) : currentPlan === "paid" ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
                        ● Paid ${PRICES.paid[interval]}/{interval === "month" ? "mo" : "yr"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                        Free
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    {hasActiveSub ? (
                      <button
                        onClick={handleManage}
                        disabled={busy === "portal"}
                        className="text-sm px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {busy === "portal" ? "Loading…" : "Manage Billing ↗"}
                      </button>
                    ) : (
                      <>
                        {currentPlan !== "paid" && currentPlan !== "featured" && (
                          <button
                            onClick={() => handleUpgrade(gym, "paid")}
                            disabled={busy === `${gym.id}-paid`}
                            className="text-sm px-3 py-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {busy === `${gym.id}-paid` ? "Loading…" : `Paid $${PRICES.paid[interval]}/${interval === "month" ? "mo" : "yr"}`}
                          </button>
                        )}
                        {currentPlan !== "featured" && (
                          <button
                            onClick={() => handleUpgrade(gym, "featured")}
                            disabled={busy === `${gym.id}-featured`}
                            className="text-sm px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {busy === `${gym.id}-featured` ? "Loading…" : `Featured $${PRICES.featured[interval]}/${interval === "month" ? "mo" : "yr"}`}
                          </button>
                        )}
                      </>
                    )}
                    <Link
                      href={`/owner/${gym.id}`}
                      className="text-sm px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Layout>
    </>
  );
}
