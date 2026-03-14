import { useState, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";

interface Form {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  ptName: string;
  ptSuburb: string;
  ptPostcode: string;
  ptPhone: string;
  ptEmail: string;
  ptWebsite: string;
  description: string;
}

const EMPTY: Form = {
  contactName: "", contactEmail: "", contactPhone: "",
  ptName: "", ptSuburb: "", ptPostcode: "",
  ptPhone: "", ptEmail: "", ptWebsite: "",
  description: "",
};

type ListingRole = "pt" | "gym-owner";

export default function ListPTPage() {
  const [role, setRole] = useState<ListingRole>("pt");
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await getCurrentUser();
        const attrs = await fetchUserAttributes();
        const name = attrs.name ?? attrs.given_name ?? "";
        const email = attrs.email ?? "";
        if (name || email) {
          setForm((f) => ({
            ...f,
            contactName: name || f.contactName,
            contactEmail: email || f.contactEmail,
          }));
        }
      } catch {
        // not signed in
      }
    })();
  }, []);

  function set(field: keyof Form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isNewListing: true,
          claimType: "pt",
          gymId: "new",
          gymName: form.ptName,
          gymAddress: `${form.ptSuburb} ${form.ptPostcode}`.trim(),
          gymSuburb: form.ptSuburb,
          gymPostcode: form.ptPostcode,
          gymWebsite: form.ptWebsite,
          gymPhone: form.ptPhone,
          gymEmail: form.ptEmail,
          name: form.contactName,
          email: form.contactEmail,
          phone: form.contactPhone,
          message: role === "gym-owner"
            ? `Submitted by gym owner — PT should be created as unclaimed`
            : "",
          ptDescription: form.description.trim(),
          ptListingRole: role,
        }),
      });
      if (!r.ok) throw new Error("Submission failed");
      setDone(true);
    } catch {
      setError("Something went wrong — please try again.");
    }
    setSubmitting(false);
  }

  if (done) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Listing submitted!</h1>
          <p className="text-gray-500 mb-6">
            Thanks, {form.contactName.split(" ")[0]}. Our team will review your submission and be in touch within 1–2 business days.
          </p>
          <Link href="/" className="text-brand-orange hover:underline text-sm font-medium">
            Back to home
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <>
      <Head>
        <title>Create a PT Listing — mynextgym.com.au</title>
        <meta name="description" content="Create your free personal trainer profile on MyNextGym. Showcase specialties, qualifications and availability to local clients." />
      </Head>
      <Layout>
        <div className="max-w-xl mx-auto">
          <div className="mb-8">
            <Link href="/list" className="text-sm text-brand-orange hover:underline mb-4 inline-block">
              &larr; Back
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Create your PT listing
            </h1>
            <p className="text-gray-500">
              Fill in the details below and our team will create your listing and set up your account. You&apos;ll be able to manage your profile once approved.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Role selector */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b">Who are you?</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRole("pt")}
                  className={`p-4 rounded-xl border-2 text-left transition-colors ${
                    role === "pt" ? "border-brand-orange bg-orange-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-sm">I am the personal trainer</p>
                  <p className="text-xs text-gray-500 mt-0.5">Create my own profile</p>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("gym-owner")}
                  className={`p-4 rounded-xl border-2 text-left transition-colors ${
                    role === "gym-owner" ? "border-brand-orange bg-orange-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-sm">I&apos;m a gym owner</p>
                  <p className="text-xs text-gray-500 mt-0.5">List a trainer at my gym</p>
                </button>
              </div>
              {role === "gym-owner" && (
                <p className="text-xs text-amber-600 mt-3 bg-amber-50 rounded-lg px-3 py-2">
                  The trainer will be listed as unclaimed. The PT can claim their profile and will need to approve the gym affiliation.
                </p>
              )}
            </section>

            {/* Contact details */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b">Your contact details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full name <span className="text-red-500">*</span></label>
                  <input
                    required
                    value={form.contactName}
                    onChange={(e) => set("contactName", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => set("contactEmail", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => set("contactPhone", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
              </div>
            </section>

            {/* PT details */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b">Your training details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your full name (as shown on profile) <span className="text-red-500">*</span></label>
                  <input
                    required
                    value={form.ptName}
                    onChange={(e) => set("ptName", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suburb <span className="text-red-500">*</span></label>
                  <input
                    required
                    value={form.ptSuburb}
                    onChange={(e) => set("ptSuburb", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postcode <span className="text-red-500">*</span></label>
                  <input
                    required
                    value={form.ptPostcode}
                    onChange={(e) => set("ptPostcode", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.ptPhone}
                    onChange={(e) => set("ptPhone", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.ptEmail}
                    onChange={(e) => set("ptEmail", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website or Instagram</label>
                  <input
                    placeholder="https://"
                    value={form.ptWebsite}
                    onChange={(e) => set("ptWebsite", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brief description</label>
                  <textarea
                    rows={3}
                    placeholder="Tell us about your training style, experience, qualifications, and what makes you unique…"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                  />
                </div>
              </div>
            </section>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit listing"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              By submitting you confirm the information provided is accurate. Our team reviews all submissions before going live.
            </p>
          </form>
        </div>
      </Layout>
    </>
  );
}
