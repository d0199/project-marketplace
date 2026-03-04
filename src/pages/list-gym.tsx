import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Layout from "@/components/Layout";

interface Form {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  gymName: string;
  gymSuburb: string;
  gymPostcode: string;
  gymPhone: string;
  gymEmail: string;
  gymWebsite: string;
  description: string;
}

const EMPTY: Form = {
  contactName: "", contactEmail: "", contactPhone: "",
  gymName: "", gymSuburb: "", gymPostcode: "",
  gymPhone: "", gymEmail: "", gymWebsite: "", description: "",
};

export default function ListGymPage() {
  const [form, setForm] = useState<Form>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

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
          gymId: "new",
          gymName: form.gymName,
          gymAddress: `${form.gymSuburb} ${form.gymPostcode}`.trim(),
          gymSuburb: form.gymSuburb,
          gymPostcode: form.gymPostcode,
          gymWebsite: form.gymWebsite,
          gymPhone: form.gymPhone,
          gymEmail: form.gymEmail,
          name: form.contactName,
          email: form.contactEmail,
          phone: form.contactPhone,
          message: form.description,
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
        <title>List Your Gym — mynextgym.com.au</title>
      </Head>
      <Layout>
        <div className="max-w-xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              List your gym — it&apos;s free
            </h1>
            <p className="text-gray-500">
              Fill in the details below and our team will create your listing and set up your owner account. You&apos;ll be able to manage your profile once approved.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Your details */}
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

            {/* Gym details */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b">Gym details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gym name <span className="text-red-500">*</span></label>
                  <input
                    required
                    value={form.gymName}
                    onChange={(e) => set("gymName", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suburb <span className="text-red-500">*</span></label>
                  <input
                    required
                    value={form.gymSuburb}
                    onChange={(e) => set("gymSuburb", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postcode <span className="text-red-500">*</span></label>
                  <input
                    required
                    value={form.gymPostcode}
                    onChange={(e) => set("gymPostcode", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gym phone</label>
                  <input
                    type="tel"
                    value={form.gymPhone}
                    onChange={(e) => set("gymPhone", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gym email</label>
                  <input
                    type="email"
                    value={form.gymEmail}
                    onChange={(e) => set("gymEmail", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                  <input
                    type="url"
                    placeholder="https://"
                    value={form.gymWebsite}
                    onChange={(e) => set("gymWebsite", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brief description</label>
                  <textarea
                    rows={3}
                    placeholder="Tell us a bit about your gym — facilities, membership types, what makes you unique…"
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
              By submitting you confirm you are authorised to list this gym. Our team reviews all submissions before going live.
            </p>
          </form>
        </div>
      </Layout>
    </>
  );
}
