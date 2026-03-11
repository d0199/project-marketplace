import { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import { ptStore } from "@/lib/ptStore";
import type { PersonalTrainer } from "@/types";
import { trackEvent } from "@/lib/gtag";

interface Props {
  pts: Pick<PersonalTrainer, "id" | "name" | "address" | "email" | "specialties">[];
}

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const all = await ptStore.getAll();
  return {
    props: {
      pts: all
        .filter((p) => p.isActive !== false && !p.isTest)
        .map(({ id, name, address, email, specialties }) => ({
          id, name, address, email, specialties,
        })),
    },
  };
};

interface ClaimForm {
  name: string;
  email: string;
  phone: string;
  message: string;
}

export default function ClaimPTPage({ pts }: Props) {
  const [search, setSearch] = useState("");
  const [claimTarget, setClaimTarget] = useState<Props["pts"][0] | null>(null);
  const [form, setForm] = useState<ClaimForm>({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [emailExists, setEmailExists] = useState(false);

  // Pre-fill email/name if logged in
  useEffect(() => {
    getCurrentUser()
      .then(() => fetchUserAttributes())
      .then((attrs) => {
        setLoggedIn(true);
        setForm((f) => ({
          ...f,
          email: attrs.email ?? f.email,
          name: attrs.name ?? attrs.email ?? f.name,
        }));
      })
      .catch(() => {});
  }, []);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return pts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.address.suburb.toLowerCase().includes(q) ||
        p.address.postcode.includes(q) ||
        p.specialties.some((s) => s.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [search, pts]);

  function setField(field: keyof ClaimForm, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openClaim(pt: Props["pts"][0]) {
    setClaimTarget(pt);
    setDone(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function checkEmail(val: string) {
    if (!val || loggedIn) return;
    try {
      const r = await fetch(`/api/auth/check-email?email=${encodeURIComponent(val)}`);
      const data = await r.json();
      setEmailExists(data.exists === true);
    } catch { /* ignore */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailExists) return;
    if (!loggedIn && form.email) {
      try {
        const r = await fetch(`/api/auth/check-email?email=${encodeURIComponent(form.email)}`);
        const data = await r.json();
        if (data.exists === true) { setEmailExists(true); return; }
      } catch { /* proceed */ }
    }
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: claimTarget!.id,
          gymName: claimTarget!.name,
          gymAddress: `${claimTarget!.address.suburb} ${claimTarget!.address.postcode}`,
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: form.message,
          claimType: "pt",
        }),
      });
      if (!r.ok) throw new Error();
      setDone(true);
      trackEvent("claim_submitted", { claim_type: "pt", item_id: claimTarget!.id, item_name: claimTarget!.name });
    } catch {
      setError("Something went wrong — please try again.");
    }
    setSubmitting(false);
  }

  return (
    <>
      <Head>
        <title>Claim Your PT Profile — mynextgym.com.au</title>
        <meta name="description" content="Personal trainer listed on MyNextGym? Claim your free profile to manage specialties, rates and client enquiries." />
      </Head>
      <Layout>
        <div className="max-w-xl mx-auto">

          {/* Claim form (shown after selecting a PT) */}
          {claimTarget && (
            <div className="mb-8">
              {done ? (
                <div className="bg-white rounded-2xl border p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Claim submitted!</h2>
                  <p className="text-gray-500 text-sm mb-4">
                    Our team will review your claim for <strong>{claimTarget.name}</strong> and be in touch shortly.
                  </p>
                  <button
                    onClick={() => { setClaimTarget(null); setSearch(""); }}
                    className="text-brand-orange hover:underline text-sm font-medium"
                  >
                    Claim another profile
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Claim: {claimTarget.name}</h2>
                      <p className="text-sm text-gray-400">{claimTarget.address.suburb}, {claimTarget.address.postcode}</p>
                    </div>
                    <button onClick={() => setClaimTarget(null)} className="text-gray-400 hover:text-gray-600 text-sm">
                      Cancel
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Your name <span className="text-red-500">*</span></label>
                        <input required value={form.name} onChange={(e) => setField("name", e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                        <input required type="email" value={form.email}
                          onChange={(e) => { setField("email", e.target.value); setEmailExists(false); }}
                          onBlur={(e) => checkEmail(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                        {emailExists && (
                          <div className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            An account with this email already exists.{" "}
                            <Link href={`/owner?redirect=${encodeURIComponent("/claim-pt")}`} className="text-brand-orange hover:underline font-semibold">Sign in</Link>{" "}
                            to link this claim to your account automatically.
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Message <span className="text-xs text-gray-400">(optional)</span></label>
                      <textarea rows={3} value={form.message} onChange={(e) => setField("message", e.target.value)}
                        placeholder="Tell us about yourself and any details to help verify this is your profile…"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none" />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <button type="submit" disabled={submitting}
                      className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                      {submitting ? "Submitting…" : "Submit Claim"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* Search */}
          {!claimTarget && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Claim your PT profile</h1>
                <p className="text-gray-500">
                  Search for your profile below. Once approved, you&apos;ll be able to manage your listing and connect with gyms.
                </p>
              </div>

              <div className="relative mb-6">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, suburb, postcode or specialty…"
                  className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  autoFocus
                />
              </div>

              {search.trim() && results.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-gray-500 mb-4">No personal trainers found for &ldquo;{search}&rdquo;.</p>
                  <p className="text-sm text-gray-400">
                    Not listed yet? Contact us at{" "}
                    <a href="mailto:hello@mynextgym.com.au" className="text-brand-orange hover:underline font-medium">
                      hello@mynextgym.com.au
                    </a>
                  </p>
                </div>
              )}

              {results.length > 0 && (
                <div className="space-y-3">
                  {results.map((pt) => (
                    <div key={pt.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900">{pt.name}</p>
                        <p className="text-sm text-gray-400">{pt.address.suburb}, {pt.address.state} {pt.address.postcode}</p>
                        {pt.specialties.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">{pt.specialties.slice(0, 3).join(", ")}{pt.specialties.length > 3 ? "…" : ""}</p>
                        )}
                      </div>
                      <button
                        onClick={() => openClaim(pt)}
                        className="shrink-0 px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        Claim
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!search.trim() && (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-sm">Start typing to search for your profile</p>
                </div>
              )}
            </>
          )}

        </div>
      </Layout>
    </>
  );
}
