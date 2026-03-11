import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import OwnerPTForm from "@/components/OwnerPTForm";
import QualificationVerifyModal from "@/components/QualificationVerifyModal";
import type { OwnerSession, PersonalTrainer } from "@/types";
import { ptUrl } from "@/lib/slugify";

function PlanBanner({ pt }: { pt: PersonalTrainer }) {
  const currentPlan =
    pt.stripePlan ?? (pt.isFeatured ? "featured" : pt.isPaid ? "paid" : null);

  if (currentPlan === "featured") {
    return (
      <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
        <span className="text-sm font-medium text-amber-800">★ Featured PT Profile</span>
        <Link href="/billing" className="text-sm text-amber-700 hover:text-amber-900 font-medium underline">
          Manage billing →
        </Link>
      </div>
    );
  }

  if (currentPlan === "paid") {
    return (
      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
        <span className="text-sm font-medium text-green-800">● Basic PT Profile</span>
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

export default function EditPTPage() {
  const router = useRouter();
  const { ptId } = router.query;

  const [session, setSession] = useState<OwnerSession | null>(null);
  const [pt, setPt] = useState<PersonalTrainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showVerify, setShowVerify] = useState(false);

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
    if (!ptId || !session) return;

    async function loadPT() {
      try {
        const r = await fetch(`/api/owner/pt/${ptId}`);
        if (!r.ok) throw new Error("Not found");
        const data: PersonalTrainer = await r.json();
        if (data.ownerId !== session!.ownerId) {
          setError("You don't have permission to edit this PT profile.");
          setLoading(false);
          return;
        }
        setPt(data);
        setLoading(false);
      } catch {
        setError("PT profile not found.");
        setLoading(false);
      }
    }

    loadPT();
  }, [ptId, session]);

  async function handleSave(updated: PersonalTrainer): Promise<string | undefined> {
    const r = await fetch(`/api/owner/pt/${ptId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updated, ownerEmail: session?.email }),
    });
    const body = await r.json().catch(() => ({}));
    if (body?.queued) {
      return "Changes submitted for review — a team member will approve shortly.";
    }
    setPt(updated);
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20 text-gray-400">Loading...</div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-red-500 text-lg mb-4">{error}</p>
          <Link href="/owner" className="text-brand-orange hover:underline">Back to dashboard</Link>
        </div>
      </Layout>
    );
  }

  if (!pt) return null;

  return (
    <>
      <Head>
        <title>Edit {pt.name} — mynextgym.com.au</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <Layout>
        <nav className="text-sm text-gray-500 mb-6">
          <Link href="/owner" className="hover:text-brand-orange">Dashboard</Link>
          {" / "}
          <Link href="/billing" className="hover:text-brand-orange">Billing</Link>
          {" / "}
          <span className="text-gray-800 font-medium">Edit {pt.name}</span>
        </nav>

        <div className="max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Edit PT Profile</h1>
            <Link
              href={ptUrl(pt)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-orange hover:text-brand-orange-dark font-medium flex items-center gap-1"
            >
              View Page →
            </Link>
          </div>

          <PlanBanner pt={pt} />

          <OwnerPTForm pt={pt} onSave={handleSave} onVerifyQualifications={() => setShowVerify(true)} ownerEmail={session?.email} />
        </div>

        {showVerify && pt && (
          <QualificationVerifyModal
            ptId={pt.id}
            ptName={pt.name}
            qualifications={pt.qualifications}
            verifiedQualifications={pt.qualificationsVerifiedList ?? []}
            onClose={() => setShowVerify(false)}
          />
        )}
      </Layout>
    </>
  );
}
