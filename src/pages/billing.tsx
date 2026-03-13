import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { getCurrentUser, fetchUserAttributes, signOut } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import LeadsTab from "@/components/LeadsTab";
import AnalyticsTab from "@/components/AnalyticsTab";
import GymAffiliationsTab from "@/components/GymAffiliationsTab";
import PTAffiliationsTab from "@/components/PTAffiliationsTab";
import type { OwnerSession, Gym, PersonalTrainer } from "@/types";
import BulkEditModal from "@/components/BulkEditModal";
import QualificationVerifyModal from "@/components/QualificationVerifyModal";
import { gymUrl, ptUrl } from "@/lib/slugify";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type Tab = "billing" | "leads" | "analytics" | "affiliations";
type Interval = "month" | "year";

interface OwnerClaim {
  id: string;
  gymId: string;
  gymName?: string;
  gymAddress?: string;
  gymSuburb?: string;
  gymPostcode?: string;
  claimantName: string;
  claimantEmail: string;
  message?: string;
  status: string;
  notes?: string;
  claimType?: string;
  isNewListing?: boolean;
  claimantNote?: string;
  createdAt?: string;
  updatedAt?: string;
}
type TierFilter = "all" | "free" | "paid" | "featured";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const PRICES = {
  paid: { month: 19, year: 190 },
  featured: { month: 99, year: 990 },
};

const PT_PRICES = {
  paid: { month: 12, year: 120 },
  featured: { month: 59, year: 590 },
};

const PAID_FEATURES = [
  "Contact enquiry form",
  "Social media links",
  "Hours comment / notes",
  "Member offers",
  "Specialties tags",
];

const FEATURED_FEATURES = [
  "Pinned to top of search results",
  "Rotated among max 3 per postcode",
];

const PT_PAID_FEATURES = [
  "Contact enquiry form",
  "Social media links",
  "Booking link",
  "Qualifications display",
  "Specialties tags",
];

const PT_FEATURED_FEATURES = [
  "Pinned to top of search results",
  "Featured badge on profile",
];

// ─────────────────────────────────────────────────────────────────────────────
// PriceTag
// ─────────────────────────────────────────────────────────────────────────────
function PriceTag({ plan, interval }: { plan: "paid" | "featured"; interval: Interval }) {
  const price = PRICES[plan][interval];
  const monthly =
    interval === "year" ? Math.round(PRICES[plan].year / 12) : PRICES[plan].month;
  return (
    <div>
      <span className="text-3xl font-bold text-gray-900">${price}</span>
      <span className="text-sm text-gray-500">/{interval === "month" ? "mo" : "yr"}</span>
      {interval === "year" && (
        <div className="text-xs text-green-600 font-medium mt-0.5">
          ${monthly}/mo — 2 months free
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan badge (shown in header when card is collapsed)
// ─────────────────────────────────────────────────────────────────────────────
function PlanBadge({ plan }: { plan: string | null }) {
  if (!plan)
    return (
      <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2 py-0.5 rounded-full">
        Free
      </span>
    );
  if (plan === "paid")
    return (
      <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
        Paid
      </span>
    );
  return (
    <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
      Featured
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GymRow
// ─────────────────────────────────────────────────────────────────────────────
function GymRow({
  gym,
  interval,
  busy,
  collapsed,
  onToggleCollapse,
  onUpgrade,
  onManage,
  onCancel,
  bulkMode,
  bulkSelected,
  onBulkToggle,
}: {
  gym: Gym;
  interval: Interval;
  busy: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onUpgrade: (gym: Gym, plan: "paid" | "featured") => void;
  onManage: () => void;
  onCancel: (gym: Gym) => void;
  bulkMode?: boolean;
  bulkSelected?: boolean;
  onBulkToggle?: () => void;
}) {
  const currentPlan =
    gym.stripePlan ?? (gym.isFeatured ? "featured" : gym.isPaid ? "paid" : null);
  const hasBillingAccount = !!gym.stripeSubscriptionId;

  // Check featured slot availability for this gym's postcode
  const [featuredAvailable, setFeaturedAvailable] = useState(true);
  const [slotsUsed, setSlotsUsed] = useState(0);
  useEffect(() => {
    if (currentPlan === "featured") return; // already featured, no need to check
    const pc = gym.address?.postcode;
    if (!pc) return;
    fetch(`/api/billing/featured-slots?postcode=${pc}&gymId=${gym.id}`)
      .then((r) => r.json())
      .then((data) => {
        setFeaturedAvailable(data.available);
        setSlotsUsed(data.count);
      })
      .catch(() => {});
  }, [gym.id, gym.address?.postcode, currentPlan]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Gym header — always visible */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          {bulkMode && (
            <input
              type="checkbox"
              checked={bulkSelected ?? false}
              onChange={onBulkToggle}
              className="w-4.5 h-4.5 accent-brand-orange shrink-0 cursor-pointer"
            />
          )}
          <div>
          <div className="font-semibold text-gray-900">{gym.name}</div>
          <div className="text-sm text-gray-500">
            {gym.address.suburb}, {gym.address.state} {gym.address.postcode}
          </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PlanBadge plan={currentPlan} />
          {!bulkMode && (
          <Link
            href={`/owner/${gym.id}`}
            className="text-sm font-bold text-gray-700 hover:text-brand-orange transition-colors"
          >
            Edit listing →
          </Link>
          )}
          {!bulkMode && (
          <Link
            href={gymUrl(gym)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold text-gray-500 hover:text-brand-orange transition-colors"
          >
            View profile →
          </Link>
          )}
          {!bulkMode && (
          <button
            onClick={onToggleCollapse}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={collapsed ? "Expand plan options" : "Collapse plan options"}
          >
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${
                collapsed ? "-rotate-90" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          )}
        </div>
      </div>

      {/* Plan columns — collapsible (hidden in bulk mode) */}
      {!collapsed && !bulkMode && (
        <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">

          {/* Free */}
          <div className={`p-5 flex flex-col ${!currentPlan ? "bg-gray-50" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">Free</span>
              {!currentPlan && (
                <span className="text-xs bg-gray-200 text-gray-600 font-semibold px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}
            </div>
            <div className="text-2xl font-bold text-gray-400 mb-3">$0</div>
            <ul className="space-y-1.5 text-xs text-gray-400 flex-1">
              <li>✓ Basic listing</li>
              <li>✓ Search visibility</li>
              <li className="text-gray-300">✗ Contact form</li>
              <li className="text-gray-300">✗ Social links</li>
              <li className="text-gray-300">✗ Member offers</li>
              <li className="text-gray-300">✗ Specialties</li>
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
                <span className="text-xs bg-green-200 text-green-800 font-semibold px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}
            </div>
            <div className="mb-3">
              <PriceTag plan="paid" interval={interval} />
            </div>
            <ul className="space-y-1.5 text-xs text-gray-600 flex-1">
              <li>✓ Basic listing</li>
              <li>✓ Improved search visibility</li>
              {PAID_FEATURES.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
              <li className="text-gray-300">✗ Featured placement</li>
            </ul>
            <div className="mt-4">
              {currentPlan === "paid" ? (
                hasBillingAccount ? (
                  <button
                    onClick={onManage}
                    disabled={busy === "portal"}
                    className="w-full text-sm py-2 border border-green-400 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    {busy === "portal" ? "Loading…" : "Manage Billing ↗"}
                  </button>
                ) : (
                  <div className="w-full text-sm py-2 text-center text-green-700 bg-green-50 rounded-lg font-medium">
                    Complimentary
                  </div>
                )
              ) : currentPlan === "featured" ? (
                hasBillingAccount ? (
                  <button
                    onClick={onManage}
                    disabled={busy === "portal"}
                    className="w-full text-sm py-2 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {busy === "portal" ? "Loading…" : "Switch plan ↗"}
                  </button>
                ) : (
                  <div className="w-full text-sm py-2 text-center text-amber-700 bg-amber-50 rounded-lg font-medium">
                    Complimentary
                  </div>
                )
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
          <div
            className={`p-5 flex flex-col ${
              currentPlan === "featured" ? "bg-amber-50" : ""
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">Featured</span>
              {currentPlan === "featured" && (
                <span className="text-xs bg-amber-200 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}
            </div>
            <div className="mb-3">
              <PriceTag plan="featured" interval={interval} />
            </div>
            <ul className="space-y-1.5 text-xs text-gray-600 flex-1">
              <li>✓ Basic listing</li>
              <li>✓ Improved search visibility</li>
              {PAID_FEATURES.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
              {FEATURED_FEATURES.map((f) => (
                <li key={f} className="font-medium text-amber-700">
                  ★ {f}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              {currentPlan === "featured" ? (
                hasBillingAccount ? (
                  <button
                    onClick={onManage}
                    disabled={busy === "portal"}
                    className="w-full text-sm py-2 border border-amber-400 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    {busy === "portal" ? "Loading…" : "Manage Billing ↗"}
                  </button>
                ) : (
                  <div className="w-full text-sm py-2 text-center text-amber-700 bg-amber-50 rounded-lg font-medium">
                    Complimentary
                  </div>
                )
              ) : featuredAvailable ? (
                <button
                  onClick={() => onUpgrade(gym, "featured")}
                  disabled={busy === `${gym.id}-featured`}
                  className="w-full text-sm py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {busy === `${gym.id}-featured` ? "Loading…" : "Upgrade to Featured"}
                </button>
              ) : (
                <div className="text-center">
                  <div className="w-full text-sm py-2 text-gray-400 bg-gray-100 rounded-lg font-medium">
                    Slots Full ({slotsUsed}/3)
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    All featured slots for {gym.address.postcode} are taken
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PTRow
// ─────────────────────────────────────────────────────────────────────────────
function PTRow({
  pt,
  interval,
  busy,
  collapsed,
  onToggleCollapse,
  onUpgrade,
  onManage,
  onCancel,
  onVerify,
}: {
  pt: PersonalTrainer;
  interval: Interval;
  busy: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onUpgrade: (pt: PersonalTrainer, plan: "paid" | "featured") => void;
  onManage: () => void;
  onCancel: (pt: PersonalTrainer) => void;
  onVerify?: () => void;
}) {
  const currentPlan =
    pt.stripePlan ?? (pt.isFeatured ? "featured" : pt.isPaid ? "paid" : null);
  const hasBillingAccount = !!pt.stripeSubscriptionId;

  function PTPrice({ plan, interval: iv }: { plan: "paid" | "featured"; interval: Interval }) {
    const price = PT_PRICES[plan][iv];
    const monthly = iv === "year" ? Math.round(PT_PRICES[plan].year / 12) : PT_PRICES[plan].month;
    return (
      <div>
        <span className="text-3xl font-bold text-gray-900">${price}</span>
        <span className="text-sm text-gray-500">/{iv === "month" ? "mo" : "yr"}</span>
        {iv === "year" && (
          <div className="text-xs text-green-600 font-medium mt-0.5">
            ${monthly}/mo — 2 months free
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* PT header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">PT</span>
            <span className="font-semibold text-gray-900">{pt.name}</span>
          </div>
          <div className="text-sm text-gray-500">
            {pt.address.suburb}, {pt.address.state} {pt.address.postcode}
          </div>
          {!pt.qualificationsVerified && pt.qualifications.length > 0 && (
            <button
              onClick={() => onVerify?.()}
              className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 font-medium hover:bg-amber-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Verify qualifications
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <PlanBadge plan={currentPlan} />
          <Link
            href={`/owner/pt/${pt.id}`}
            className="text-sm font-bold text-gray-700 hover:text-brand-orange transition-colors"
          >
            Edit listing →
          </Link>
          <Link
            href={ptUrl(pt)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold text-gray-500 hover:text-brand-orange transition-colors"
          >
            View profile →
          </Link>
          <button
            onClick={onToggleCollapse}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={collapsed ? "Expand plan options" : "Collapse plan options"}
          >
            <svg
              className={`w-5 h-5 transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Plan columns */}
      {!collapsed && (
        <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
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
              <li className="text-gray-300">✗ Specialties</li>
              <li className="text-gray-300">✗ Featured placement</li>
            </ul>
            {currentPlan && (
              <div className="mt-4">
                <button
                  onClick={() => onCancel(pt)}
                  disabled={busy === `${pt.id}-cancel`}
                  className="w-full text-xs py-2 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                >
                  {busy === `${pt.id}-cancel` ? "Cancelling…" : "Downgrade to Free"}
                </button>
              </div>
            )}
          </div>

          {/* Paid ($12) */}
          <div className={`p-5 flex flex-col ${currentPlan === "paid" ? "bg-green-50" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">Paid</span>
              {currentPlan === "paid" && (
                <span className="text-xs bg-green-200 text-green-800 font-semibold px-2 py-0.5 rounded-full">Current</span>
              )}
            </div>
            <div className="mb-3">
              <PTPrice plan="paid" interval={interval} />
            </div>
            <ul className="space-y-1.5 text-xs text-gray-600 flex-1">
              <li>✓ Basic listing</li>
              <li>✓ Improved search visibility</li>
              {PT_PAID_FEATURES.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
              <li className="text-gray-300">✗ Featured placement</li>
            </ul>
            <div className="mt-4">
              {currentPlan === "paid" ? (
                hasBillingAccount ? (
                  <button
                    onClick={onManage}
                    disabled={busy === "portal"}
                    className="w-full text-sm py-2 border border-green-400 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    {busy === "portal" ? "Loading…" : "Manage Billing ↗"}
                  </button>
                ) : (
                  <div className="w-full text-sm py-2 text-center text-green-700 bg-green-50 rounded-lg font-medium">
                    Complimentary
                  </div>
                )
              ) : currentPlan === "featured" ? (
                hasBillingAccount ? (
                  <button
                    onClick={onManage}
                    disabled={busy === "portal"}
                    className="w-full text-sm py-2 border border-gray-300 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {busy === "portal" ? "Loading…" : "Switch plan ↗"}
                  </button>
                ) : (
                  <div className="w-full text-sm py-2 text-center text-amber-700 bg-amber-50 rounded-lg font-medium">
                    Complimentary
                  </div>
                )
              ) : (
                <button
                  onClick={() => onUpgrade(pt, "paid")}
                  disabled={busy === `${pt.id}-paid`}
                  className="w-full text-sm py-2 bg-brand-orange hover:bg-brand-orange-dark text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {busy === `${pt.id}-paid` ? "Loading…" : "Upgrade to Paid"}
                </button>
              )}
            </div>
          </div>

          {/* Featured ($39) */}
          <div className={`p-5 flex flex-col ${currentPlan === "featured" ? "bg-amber-50" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-gray-700">Featured</span>
              {currentPlan === "featured" && (
                <span className="text-xs bg-amber-200 text-amber-800 font-semibold px-2 py-0.5 rounded-full">Current</span>
              )}
            </div>
            <div className="mb-3">
              <PTPrice plan="featured" interval={interval} />
            </div>
            <ul className="space-y-1.5 text-xs text-gray-600 flex-1">
              <li>✓ Basic listing</li>
              <li>✓ Improved search visibility</li>
              {PT_PAID_FEATURES.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
              {PT_FEATURED_FEATURES.map((f) => (
                <li key={f} className="font-medium text-amber-700">★ {f}</li>
              ))}
            </ul>
            <div className="mt-4">
              {currentPlan === "featured" ? (
                hasBillingAccount ? (
                  <button
                    onClick={onManage}
                    disabled={busy === "portal"}
                    className="w-full text-sm py-2 border border-amber-400 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    {busy === "portal" ? "Loading…" : "Manage Billing ↗"}
                  </button>
                ) : (
                  <div className="w-full text-sm py-2 text-center text-amber-700 bg-amber-50 rounded-lg font-medium">
                    Complimentary
                  </div>
                )
              ) : (
                <button
                  onClick={() => onUpgrade(pt, "featured")}
                  disabled={busy === `${pt.id}-featured`}
                  className="w-full text-sm py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {busy === `${pt.id}-featured` ? "Loading…" : "Upgrade to Featured"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ClaimCard — shown in owner portal for pending/rejected claims
// ─────────────────────────────────────────────────────────────────────────────
function ClaimCard({ claim, onResubmit, onAddNote, onDelete }: { claim: OwnerClaim; onResubmit: (id: string, message: string) => Promise<void>; onAddNote: (id: string, note: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [showResubmit, setShowResubmit] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [note, setNote] = useState(claim.claimantNote ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isPt = claim.claimType === "pt";
  const isNew = claim.isNewListing;
  const label = isNew
    ? isPt ? "New PT Listing" : "New Gym Listing"
    : isPt ? "PT Profile Claim" : "Gym Claim";

  const statusColor = claim.status === "pending"
    ? "bg-amber-100 text-amber-800"
    : "bg-red-100 text-red-800";

  const created = claim.createdAt ? new Date(claim.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-300 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="font-semibold text-gray-900">{claim.gymName || "Unnamed"}</p>
            <span className="text-xs bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full">{label}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor}`}>
              {claim.status}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            {claim.gymSuburb || claim.gymAddress || ""} {claim.gymPostcode || ""}
            {created && ` · Submitted ${created}`}
          </p>
        </div>
      </div>

      {/* Admin rejection notes */}
      {claim.status === "rejected" && claim.notes && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-red-700 mb-0.5">Reason for rejection</p>
          <p className="text-sm text-red-800">{claim.notes}</p>
        </div>
      )}

      {/* Resubmit button for rejected claims */}
      {claim.status === "rejected" && !showResubmit && (
        <button
          onClick={() => setShowResubmit(true)}
          className="mt-3 px-4 py-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs rounded-lg font-medium transition-colors"
        >
          Resubmit with note
        </button>
      )}

      {/* Resubmit form */}
      {showResubmit && (
        <div className="mt-3 space-y-2">
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note explaining what's changed or provide additional info…"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onResubmit(claim.id, note);
                setBusy(false);
                setShowResubmit(false);
                setNote("");
              }}
              className="px-4 py-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs rounded-lg font-medium disabled:opacity-50"
            >
              {busy ? "Resubmitting…" : "Resubmit"}
            </button>
            <button
              onClick={() => { setShowResubmit(false); setNote(""); }}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Claimant note (shown on both pending and rejected) */}
      {claim.claimantNote && !showAddNote && (
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-blue-700 mb-0.5">Your note</p>
          <p className="text-sm text-blue-800 whitespace-pre-wrap">{claim.claimantNote}</p>
        </div>
      )}

      {/* Pending status message */}
      {claim.status === "pending" && !showAddNote && (
        <div className="mt-3">
          <p className="text-xs text-amber-600 bg-amber-50 rounded px-3 py-2">
            Your submission is being reviewed by our team. You&apos;ll be able to manage your listing once approved.
          </p>
          <button
            onClick={() => setShowAddNote(true)}
            className="mt-2 px-4 py-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs rounded-lg font-medium transition-colors"
          >
            {claim.claimantNote ? "Edit note" : "Add note for reviewer"}
          </button>
        </div>
      )}

      {/* Add/edit note form for pending claims */}
      {showAddNote && (
        <div className="mt-3 space-y-2">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for the admin reviewer (e.g. proof of ownership, additional context)…"
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onAddNote(claim.id, note);
                setBusy(false);
                setShowAddNote(false);
              }}
              className="px-4 py-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-xs rounded-lg font-medium disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save note"}
            </button>
            <button
              onClick={() => { setShowAddNote(false); setNote(claim.claimantNote ?? ""); }}
              className="px-4 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete */}
      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="mt-3 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          Delete submission
        </button>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-red-600">Are you sure?</span>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onDelete(claim.id);
              setBusy(false);
            }}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg font-medium disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded-lg font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BillingPage
// ─────────────────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const router = useRouter();
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [pts, setPts] = useState<PersonalTrainer[]>([]);
  const [claims, setClaims] = useState<OwnerClaim[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab
  const [tab, setTab] = useState<Tab>("billing");
  const [leadsNewCount, setLeadsNewCount] = useState(0);
  const [affPendingCount, setAffPendingCount] = useState(0);

  // Billing tab controls
  const [interval, setInterval] = useState<Interval>("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelToast, setCancelToast] = useState<string | null>(null);

  // Search / filter (visible when >1 gym)
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [stateFilter, setStateFilter] = useState("all");

  // Collapse state per gym
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Bulk edit state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [verifyPt, setVerifyPt] = useState<PersonalTrainer | null>(null);

  // ── Auth ──────────────────────────────────────────────────────────────────
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
      .catch(() => {
        // Dev mode fallback — check for dev session in sessionStorage
        if (process.env.NODE_ENV === "development") {
          try {
            const raw = sessionStorage.getItem("devSession");
            if (raw) {
              setSession(JSON.parse(raw));
              return;
            }
          } catch { /* */ }
        }
        router.replace("/owner");
      });
  }, [router]);

  // ── Load gyms + PTs ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    fetch(`/api/owner/gyms?ownerId=${session.ownerId}`)
      .then((r) => r.json())
      .then((data: Gym[]) => {
        setGyms(data);
        setLoading(false);
      });
    fetch(`/api/owner/pts?ownerId=${session.ownerId}`)
      .then((r) => r.json())
      .then((data: PersonalTrainer[]) => {
        if (Array.isArray(data)) setPts(data);
      })
      .catch(() => {});
    fetch(`/api/owner/claims?email=${encodeURIComponent(session.email)}`)
      .then((r) => r.json())
      .then((data: OwnerClaim[]) => {
        if (Array.isArray(data)) setClaims(data);
      })
      .catch(() => {});
  }, [session]);

  // ── Derived: available states for filter ──────────────────────────────────
  const availableStates = useMemo(() => {
    const states = new Set([
      ...gyms.map((g) => g.address.state),
      ...pts.map((p) => p.address.state),
    ].filter(Boolean));
    return Array.from(states).sort();
  }, [gyms, pts]);

  // ── Derived: filtered gyms for billing tab ────────────────────────────────
  const filteredGyms = useMemo(() => {
    const q = search.toLowerCase();
    return gyms.filter((g) => {
      if (
        q &&
        ![g.name, g.address.suburb, g.address.postcode, g.address.state].some((v) =>
          v?.toLowerCase().includes(q)
        )
      )
        return false;
      const plan =
        g.stripePlan ?? (g.isFeatured ? "featured" : g.isPaid ? "paid" : null);
      if (tierFilter === "free" && plan !== null) return false;
      if (tierFilter === "paid" && plan !== "paid") return false;
      if (tierFilter === "featured" && plan !== "featured") return false;
      if (stateFilter !== "all" && g.address.state !== stateFilter) return false;
      return true;
    });
  }, [gyms, search, tierFilter, stateFilter]);

  // ── Derived: filtered PTs for billing tab ─────────────────────────────────
  const filteredPTs = useMemo(() => {
    const q = search.toLowerCase();
    return pts.filter((p) => {
      if (
        q &&
        ![p.name, p.address.suburb, p.address.postcode, p.address.state].some((v) =>
          v?.toLowerCase().includes(q)
        )
      )
        return false;
      const plan =
        p.stripePlan ?? (p.isFeatured ? "featured" : p.isPaid ? "paid" : null);
      if (tierFilter === "free" && plan !== null) return false;
      if (tierFilter === "paid" && plan !== "paid") return false;
      if (tierFilter === "featured" && plan !== "featured") return false;
      if (stateFilter !== "all" && p.address.state !== stateFilter) return false;
      return true;
    });
  }, [pts, search, tierFilter, stateFilter]);

  // ── Collapse helpers ──────────────────────────────────────────────────────
  function toggleCollapse(gymId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(gymId)) { next.delete(gymId); } else { next.add(gymId); }
      return next;
    });
  }
  const totalListings = gyms.length + pts.length;
  const allCollapsed = totalListings > 0 && collapsed.size === totalListings;

  // Bulk edit helpers
  function toggleBulkSelect(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function exitBulkMode() {
    setBulkMode(false);
    setBulkSelected(new Set());
  }
  function handleBulkSubmitted() {
    setShowBulkModal(false);
    exitBulkMode();
    setCancelToast("Bulk edit submitted for review.");
  }
  const bulkSelectedGyms = gyms.filter((g) => bulkSelected.has(g.id));

  // ── Billing actions ───────────────────────────────────────────────────────
  async function handlePTUpgrade(pt: PersonalTrainer, plan: "paid" | "featured") {
    if (!session) return;
    setBusy(`${pt.id}-${plan}`);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: pt.id,
          ownerId: session.ownerId,
          email: session.email,
          plan,
          interval,
          entityType: "pt",
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

  async function handlePTCancel(pt: PersonalTrainer) {
    if (!session) return;
    if (
      !confirm(
        `Downgrade ${pt.name} to Free? Your paid features will remain active until the end of the current billing period.`
      )
    )
      return;
    setBusy(`${pt.id}-cancel`);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId: pt.id, email: session.email, entityType: "pt" }),
      });
      const data = await res.json();
      if (data.ok) {
        setCancelToast(
          `Subscription cancelled. ${pt.name} will revert to Free on ${data.periodEnd}.`
        );
      } else {
        alert(data.error ?? "Something went wrong");
      }
    } catch {
      alert("Network error. Please try again.");
    }
    setBusy(null);
  }

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
        body: JSON.stringify({
          email: session.email,
          returnUrl: `${window.location.origin}/billing`,
        }),
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
    if (
      !confirm(
        `Downgrade ${gym.name} to Free? Your paid features will remain active until the end of the current billing period.`
      )
    )
      return;
    setBusy(`${gym.id}-cancel`);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId: gym.id, email: session.email }),
      });
      const data = await res.json();
      if (data.ok) {
        setCancelToast(
          `Subscription cancelled. ${gym.name} will revert to Free on ${data.periodEnd}.`
        );
      } else {
        alert(data.error ?? "Something went wrong");
      }
    } catch {
      alert("Network error. Please try again.");
    }
    setBusy(null);
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20 text-gray-400">Loading…</div>
      </Layout>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>Owner Portal — mynextgym.com.au</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="description" content="Manage your gym or PT listing — billing, leads, analytics and affiliations." />
      </Head>
      <Layout>
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Owner Portal</h1>
            {session?.name && (
              <p className="text-sm text-gray-500 mt-0.5">Welcome back, {session.name}</p>
            )}
          </div>
          <button
            onClick={async () => {
              await signOut();
              router.replace("/owner");
            }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Sign out
          </button>
        </div>

        {/* Tab bar */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex gap-6">
            {(
              [
                { key: "billing", label: "Billing" },
                { key: "leads", label: "Leads" },
                { key: "analytics", label: "Analytics" },
                { key: "affiliations", label: "Affiliations" },
              ] as { key: Tab; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  tab === key
                    ? "border-brand-orange text-brand-orange"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {label}
                {key === "leads" && leadsNewCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-brand-orange shrink-0" />
                )}
                {key === "affiliations" && affPendingCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-brand-orange shrink-0" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Billing tab ──────────────────────────────────────────────────── */}
        {tab === "billing" && (
          <>
            {cancelToast && (
              <div className="mb-6 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center justify-between">
                <span>{cancelToast}</span>
                <button
                  onClick={() => setCancelToast(null)}
                  className="ml-4 text-green-600 hover:text-green-800"
                >
                  ✕
                </button>
              </div>
            )}

            {/* ── Pending / rejected claims ── */}
            {claims.filter((c) => c.status === "pending" || c.status === "rejected").length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Pending submissions</h3>
                <div className="space-y-3">
                  {claims
                    .filter((c) => c.status === "pending" || c.status === "rejected")
                    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
                    .map((c) => (
                      <ClaimCard
                        key={c.id}
                        claim={c}
                        onResubmit={async (id, message) => {
                          const r = await fetch(`/api/owner/claims?id=${id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ message }),
                          });
                          if (r.ok) {
                            setClaims((prev) =>
                              prev.map((cl) => cl.id === id ? { ...cl, status: "pending" } : cl)
                            );
                          }
                        }}
                        onAddNote={async (id, claimantNote) => {
                          const r = await fetch(`/api/owner/claims?id=${id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ claimantNote }),
                          });
                          if (r.ok) {
                            setClaims((prev) =>
                              prev.map((cl) => cl.id === id ? { ...cl, claimantNote } : cl)
                            );
                          }
                        }}
                        onDelete={async (id) => {
                          const r = await fetch(`/api/owner/claims?id=${id}`, { method: "DELETE" });
                          if (r.ok) {
                            setClaims((prev) => prev.filter((cl) => cl.id !== id));
                          }
                        }}
                      />
                    ))}
                </div>
              </div>
            )}

            {gyms.length === 0 && pts.length === 0 && claims.filter((c) => c.status === "pending" || c.status === "rejected").length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 mb-4">No listings yet.</p>
                <div className="flex gap-3 justify-center">
                  <Link
                    href="/list"
                    className="px-5 py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg text-sm transition-colors"
                  >
                    Create a listing
                  </Link>
                  <Link
                    href="/claim-gym"
                    className="px-5 py-2.5 border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-lg text-sm transition-colors"
                  >
                    Claim your gym
                  </Link>
                  <Link
                    href="/claim-pt"
                    className="px-5 py-2.5 border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-lg text-sm transition-colors"
                  >
                    Claim your PT profile
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* ── Controls row ── */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  {/* Billing interval */}
                  <div className="flex items-center bg-gray-100 rounded-lg p-1 text-sm font-medium">
                    <button
                      onClick={() => setInterval("month")}
                      className={`px-4 py-1.5 rounded-md transition-colors ${
                        interval === "month"
                          ? "bg-white shadow text-gray-900"
                          : "text-gray-500"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setInterval("year")}
                      className={`px-4 py-1.5 rounded-md transition-colors ${
                        interval === "year"
                          ? "bg-white shadow text-gray-900"
                          : "text-gray-500"
                      }`}
                    >
                      Annual{" "}
                      <span className="text-green-600 font-semibold text-xs ml-1">
                        Save 17%
                      </span>
                    </button>
                  </div>

                  {/* Search + filters — only when >1 listing */}
                  {(gyms.length + pts.length) > 1 && (
                    <>
                      <input
                        type="text"
                        placeholder="Search name, suburb, postcode, state…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange w-64"
                      />
                      <select
                        value={tierFilter}
                        onChange={(e) => setTierFilter(e.target.value as TierFilter)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                      >
                        <option value="all">All tiers</option>
                        <option value="free">Free</option>
                        <option value="paid">Paid</option>
                        <option value="featured">Featured</option>
                      </select>
                      {availableStates.length > 1 && (
                        <select
                          value={stateFilter}
                          onChange={(e) => setStateFilter(e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                        >
                          <option value="all">All states</option>
                          {availableStates.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      )}
                    </>
                  )}

                  {/* Collapse all / expand all + Bulk Edit */}
                  <div className="ml-auto flex items-center gap-3">
                    {gyms.length >= 2 && !bulkMode && (
                      <button
                        onClick={() => setBulkMode(true)}
                        className="text-sm text-gray-500 hover:text-brand-orange font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Bulk Edit
                      </button>
                    )}
                    {!bulkMode && (
                      <button
                        onClick={() =>
                          allCollapsed
                            ? setCollapsed(new Set())
                            : setCollapsed(new Set([...gyms.map((g) => g.id), ...pts.map((p) => p.id)]))
                        }
                        className="text-sm text-gray-500 hover:text-gray-700 underline"
                      >
                        {allCollapsed ? "Expand all" : "Collapse all"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Bulk edit selection bar */}
                {bulkMode && (
                  <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={bulkSelected.size === filteredGyms.length && filteredGyms.length > 0}
                          onChange={() => {
                            if (bulkSelected.size === filteredGyms.length) {
                              setBulkSelected(new Set());
                            } else {
                              setBulkSelected(new Set(filteredGyms.map((g) => g.id)));
                            }
                          }}
                          className="w-4 h-4 accent-brand-orange"
                        />
                        <span className="text-sm text-blue-800 font-medium">
                          {bulkSelected.size === 0
                            ? "Select gyms to edit"
                            : `${bulkSelected.size} gym${bulkSelected.size !== 1 ? "s" : ""} selected`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={exitBulkMode}
                        className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setShowBulkModal(true)}
                        disabled={bulkSelected.size < 2}
                        className="px-4 py-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Edit selected →
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Listing cards ── */}
                {filteredGyms.length === 0 && filteredPTs.length === 0 ? (
                  <p className="text-center py-10 text-gray-400">
                    No listings match your filters.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {filteredGyms.map((gym) => (
                      <GymRow
                        key={gym.id}
                        gym={gym}
                        interval={interval}
                        busy={busy}
                        collapsed={collapsed.has(gym.id)}
                        onToggleCollapse={() => toggleCollapse(gym.id)}
                        onUpgrade={handleUpgrade}
                        onManage={handleManage}
                        onCancel={handleCancel}
                        bulkMode={bulkMode}
                        bulkSelected={bulkSelected.has(gym.id)}
                        onBulkToggle={() => toggleBulkSelect(gym.id)}
                      />
                    ))}
                    {filteredPTs.map((pt) => (
                      <PTRow
                        key={pt.id}
                        pt={pt}
                        interval={interval}
                        busy={busy}
                        collapsed={collapsed.has(pt.id)}
                        onToggleCollapse={() => toggleCollapse(pt.id)}
                        onUpgrade={handlePTUpgrade}
                        onManage={handleManage}
                        onCancel={handlePTCancel}
                        onVerify={() => setVerifyPt(pt)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Bulk Edit Modal */}
        {showBulkModal && session && (
          <BulkEditModal
            gyms={bulkSelectedGyms}
            onClose={() => setShowBulkModal(false)}
            onSubmitted={handleBulkSubmitted}
          />
        )}

        {/* Qualification Verify Modal */}
        {verifyPt && (
          <QualificationVerifyModal
            ptId={verifyPt.id}
            ptName={verifyPt.name}
            qualifications={verifyPt.qualifications}
            onClose={() => setVerifyPt(null)}
          />
        )}

        {/* ── Leads tab ────────────────────────────────────────────────────── */}
        {tab === "leads" && session && (
          <LeadsTab ownerId={session.ownerId} gyms={gyms} pts={pts} onNewCount={setLeadsNewCount} />
        )}

        {/* ── Analytics tab ────────────────────────────────────────────────── */}
        {tab === "analytics" && session && (
          <AnalyticsTab ownerId={session.ownerId} gyms={gyms} pts={pts} />
        )}

        {/* ── Affiliations tab ───────────────────────────────────────────── */}
        {tab === "affiliations" && session && (
          <div className="space-y-8">
            {gyms.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-4">Gym Affiliations</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Personal trainers can request to affiliate with your gyms. Approved PTs appear on your gym profile.
                </p>
                <GymAffiliationsTab gyms={gyms} onPendingCount={setAffPendingCount} />
              </section>
            )}
            {pts.length > 0 && (
              <section>
                {gyms.length > 0 && <hr className="border-gray-200 my-8" />}
                <h2 className="text-xl font-bold text-gray-900 mb-4">PT Affiliations</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Search for gyms and request to be listed as an affiliated personal trainer.
                </p>
                <PTAffiliationsTab pts={pts} />
              </section>
            )}
            {gyms.length === 0 && pts.length === 0 && (
              <p className="text-gray-400 text-sm py-8 text-center">
                No gyms or PT profiles found. Create a listing first.
              </p>
            )}
          </div>
        )}
      </Layout>
    </>
  );
}
