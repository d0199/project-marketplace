import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import OwnerGymForm from "@/components/OwnerGymForm";
import type { OwnerSession, Gym } from "@/types";

type Interval = "month" | "year";

const PLANS = {
  paid: { label: "Paid Listing", monthly: 19, annual: 190 },
  featured: { label: "Featured Listing", monthly: 99, annual: 990 },
} as const;

function PlanCard({
  gym,
  session,
}: {
  gym: Gym;
  session: OwnerSession;
}) {
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("month");
  const [featuredAvailable, setFeaturedAvailable] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Show success toast on return from Stripe checkout
  useEffect(() => {
    if (router.query.billing === "success") {
      setToast("Billing activated! Your plan is now live.");
      // Remove query param without reload
      router.replace(`/owner/${gym.id}`, undefined, { shallow: true });
    }
  }, [router, gym.id]);

  useEffect(() => {
    if (!gym.isFeatured) {
      fetch(`/api/billing/featured-slots?postcode=${gym.address.postcode}&gymId=${gym.id}`)
        .then((r) => r.json())
        .then((d) => setFeaturedAvailable(d.available))
        .catch(() => {});
    }
  }, [gym.address.postcode, gym.isFeatured, gym.id]);

  async function handleUpgrade(plan: "paid" | "featured") {
    setBusy(plan);
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
    setBusy("portal");
    try {
      const baseUrl = window.location.origin;
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: session.email, returnUrl: `${baseUrl}/owner/${gym.id}` }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("Network error. Please try again.");
    }
    setBusy(null);
  }

  const currentPlan = gym.stripePlan ?? (gym.isFeatured ? "featured" : gym.isPaid ? "paid" : null);

  const planLabel =
    currentPlan === "featured"
      ? "★ Featured"
      : currentPlan === "paid"
      ? "● Paid"
      : "Free";

  const planBadgeClass =
    currentPlan === "featured"
      ? "bg-amber-100 text-amber-800"
      : currentPlan === "paid"
      ? "bg-green-100 text-green-800"
      : "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      {toast && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-green-600 hover:text-green-800 ml-4">✕</button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Current plan:</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planBadgeClass}`}>
            {planLabel}
          </span>
        </div>
        {/* Monthly / Annual toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-1 text-xs font-medium">
          <button
            onClick={() => setInterval("month")}
            className={`px-3 py-1 rounded-md transition-colors ${
              interval === "month" ? "bg-white shadow text-gray-900" : "text-gray-500"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval("year")}
            className={`px-3 py-1 rounded-md transition-colors ${
              interval === "year" ? "bg-white shadow text-gray-900" : "text-gray-500"
            }`}
          >
            Annual <span className="text-green-600 font-semibold">−17%</span>
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Paid Listing */}
        <div className={`border rounded-lg p-4 ${currentPlan === "paid" ? "border-green-400 bg-green-50" : "border-gray-200"}`}>
          <div className="font-semibold text-gray-900 mb-0.5">Paid Listing</div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            ${interval === "month" ? PLANS.paid.monthly : PLANS.paid.annual}
            <span className="text-sm font-normal text-gray-500">/{interval === "month" ? "mo" : "yr"}</span>
          </div>
          <ul className="text-xs text-gray-600 space-y-0.5 mb-4">
            <li>✓ Contact form</li>
            <li>✓ Social links</li>
            <li>✓ Hours comment</li>
            <li>✓ Member offers</li>
          </ul>
          {currentPlan === "paid" ? (
            <button
              onClick={handleManage}
              disabled={busy === "portal"}
              className="w-full text-sm py-1.5 border border-green-400 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              {busy === "portal" ? "Loading…" : "Manage Billing ↗"}
            </button>
          ) : currentPlan === "featured" ? (
            <button
              onClick={handleManage}
              disabled={busy === "portal"}
              className="w-full text-sm py-1.5 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {busy === "portal" ? "Loading…" : "Switch Plan ↗"}
            </button>
          ) : (
            <button
              onClick={() => handleUpgrade("paid")}
              disabled={busy === "paid"}
              className="w-full text-sm py-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {busy === "paid" ? "Loading…" : "Upgrade to Paid"}
            </button>
          )}
        </div>

        {/* Featured Listing */}
        <div className={`border rounded-lg p-4 ${currentPlan === "featured" ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}>
          <div className="font-semibold text-gray-900 mb-0.5">Featured Listing</div>
          <div className="text-2xl font-bold text-gray-900 mb-1">
            ${interval === "month" ? PLANS.featured.monthly : PLANS.featured.annual}
            <span className="text-sm font-normal text-gray-500">/{interval === "month" ? "mo" : "yr"}</span>
          </div>
          <ul className="text-xs text-gray-600 space-y-0.5 mb-4">
            <li>✓ All Paid features</li>
            <li>★ Pinned to top of results</li>
            <li className={!featuredAvailable ? "text-red-500" : ""}>
              {featuredAvailable ? "✓ Slots available" : "✗ No slots in your postcode"}
            </li>
          </ul>
          {currentPlan === "featured" ? (
            <button
              onClick={handleManage}
              disabled={busy === "portal"}
              className="w-full text-sm py-1.5 border border-amber-400 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {busy === "portal" ? "Loading…" : "Manage Billing ↗"}
            </button>
          ) : (
            <button
              onClick={() => handleUpgrade("featured")}
              disabled={busy === "featured" || !featuredAvailable}
              title={!featuredAvailable ? "All 3 featured slots for this postcode are taken" : undefined}
              className="w-full text-sm py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy === "featured" ? "Loading…" : "Upgrade to Featured"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EditGymPage() {
  const router = useRouter();
  const { gymId } = router.query;

  const [session, setSession] = useState<OwnerSession | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      .catch(() => {
        router.replace("/owner");
      });
  }, [router]);

  useEffect(() => {
    if (!gymId || !session) return;
    fetch(`/api/owner/gym/${gymId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data: Gym) => {
        if (data.ownerId !== session.ownerId) {
          setError("You don't have permission to edit this gym.");
        } else {
          setGym(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Gym not found.");
        setLoading(false);
      });
  }, [gymId, session]);

  async function handleSave(updated: Gym): Promise<string | undefined> {
    const r = await fetch(`/api/owner/gym/${gymId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updated, ownerEmail: session?.email }),
    });
    const body = await r.json().catch(() => ({}));
    if (body?.queued) {
      return "Changes submitted for review — a team member will approve shortly.";
    }
    setGym(updated);
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20 text-gray-400">
          Loading…
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-red-500 text-lg mb-4">{error}</p>
          <Link href="/owner" className="text-brand-orange hover:underline">
            Back to dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  if (!gym) return null;

  return (
    <>
      <Head>
        <title>Edit {gym.name} — mynextgym.com.au</title>
      </Head>
      <Layout>
        <nav className="text-sm text-gray-500 mb-6">
          <Link href="/owner" className="hover:text-brand-orange">
            Dashboard
          </Link>
          {" / "}
          <Link href="/billing" className="hover:text-brand-orange">
            Billing
          </Link>
          {" / "}
          <span className="text-gray-800 font-medium">Edit {gym.name}</span>
        </nav>

        <div className="max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Edit Gym Profile</h1>
            <Link
              href={`/gym/${gym.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-orange hover:text-brand-orange-dark font-medium flex items-center gap-1"
            >
              View Page ↗
            </Link>
          </div>

          {session && <PlanCard gym={gym} session={session} />}

          <OwnerGymForm gym={gym} onSave={handleSave} gymId={gym.id} />
        </div>
      </Layout>
    </>
  );
}
