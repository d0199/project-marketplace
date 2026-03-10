import { useState } from "react";
import Link from "next/link";

interface ClaimablePT {
  id: string;
  name: string;
  address: { suburb: string; state: string; postcode: string };
  specialties: string[];
}

interface Props {
  pt: ClaimablePT;
  onClose: () => void;
  initialEmail?: string;
  initialName?: string;
}

type Status = "idle" | "submitting" | "success" | "error";

export default function PTClaimModal({ pt, onClose, initialEmail = "", initialName = "" }: Props) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [emailExists, setEmailExists] = useState(false);

  async function checkEmail(val: string) {
    if (!val || initialEmail) return;
    try {
      const r = await fetch(`/api/auth/check-email?email=${encodeURIComponent(val)}`);
      const data = await r.json();
      setEmailExists(data.exists === true);
    } catch { /* ignore */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailExists) return;
    // Re-check email on submit in case blur didn't fire
    if (!initialEmail && email) {
      try {
        const r = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
        const data = await r.json();
        if (data.exists === true) {
          setEmailExists(true);
          return;
        }
      } catch { /* proceed if check fails */ }
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: pt.id,
          gymName: pt.name,
          gymAddress: `${pt.address.suburb} ${pt.address.state} ${pt.address.postcode}`,
          claimType: "pt",
          name,
          email,
          phone,
          message,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Claim this profile</h2>
            <p className="text-sm text-gray-500 mt-0.5">{pt.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {status === "success" ? (
          <div className="p-8 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="font-semibold text-gray-900 text-lg mb-1">Request received</h3>
            <p className="text-gray-500 text-sm">
              Our team will review your claim and get back to you at{" "}
              <strong>{email}</strong> within 2 business days.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-brand-orange text-white rounded-lg text-sm font-semibold hover:bg-brand-orange-dark transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Pre-populated PT info */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-0.5">
              <p className="font-medium text-gray-800">{pt.name}</p>
              <p>
                {pt.address.suburb}, {pt.address.state} {pt.address.postcode}
              </p>
              {pt.specialties.length > 0 && (
                <p className="text-gray-500">{pt.specialties.slice(0, 3).join(", ")}</p>
              )}
            </div>

            {initialEmail ? (
              <p className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                Signed in as <strong>{initialEmail}</strong>
              </p>
            ) : (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Already have an account?{" "}
                <Link href={`/owner?redirect=${encodeURIComponent(`/pt/${pt.id}?claim=true`)}`} className="text-brand-orange hover:underline font-medium">
                  Sign in first
                </Link>{" "}
                to speed up the process.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your name <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email address <span className="text-red-500">*</span>
              </label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailExists(false); }}
                onBlur={(e) => checkEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                placeholder="jane@example.com"
              />
              {emailExists && (
                <div className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  An account with this email already exists.{" "}
                  <Link href={`/owner?redirect=${encodeURIComponent(`/pt/${pt.id}?claim=true`)}`} className="text-brand-orange hover:underline font-semibold">
                    Sign in
                  </Link>{" "}
                  to link this claim to your account automatically.
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone number{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                placeholder="04xx xxx xxx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                placeholder="Tell us about yourself and your training experience…"
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-red-500">
                Something went wrong. Please try again.
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="flex-1 px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {status === "submitting" ? "Sending…" : "Submit Claim"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
