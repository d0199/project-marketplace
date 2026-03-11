import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import OwnerGymForm from "@/components/OwnerGymForm";
import type { OwnerSession, Gym } from "@/types";

function PlanBanner({ gym }: { gym: Gym }) {
  const currentPlan =
    gym.stripePlan ?? (gym.isFeatured ? "featured" : gym.isPaid ? "paid" : null);

  if (currentPlan === "featured") {
    return (
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
        <span className="text-sm font-medium text-amber-800">★ Featured Listing</span>
        <Link href="/billing" className="text-sm text-amber-700 hover:text-amber-900 font-medium underline">
          Manage billing →
        </Link>
      </div>
    );
  }

  if (currentPlan === "paid") {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
        <span className="text-sm font-medium text-green-800">● Paid Listing</span>
        <Link href="/billing" className="text-sm text-green-700 hover:text-green-900 font-medium underline">
          Manage billing →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 mr-2">Current plan</span>
        <span className="text-sm font-semibold text-gray-700">Free</span>
        <span className="text-sm text-gray-500 ml-2">— unlock contact form, social links &amp; more</span>
      </div>
      <Link
        href="/billing"
        className="text-sm bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
      >
        Upgrade →
      </Link>
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
    const billingSuccess = typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("billing") === "success";

    async function loadGym(retries = 8, delay = 500): Promise<void> {
      try {
        const r = await fetch(`/api/owner/gym/${gymId}`);
        if (!r.ok) throw new Error("Not found");
        const data: Gym = await r.json();
        if (data.ownerId !== session!.ownerId) {
          setError("You don't have permission to edit this gym.");
          setLoading(false);
          return;
        }
        // After billing success, wait until isPaid/isFeatured is set
        if (billingSuccess && !data.isPaid && !data.isFeatured && retries > 0) {
          setTimeout(() => loadGym(retries - 1, delay), delay);
          return;
        }
        setGym(data);
        setLoading(false);
      } catch {
        setError("Gym not found.");
        setLoading(false);
      }
    }

    loadGym();
  }, [gymId, session, router.query.billing]);

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
              href={`/gym/${gym.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-orange hover:text-brand-orange-dark font-medium flex items-center gap-1"
            >
              View Page →
            </Link>
          </div>

          <PlanBanner gym={gym} />

          <OwnerGymForm gym={gym} onSave={handleSave} gymId={gym.id} />
        </div>
      </Layout>
    </>
  );
}
