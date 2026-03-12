import { useEffect, useState, useCallback, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { getCurrentUser, fetchUserAttributes, signOut } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import type { Gym, GymEdit } from "@/types";
import OwnerGymForm from "@/components/OwnerGymForm";
import PTsTab from "@/components/admin/PTsTab";
import BlogTab from "@/components/admin/BlogTab";
import FeatureFlagsTab from "@/components/admin/FeatureFlagsTab";
import ChatTranscriptsTab from "@/components/admin/ChatTranscriptsTab";
import { ALL_AMENITIES, ALL_SPECIALTIES, AMENITY_ICONS } from "@/lib/utils";
import { adminFetch } from "@/lib/adminFetch";
import { gymUrl } from "@/lib/slugify";
import { ScanButton } from "@/components/admin/WebsiteScraper";
import type { ScrapedFields } from "@/components/admin/WebsiteScraper";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Claim {
  id: string;
  gymId: string;
  gymName?: string;
  gymAddress?: string;
  gymWebsite?: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone?: string;
  message?: string;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  isNewListing?: boolean;
  gymPhone?: string;
  gymEmail?: string;
  gymSuburb?: string;
  gymPostcode?: string;
  claimType?: string;
  claimantNote?: string;
}

interface CognitoUser {
  username: string;
  email: string;
  status: string;
  ownerId: string;
  isAdmin: string;
  isSuperAdmin: string;
  enabled: boolean;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Empty gym template for "New Gym"
// ---------------------------------------------------------------------------
const EMPTY_GYM: Gym = {
  id: "",
  slug: "",
  suburbSlug: "",
  ownerId: "",
  isActive: true,
  name: "",
  description: "",
  address: { street: "", suburb: "", state: "WA", postcode: "" },
  phone: "",
  email: "",
  website: "",
  lat: -31.9505,
  lng: 115.8605,
  amenities: [],
  hours: {},
  pricePerWeek: 0,
  images: [],
};

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------
function Badge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colours[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [tab, setTab] = useState<"claims" | "moderation" | "gyms" | "pts" | "users" | "leads" | "datasets" | "blog" | "flags" | "chats">("claims");
  const [adminEmail, setAdminEmail] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const setClaimsPending = useCallback((n: number) => setPendingCounts((p) => ({ ...p, claims: n })), []);
  const setModerationPending = useCallback((n: number) => setPendingCounts((p) => ({ ...p, moderation: n })), []);
  const setLeadsPending = useCallback((n: number) => setPendingCounts((p) => ({ ...p, leads: n })), []);

  // Pre-fetch pending counts so badges show immediately on all tabs
  useEffect(() => {
    Promise.all([
      adminFetch("/api/admin/claims").then((r) => r.json()).catch(() => []),
      adminFetch("/api/admin/moderation").then((r) => r.json()).catch(() => []),
    ]).then(([claims, edits]) => {
      const claimsArr = Array.isArray(claims) ? claims as Claim[] : [];
      const editsArr = Array.isArray(edits) ? edits as GymEdit[] : [];
      setPendingCounts({
        claims: claimsArr.filter((c) => c.status === "pending").length,
        moderation: editsArr.filter((e) => e.status === "pending").length,
      });
    });
  }, []);

  // Auth check
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        const attrs = await fetchUserAttributes();
        setAdminEmail(user.signInDetails?.loginId ?? attrs.email ?? "");
        setIsSuperAdmin(attrs["custom:isSuperAdmin"] === "true");
        if (attrs["custom:isAdmin"] !== "true") {
          setAccessDenied(true);
        } else {
          if (router.query.gym) setTab("gyms");
          if (router.query.pt) setTab("pts");
          setReady(true);
        }
      } catch {
        router.replace("/owner");
      }
    })();
  }, [router]);

  async function handleSignOut() {
    await signOut();
    router.replace("/owner");
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500">You need admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  const initialGymId = typeof router.query.gym === "string" ? router.query.gym : undefined;
  const initialPtId = typeof router.query.pt === "string" ? router.query.pt : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>Admin — mynextgym.com.au</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      {/* Header */}
      <div className="bg-brand-black text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">
          <Link href="/" className="hover:opacity-80 transition-opacity">
            <span className="text-brand-orange">mynextgym</span> Admin
          </Link>
        </h1>
        <button
          onClick={handleSignOut}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white px-6">
        <nav className="flex gap-6">
          {(["claims", "moderation", "gyms", "pts", "users", "leads", "datasets", "blog", "chats", "flags"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-4 text-sm font-medium border-b-2 transition-colors capitalize flex items-center gap-1.5 ${
                tab === t
                  ? "border-brand-orange text-brand-orange"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "moderation" ? "Moderation" : t === "leads" ? "Leads" : t === "pts" ? "PTs" : t === "flags" ? "Feature Flags" : t === "blog" ? "Blog" : t === "chats" ? "Chat Logs" : t}
              {(pendingCounts[t] ?? 0) > 0 && (
                <span className="w-2 h-2 rounded-full bg-brand-orange shrink-0" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {tab === "claims" && <ClaimsTab onPendingCount={setClaimsPending} />}
        {tab === "moderation" && <ModerationTab onPendingCount={setModerationPending} adminEmail={adminEmail} />}
        {tab === "gyms" && <GymsTab initialGymId={initialGymId} adminEmail={adminEmail} />}
        {tab === "pts" && <PTsTab adminEmail={adminEmail} initialPtId={initialPtId} />}
        {tab === "users" && <UsersTab isSuperAdmin={isSuperAdmin} />}
        {tab === "leads" && <LeadsTab onPendingCount={setLeadsPending} />}
        {tab === "datasets" && <DatasetsTab isSuperAdmin={isSuperAdmin} />}
        {tab === "blog" && <BlogTab adminEmail={adminEmail} />}
        {tab === "chats" && <ChatTranscriptsTab />}
        {tab === "flags" && <FeatureFlagsTab isSuperAdmin={isSuperAdmin} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Claims tab
// ---------------------------------------------------------------------------
function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ClaimsTab({ onPendingCount }: { onPendingCount?: (n: number) => void }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean }>({ msg: "", ok: true });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState<{ ownerId: string; isNewUser: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminFetch("/api/admin/claims");
    const data = await r.json();
    setClaims(data);
    onPendingCount?.(data.filter((c: Claim) => c.status === "pending").length);
    setLoading(false);
  }, [onPendingCount]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: true }), 5000);
  }

  async function action(id: string, act: "approve" | "reject") {
    setBusy(id + act);
    const r = await adminFetch(`/api/admin/claims?action=${act}&id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes[id] ?? "" }),
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok) {
      if (act === "approve") {
        setApproved({ ownerId: body.ownerId, isNewUser: body.isNewUser });
      }
      showToast(act === "approve"
        ? body.isNewUser
          ? "Claim approved — new user created and welcome email sent."
          : "Claim approved — gym added to existing user account."
        : "Claim rejected.");
      await load();
    } else {
      showToast(`Error: ${body.error ?? r.statusText}`, false);
    }
    setBusy(null);
  }

  const filteredClaims = claims.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.claimantName.toLowerCase().includes(q) ||
      c.claimantEmail.toLowerCase().includes(q) ||
      (c.gymName ?? "").toLowerCase().includes(q) ||
      (c.gymAddress ?? "").toLowerCase().includes(q)
    );
  });
  const displayedClaims = pageSize === 0 ? filteredClaims : filteredClaims.slice(0, pageSize);

  return (
    <div>
      {toast.msg && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${toast.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}

      {/* Approved credentials modal */}
      {approved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Claim Approved</h3>
            {approved.isNewUser ? (
              <>
                <p className="text-sm text-gray-700 mb-3">
                  A new account has been created and a welcome email with login instructions has been sent to the gym owner.
                </p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm font-mono mb-4">
                  <p><span className="text-gray-500">Owner ID:</span> {approved.ownerId}</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-700 mb-3">
                  The gym has been added to the existing owner&apos;s account.
                </p>
                <div className="bg-gray-50 rounded-lg p-3 text-sm font-mono mb-4">
                  <p><span className="text-gray-500">Owner ID:</span> {approved.ownerId}</p>
                </div>
              </>
            )}
            <button
              onClick={() => setApproved(null)}
              className="w-full py-2 bg-brand-orange text-white text-sm font-semibold rounded-lg"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-base font-semibold text-gray-900 shrink-0">Listing Claims</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name, email, or gym…"
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button
          onClick={() => { setSearch(""); setStatusFilter("all"); }}
          className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
        >
          Clear
        </button>
        <button
          onClick={() => { setSearch(""); setStatusFilter("pending"); }}
          className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
        >
          Reset
        </button>
      </div>
      {loading ? (
        <div className="text-center py-12"><p className="text-gray-400 text-sm">Loading…</p></div>
      ) : claims.length === 0 ? (
        <div className="text-center py-12"><p className="text-gray-400 text-sm">No claims yet.</p></div>
      ) : filteredClaims.length === 0 ? (
        <div className="text-center py-12"><p className="text-gray-400 text-sm">No claims match your filter.</p></div>
      ) : (
        <div className="space-y-4">
          {displayedClaims.map((c) => (
            <div
              key={c.id}
              className={`bg-white rounded-lg border p-4 ${c.status !== "pending" ? "opacity-60" : ""}`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{c.gymName || c.gymId}</p>
                    {c.isNewListing && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-orange text-white">New Listing</span>
                    )}
                    {c.claimType === "pt" && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-600 text-white">PT Claim</span>
                    )}
                    {!c.isNewListing && c.gymId && c.gymId !== "new" && (
                      <a
                        href={c.claimType === "pt" ? `/pt/${c.gymId}` : `/gym/${c.gymId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-orange hover:underline font-medium"
                      >
                        View profile &rarr;
                      </a>
                    )}
                    {c.status === "approved" && c.isNewListing && c.gymId && c.gymId !== "new" && (
                      <a
                        href={c.claimType === "pt" ? `/pt/${c.gymId}` : `/gym/${c.gymId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:underline font-medium"
                      >
                        View created profile &rarr;
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{c.isNewListing ? `${c.gymSuburb ?? ""} ${c.gymPostcode ?? ""}`.trim() : c.gymAddress}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge status={c.status} />
                </div>
              </div>

              {/* Claimant details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Name</p>
                  <p className="text-gray-800">{c.claimantName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Email</p>
                  <p className="text-gray-800 break-all">{c.claimantEmail}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                  <p className="text-gray-800">{c.claimantPhone || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Submitted</p>
                  <p className="text-gray-800">{fmtDate(c.createdAt)}</p>
                </div>
              </div>

              {/* Listing details for new submissions */}
              {c.isNewListing && (c.gymPhone || c.gymEmail || c.gymWebsite) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3 bg-blue-50 rounded-lg p-3">
                  <div className="col-span-full">
                    <p className="text-xs text-blue-600 font-semibold mb-1">Submitted listing details</p>
                  </div>
                  {c.gymPhone && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Listing phone</p>
                      <p className="text-gray-800">{c.gymPhone}</p>
                    </div>
                  )}
                  {c.gymEmail && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Listing email</p>
                      <p className="text-gray-800 break-all">{c.gymEmail}</p>
                    </div>
                  )}
                  {c.gymWebsite && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 mb-0.5">Website</p>
                      <a href={c.gymWebsite} target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline text-sm break-all">{c.gymWebsite}</a>
                    </div>
                  )}
                </div>
              )}

              {/* Message */}
              {c.message && (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-0.5">Message</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{c.message}</p>
                </div>
              )}

              {/* Claimant note */}
              {c.claimantNote && (
                <div className="mb-3">
                  <p className="text-xs text-blue-500 font-semibold mb-0.5">Note from claimant</p>
                  <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded p-2 whitespace-pre-wrap">{c.claimantNote}</p>
                </div>
              )}

              {/* Notes */}
              {c.status === "pending" ? (
                <div className="mb-3">
                  <label className="text-xs text-gray-400 mb-0.5 block">Internal notes (optional)</label>
                  <textarea
                    rows={2}
                    value={notes[c.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [c.id]: e.target.value }))}
                    placeholder="Add rationale for approval or rejection…"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                  />
                </div>
              ) : c.notes ? (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{c.notes}</p>
                  <p className="text-xs text-gray-400 mt-1">{c.status === "approved" ? "Approved" : "Rejected"}: {fmtDate(c.updatedAt)}</p>
                </div>
              ) : null}

              {/* Actions */}
              {c.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => action(c.id, "approve")}
                    disabled={busy !== null}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium disabled:opacity-50"
                  >
                    {busy === c.id + "approve" ? "Approving…" : "Approve"}
                  </button>
                  <button
                    onClick={() => action(c.id, "reject")}
                    disabled={busy !== null}
                    className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg font-medium disabled:opacity-50"
                  >
                    {busy === c.id + "reject" ? "Rejecting…" : "Reject"}
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100 text-xs text-gray-500">
            <span>Showing {displayedClaims.length} of {filteredClaims.length}</span>
            <div className="flex items-center gap-2">
              <span>Show:</span>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-orange">
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={0}>All</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Moderation Review tab
// ---------------------------------------------------------------------------

const DIFF_LABELS_GYM: Record<string, string> = {
  name: "Name", description: "Description", phone: "Phone",
  email: "Email", website: "Website", pricePerWeek: "Price/week",
  instagram: "Instagram", facebook: "Facebook",
  "address.street": "Address", "address.suburb": "Suburb", "address.postcode": "Postcode",
  "hours.monday": "Mon", "hours.tuesday": "Tue", "hours.wednesday": "Wed",
  "hours.thursday": "Thu", "hours.friday": "Fri", "hours.saturday": "Sat", "hours.sunday": "Sun",
  hoursComment: "Hours note",
  amenities: "Amenities", images: "Images",
  memberOffers: "Member offers", memberOffersNotes: "Benefits / affiliations",
  memberScrollText: "Scroll banner", memberOffersScroll: "Scroll on card",
  memberOffersTnC: "Terms & Conditions",
};

const DIFF_LABELS_PT: Record<string, string> = {
  name: "Name", description: "Description", phone: "Phone",
  email: "Email", website: "Website",
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok",
  bookingUrl: "Booking URL",
  "address.street": "Address", "address.suburb": "Suburb", "address.postcode": "Postcode",
  specialties: "Specialties", qualifications: "Qualifications",
  qualificationsVerified: "Qualifications verified",
  qualificationsVerifiedList: "Verified qualifications list",
  qualificationEvidence: "Qualification evidence",
  memberOffers: "Member offers", memberOffersNotes: "Benefits / affiliations",
  memberOffersTnC: "Terms & Conditions",
  experienceYears: "Experience", pricePerSession: "Price/session",
  sessionDuration: "Session duration", pricingNotes: "Pricing notes",
  availability: "Availability", gender: "Gender",
  languages: "Languages", images: "Images",
  gymIds: "Affiliated gyms", customLeadFields: "Custom enquiry fields",
};

const DIFF_LABELS: Record<string, string> = { ...DIFF_LABELS_GYM, ...DIFF_LABELS_PT };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFieldValue(obj: any, field: string): string {
  if (field.startsWith("address.")) {
    const k = field.split(".")[1];
    return String(obj.address?.[k] ?? "");
  }
  if (field.startsWith("hours.")) {
    const k = field.split(".")[1];
    return String(obj.hours?.[k] ?? "");
  }
  if (field === "amenities") return (obj.amenities ?? []).sort().join(", ") || "—";
  if (field === "memberOffers") return (obj.memberOffers ?? []).sort().join(", ") || "—";
  if (field === "specialties") return (obj.specialties ?? []).sort().join(", ") || "—";
  if (field === "qualifications") return (obj.qualifications ?? []).sort().join(", ") || "—";
  if (field === "languages") return (obj.languages ?? []).sort().join(", ") || "—";
  if (field === "images") return `${(obj.images ?? []).length} image(s)`;
  if (field === "pricePerWeek") return obj.pricePerWeek ? `$${obj.pricePerWeek}/wk` : "—";
  if (field === "pricePerSession") return obj.pricePerSession ? `$${obj.pricePerSession}` : "—";
  if (field === "sessionDuration") return obj.sessionDuration ? `${obj.sessionDuration} min` : "—";
  if (field === "experienceYears") return obj.experienceYears ? `${obj.experienceYears} yrs` : "—";
  if (field === "memberOffersScroll") return obj.memberOffersScroll ? "Yes" : "No";
  if (field === "qualificationsVerified") return obj.qualificationsVerified ? "Verified" : "Unverified";
  if (field === "gymIds") return (obj.gymIds ?? []).join(", ") || "—";
  if (field === "customLeadFields") {
    const fields = obj.customLeadFields;
    if (!fields || (Array.isArray(fields) && fields.length === 0)) return "—";
    if (typeof fields === "string") return fields;
    return (fields as { label: string }[]).map((f) => f.label).join(", ");
  }
  return String(obj[field] ?? "");
}

function computeDiff(current: Record<string, unknown>, proposed: Record<string, unknown>, editType?: string) {
  const labels = editType === "pt" ? DIFF_LABELS_PT : DIFF_LABELS_GYM;
  return Object.keys(labels).filter((field) => {
    return getFieldValue(current, field) !== getFieldValue(proposed, field);
  });
}

function BulkBar({ filtered, selected, setSelected, busy, bulkAction }: {
  filtered: GymEdit[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  busy: string | null;
  bulkAction: (act: "approve" | "reject") => void;
}) {
  const pendingIds = filtered.filter((e) => e.status === "pending").map((e) => e.id);
  if (pendingIds.length === 0) return null;
  const allSelected = pendingIds.every((id) => selected.has(id));
  return (
    <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-gray-50 border rounded-lg">
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 shrink-0">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => {
            if (allSelected) {
              setSelected((s) => { const n = new Set(s); pendingIds.forEach((id) => n.delete(id)); return n; });
            } else {
              setSelected((s) => new Set([...s, ...pendingIds]));
            }
          }}
          className="w-4 h-4 accent-brand-orange"
        />
        Select all pending
      </label>
      {selected.size > 0 && (
        <>
          <span className="text-xs text-gray-500">{selected.size} selected</span>
          <button
            onClick={() => bulkAction("approve")}
            disabled={busy !== null}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium disabled:opacity-50"
          >
            {busy === "bulk" ? "Processing…" : "Approve selected"}
          </button>
          <button
            onClick={() => bulkAction("reject")}
            disabled={busy !== null}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg font-medium disabled:opacity-50"
          >
            Reject selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
          >
            Clear
          </button>
        </>
      )}
    </div>
  );
}

function ModerationTab({ onPendingCount, adminEmail }: { onPendingCount?: (n: number) => void; adminEmail?: string }) {
  const [edits, setEdits] = useState<GymEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean }>({ msg: "", ok: true });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminFetch("/api/admin/moderation");
    if (r.ok) {
      const data = await r.json();
      setEdits(data);
      onPendingCount?.(data.filter((e: GymEdit) => e.status === "pending").length);
    }
    setLoading(false);
  }, [onPendingCount]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: true }), 5000);
  }

  async function action(id: string, act: "approve" | "reject") {
    setBusy(id + act);
    const r = await adminFetch(`/api/admin/moderation?action=${act}&id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes[id] ?? "", adminEmail: adminEmail ?? "" }),
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast(act === "approve" ? "Changes approved and applied." : "Changes rejected.");
      await load();
    } else {
      showToast(`Error: ${body.error ?? r.statusText}`, false);
    }
    setBusy(null);
  }

  async function bulkAction(act: "approve" | "reject") {
    const ids = [...selected];
    setBusy("bulk");
    let ok = 0;
    for (const id of ids) {
      const r = await adminFetch(`/api/admin/moderation?action=${act}&id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "", adminEmail: adminEmail ?? "" }),
      });
      if (r.ok) ok++;
    }
    setSelected(new Set());
    showToast(`${act === "approve" ? "Approved" : "Rejected"} ${ok} of ${ids.length} request${ids.length !== 1 ? "s" : ""}.`, ok > 0);
    await load();
    setBusy(null);
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const filtered = edits.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (e.gymName ?? "").toLowerCase().includes(q) ||
      (e.gymId ?? "").toLowerCase().includes(q) ||
      (e.ownerEmail ?? "").toLowerCase().includes(q)
    );
  });
  const displayedEdits = pageSize === 0 ? filtered : filtered.slice(0, pageSize);

  return (
    <div>
      {toast.msg && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${toast.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-base font-semibold text-gray-900 shrink-0">Moderation</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by gym name, ID, or owner email…"
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button
          onClick={() => { setSearch(""); setStatusFilter("all"); }}
          className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
        >
          Clear
        </button>
        <button
          onClick={() => { setSearch(""); setStatusFilter("pending"); }}
          className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
        >
          Reset
        </button>
      </div>

      {/* Bulk action bar */}
      {BulkBar({ filtered, selected, setSelected, busy, bulkAction })}

      {loading ? (
        <div className="text-center py-12"><p className="text-gray-400 text-sm">Loading…</p></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12"><p className="text-gray-400 text-sm">{edits.length === 0 ? "No moderation reviews yet." : "No results match your filter."}</p></div>
      ) : (
        <div className="space-y-4">
          {displayedEdits.map((e) => {
            const isPTEdit = e.editType === "pt";
            const isVerification = e.editType === "pt-verification";
            const isBulkEdit = e.editType === "bulk";
            const current = e.currentSnapshot ? JSON.parse(e.currentSnapshot) : null;
            const proposed = e.proposedChanges ? JSON.parse(e.proposedChanges) : null;
            const changedFields = current && proposed && !isBulkEdit ? computeDiff(current, proposed, isVerification ? "pt" : e.editType) : [];

            return (
              <div
                key={e.id}
                className={`bg-white rounded-lg border p-4 ${e.status !== "pending" ? "opacity-60" : ""} ${selected.has(e.id) ? "ring-2 ring-brand-orange border-brand-orange" : ""}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-start gap-3">
                    {e.status === "pending" && (
                      <input
                        type="checkbox"
                        checked={selected.has(e.id)}
                        onChange={() => toggleSelect(e.id)}
                        className="mt-1 w-4 h-4 accent-brand-orange shrink-0"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-gray-900 flex items-center gap-2">
                        {e.gymName || e.gymId}
                        {isPTEdit && <span className="text-xs bg-purple-100 text-purple-700 font-medium px-1.5 py-0.5 rounded">PT</span>}
                        {isVerification && <span className="text-xs bg-amber-100 text-amber-700 font-medium px-1.5 py-0.5 rounded">Qualification Verification</span>}
                        {isBulkEdit && <span className="text-xs bg-blue-100 text-blue-700 font-medium px-1.5 py-0.5 rounded">Bulk Edit</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        ID: {e.gymId}
                        {e.gymId && (
                          <a
                            href={isPTEdit || isVerification ? `/pt/${e.gymId}` : `/gym/${e.gymId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-brand-orange hover:underline font-medium"
                          >
                            View profile &rarr;
                          </a>
                        )}
                      </p>
                    </div>
                  </div>
                  <Badge status={e.status} />
                </div>

                {/* Qualification verification evidence panel */}
                {isVerification && proposed && (
                  <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-2">Qualification Evidence</p>
                    {(proposed._verificationRequestQuals ?? proposed.qualifications)?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">Qualifications requested for verification:</p>
                        <ul className="text-sm text-gray-700 space-y-0.5 pl-4 list-disc">
                          {(proposed._verificationRequestQuals ?? proposed.qualifications).map((q: string, i: number) => <li key={i}>{q}</li>)}
                        </ul>
                      </div>
                    )}
                    {proposed.qualificationEvidence && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 mb-1">Evidence provided:</p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap bg-white rounded p-2 border border-amber-100">{proposed.qualificationEvidence}</p>
                      </div>
                    )}
                    {proposed.qualificationEvidenceFiles && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Uploaded files:</p>
                        <ul className="text-sm text-gray-700 space-y-1">
                          {proposed.qualificationEvidenceFiles.split(",").map((key: string, i: number) => (
                            <li key={i}>
                              <button
                                type="button"
                                className="flex items-center gap-1.5 text-brand-orange hover:text-brand-orange-dark hover:underline"
                                onClick={async () => {
                                  try {
                                    const result = await getUrl({ path: key, options: { expiresIn: 3600 } });
                                    window.open(result.url.toString(), "_blank");
                                  } catch (err) {
                                    console.error("Failed to get file URL:", err);
                                    alert("Unable to open file. The storage may not be configured.");
                                  }
                                }}
                              >
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                <span className="truncate text-xs">{key.split("/").pop()}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-amber-600 mt-2">
                      Approving will mark the selected qualifications as verified on this PT&apos;s profile.
                    </p>
                  </div>
                )}

                {/* Bulk edit detail panel */}
                {isBulkEdit && proposed && (
                  <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-blue-800">Bulk Edit — {proposed.gymIds?.length ?? 0} gyms affected</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Field</p>
                        <p className="text-blue-900 font-medium">{proposed.field}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">New value</p>
                        <p className="text-blue-900 font-medium break-all">
                          {Array.isArray(proposed.value)
                            ? proposed.value.join(", ") || "(none)"
                            : typeof proposed.value === "object"
                              ? JSON.stringify(proposed.value)
                              : String(proposed.value) || "(empty)"}
                        </p>
                      </div>
                    </div>
                    {current && Array.isArray(current) && (
                      <details className="text-xs">
                        <summary className="text-blue-700 cursor-pointer hover:underline font-medium">
                          View affected gyms ({current.length})
                        </summary>
                        <ul className="mt-1.5 space-y-1 pl-2">
                          {current.map((g: { gymId: string; gymName: string; currentValue: unknown }) => (
                            <li key={g.gymId} className="flex items-center justify-between py-0.5">
                              <span className="text-gray-700">{g.gymName} <span className="text-gray-400">({g.gymId})</span></span>
                              <span className="text-gray-400 truncate ml-2 max-w-[200px]">
                                Current: {Array.isArray(g.currentValue) ? g.currentValue.join(", ") : String(g.currentValue ?? "—")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <p className="text-xs text-blue-600 mt-2">
                      Approving will apply the new value to all {proposed.gymIds?.length ?? 0} gyms.
                    </p>
                  </div>
                )}

                {/* Meta */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mb-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Owner Email</p>
                    <p className="text-gray-800 break-all">{e.ownerEmail || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Submitted</p>
                    <p className="text-gray-800">{fmtDate(e.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Changes</p>
                    <p className="text-gray-800">
                      {isBulkEdit
                        ? `${proposed?.gymIds?.length ?? 0} gyms × 1 field`
                        : `${changedFields.length} field${changedFields.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>

                {/* Diff table */}
                {changedFields.length > 0 && current && proposed && (
                  <div className="mb-3 overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-left text-gray-400">
                          <th className="pb-1 pr-4 font-medium w-24">Field</th>
                          <th className="pb-1 pr-4 font-medium">Current</th>
                          <th className="pb-1 font-medium">Proposed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changedFields.map((field) => (
                          <tr key={field} className="border-t border-gray-100">
                            <td className="py-1.5 pr-4 text-gray-500 font-medium align-top">{DIFF_LABELS[field]}</td>
                            <td className="py-1.5 pr-4 text-gray-500 align-top line-through max-w-xs truncate">{getFieldValue(current, field) || "—"}</td>
                            <td className="py-1.5 text-green-700 align-top font-medium max-w-xs truncate">{getFieldValue(proposed, field) || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Notes */}
                {e.status === "pending" ? (
                  <div className="mb-3">
                    <label className="text-xs text-gray-400 mb-0.5 block">Internal notes (optional)</label>
                    <textarea
                      rows={2}
                      value={notes[e.id] ?? ""}
                      onChange={(ev) => setNotes((n) => ({ ...n, [e.id]: ev.target.value }))}
                      placeholder="Add rationale for approval or rejection…"
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                    />
                  </div>
                ) : e.notes ? (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-0.5">Notes</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{e.notes}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {e.status === "approved" ? "Approved" : "Rejected"}
                      {e.reviewedBy ? ` by ${e.reviewedBy}` : ""}
                      {" · "}{fmtDate(e.reviewedAt || e.updatedAt)}
                    </p>
                  </div>
                ) : null}

                {/* Actions */}
                {e.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => action(e.id, "approve")}
                      disabled={busy !== null}
                      className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-medium disabled:opacity-50"
                    >
                      {busy === e.id + "approve" ? "Approving…" : "Approve"}
                    </button>
                    <button
                      onClick={() => action(e.id, "reject")}
                      disabled={busy !== null}
                      className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg font-medium disabled:opacity-50"
                    >
                      {busy === e.id + "reject" ? "Rejecting…" : "Reject"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100 text-xs text-gray-500">
            <span>Showing {displayedEdits.length} of {filtered.length}</span>
            <div className="flex items-center gap-2">
              <span>Show:</span>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-orange">
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={0}>All</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gyms tab
// ---------------------------------------------------------------------------
function GymsTab({ initialGymId, adminEmail }: { initialGymId?: string; adminEmail?: string }) {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<{ gym: Gym; isNew: boolean } | null>(null);
  const [originalGym, setOriginalGym] = useState<Gym | null>(null);
  const drafts = useRef<Record<string, Gym>>({});
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmUnclaim, setConfirmUnclaim] = useState<string | null>(null);
  const [affiliatedPts, setAffiliatedPts] = useState<{ id: string; name: string }[]>([]);
  const [newPtId, setNewPtId] = useState("");
  const [scrapedSuggestions, setScrapedSuggestions] = useState<ScrapedFields | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState<{
    price: string;
    priceVerified: "" | "true" | "false";
    ownerId: string;
    isTest: "" | "true" | "false";
    isFeatured: "" | "true" | "false";
    isActive: "" | "true" | "false";
    isPaid: "" | "true" | "false";
    addAmenities: Set<string>;
    removeAmenities: Set<string>;
    addSpecialties: Set<string>;
    removeSpecialties: Set<string>;
    addImages: string;
  }>({ price: "", priceVerified: "", ownerId: "", isTest: "", isFeatured: "", isActive: "", isPaid: "", addAmenities: new Set(), removeAmenities: new Set(), addSpecialties: new Set(), removeSpecialties: new Set(), addImages: "" });
  const [bulkBusy, setBulkBusy] = useState(false);
  const [clearAmenitiesOpen, setClearAmenitiesOpen] = useState(false);
  const [clearWord, setClearWord] = useState("");
  const [clearBusy, setClearBusy] = useState(false);
  const [clearConfirmWord] = useState(() => {
    const words = ["CONFIRM", "ERASE", "CLEAR", "PROCEED", "WIPE", "RESET", "APPLY", "DELETE"];
    return words[Math.floor(Math.random() * words.length)];
  });
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "owned" | "unclaimed">("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "paid" | "featured">("all");
  const [pageSize, setPageSize] = useState(25);
  const [reviewFilter, setReviewFilter] = useState<"all" | "reviewed" | "unreviewed">("all");
  const [sortCol, setSortCol] = useState<string>("ID");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [dynamicAmenities, setDynamicAmenities] = useState<string[]>([...ALL_AMENITIES]);
  const [dynamicSpecialties, setDynamicSpecialties] = useState<string[]>([...ALL_SPECIALTIES]);

  useEffect(() => {
    fetch("/api/datasets/amenities")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.entries?.length) setDynamicAmenities(data.entries); })
      .catch(() => {});
    fetch("/api/datasets/specialties")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.entries?.length) setDynamicSpecialties(data.entries); })
      .catch(() => {});
  }, []);

  // Load affiliated PTs when gym panel opens
  useEffect(() => {
    if (!panel || panel.isNew) { setAffiliatedPts([]); return; }
    const gymId = panel.gym.id;
    adminFetch("/api/admin/pts")
      .then((r) => r.json())
      .then((pts: { id: string; name: string; gymIds: string[] }[]) => {
        setAffiliatedPts(
          pts.filter((p) => (p.gymIds ?? []).includes(gymId)).map((p) => ({ id: p.id, name: p.name }))
        );
      })
      .catch(() => {});
  }, [panel?.gym.id, panel?.isNew]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addPtAffiliation() {
    const ptId = newPtId.trim();
    if (!ptId || !panel) return;
    try {
      const r = await adminFetch(`/api/admin/pt/${ptId}`);
      if (!r.ok) throw new Error("PT not found");
      const pt = await r.json();
      const gymIds = [...new Set([...(pt.gymIds ?? []), panel.gym.id])];
      const r2 = await adminFetch(`/api/admin/pt/${ptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pt, gymIds }),
      });
      if (!r2.ok) throw new Error("Update failed");
      setAffiliatedPts((prev) => [...prev, { id: pt.id, name: pt.name }]);
      setNewPtId("");
    } catch {
      showToast("Failed to add PT — check the ID exists.");
    }
  }

  async function removePtAffiliation(ptId: string) {
    if (!panel) return;
    try {
      const r = await adminFetch(`/api/admin/pt/${ptId}`);
      if (!r.ok) throw new Error("PT not found");
      const pt = await r.json();
      const gymIds = (pt.gymIds ?? []).filter((id: string) => id !== panel.gym.id);
      await adminFetch(`/api/admin/pt/${ptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pt, gymIds }),
      });
      setAffiliatedPts((prev) => prev.filter((p) => p.id !== ptId));
    } catch {
      showToast("Failed to remove PT affiliation.");
    }
  }

  function handleSort(col: string) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  const filteredGyms = gyms.filter((g) => {
    if (activeFilter === "active" && g.isActive === false) return false;
    if (activeFilter === "inactive" && g.isActive !== false) return false;
    if (ownerFilter === "owned" && (g.ownerId === "unclaimed" || g.ownerId === "owner-3")) return false;
    if (ownerFilter === "unclaimed" && g.ownerId !== "unclaimed" && g.ownerId !== "owner-3") return false;
    if (stateFilter !== "all" && g.address.state !== stateFilter) return false;
    if (planFilter === "featured" && !g.isFeatured) return false;
    if (planFilter === "paid" && (!g.isPaid || g.isFeatured)) return false;
    if (planFilter === "free" && (g.isPaid || g.isFeatured)) return false;
    if (reviewFilter === "reviewed" && !g.adminEdited) return false;
    if (reviewFilter === "unreviewed" && g.adminEdited) return false;
    return true;
  });

  const sortedGyms = [...filteredGyms].sort((a, b) => {
    let av = "", bv = "";
    switch (sortCol) {
      case "ID": av = a.id; bv = b.id; break;
      case "Name": av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break;
      case "Owner": av = a.ownerId; bv = b.ownerId; break;
      case "Suburb": av = a.address.suburb.toLowerCase(); bv = b.address.suburb.toLowerCase(); break;
      case "Active": av = a.isActive !== false ? "1" : "0"; bv = b.isActive !== false ? "1" : "0"; break;
      case "Reviewed": av = a.adminEdited ? "1" : "0"; bv = b.adminEdited ? "1" : "0"; break;
      case "Flags": {
        const flags = (g: Gym) => `${g.isFeatured ? "1" : "0"}${g.isTest ? "1" : "0"}${g.isPaid ? "1" : "0"}`;
        av = flags(a); bv = flags(b); break;
      }
    }
    const cmp = av.localeCompare(bv);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const displayedGyms = pageSize === 0 ? sortedGyms : sortedGyms.slice(0, pageSize);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(selected.size === filteredGyms.length ? new Set() : new Set(filteredGyms.map((g) => g.id)));
  }

  function toggleBulkAmenity(amenity: string, mode: "add" | "remove") {
    setBulk((b) => {
      const addAmenities = new Set(b.addAmenities);
      const removeAmenities = new Set(b.removeAmenities);
      if (mode === "add") {
        if (addAmenities.has(amenity)) { addAmenities.delete(amenity); }
        else { addAmenities.add(amenity); removeAmenities.delete(amenity); }
      } else {
        if (removeAmenities.has(amenity)) { removeAmenities.delete(amenity); }
        else { removeAmenities.add(amenity); addAmenities.delete(amenity); }
      }
      return { ...b, addAmenities, removeAmenities };
    });
  }

  function toggleBulkSpecialty(specialty: string, mode: "add" | "remove") {
    setBulk((b) => {
      const addSpecialties = new Set(b.addSpecialties);
      const removeSpecialties = new Set(b.removeSpecialties);
      if (mode === "add") {
        if (addSpecialties.has(specialty)) { addSpecialties.delete(specialty); }
        else { addSpecialties.add(specialty); removeSpecialties.delete(specialty); }
      } else {
        if (removeSpecialties.has(specialty)) { removeSpecialties.delete(specialty); }
        else { removeSpecialties.add(specialty); addSpecialties.delete(specialty); }
      }
      return { ...b, addSpecialties, removeSpecialties };
    });
  }

  function resetBulk() {
    setBulk({ price: "", priceVerified: "", ownerId: "", isTest: "", isFeatured: "", isActive: "", isPaid: "", addAmenities: new Set(), removeAmenities: new Set(), addSpecialties: new Set(), removeSpecialties: new Set(), addImages: "" });
  }

  async function applyBulk() {
    setBulkBusy(true);
    const targets = gyms.filter((g) => selected.has(g.id));
    await Promise.all(
      targets.map((g) => {
        const updated = { ...g };
        const price = parseFloat(bulk.price);
        if (bulk.price !== "" && price > 0) updated.pricePerWeek = price;
        if (bulk.priceVerified !== "") updated.priceVerified = bulk.priceVerified === "true";
        if (bulk.ownerId !== "") updated.ownerId = bulk.ownerId;
        if (bulk.isTest !== "") updated.isTest = bulk.isTest === "true";
        if (bulk.isFeatured !== "") updated.isFeatured = bulk.isFeatured === "true";
        if (bulk.isActive !== "") updated.isActive = bulk.isActive === "true";
        if (bulk.isPaid !== "") updated.isPaid = bulk.isPaid === "true";
        if (bulk.addAmenities.size > 0 || bulk.removeAmenities.size > 0) {
          const amenitySet = new Set(g.amenities);
          bulk.addAmenities.forEach((a) => amenitySet.add(a));
          bulk.removeAmenities.forEach((a) => amenitySet.delete(a));
          updated.amenities = Array.from(amenitySet);
        }
        if (bulk.addSpecialties.size > 0 || bulk.removeSpecialties.size > 0) {
          const specSet = new Set(g.specialties ?? []);
          bulk.addSpecialties.forEach((s) => specSet.add(s));
          bulk.removeSpecialties.forEach((s) => specSet.delete(s));
          updated.specialties = Array.from(specSet);
        }
        if (bulk.addImages.trim()) {
          const newUrls = bulk.addImages.split("\n").map((u) => u.trim()).filter((u) => u.startsWith("http"));
          if (newUrls.length > 0) {
            const toAdd = newUrls.filter((u) => !updated.images.includes(u));
            updated.images = [...updated.images, ...toAdd].slice(0, 6);
          }
        }
        return adminFetch(`/api/admin/gym/${g.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
      })
    );
    setBulkBusy(false);
    setBulkOpen(false);
    setSelected(new Set());
    resetBulk();
    showToast(`Updated ${targets.length} gym${targets.length !== 1 ? "s" : ""}.`);
    search(q);
  }

  async function clearAmenities() {
    setClearBusy(true);
    const targets = gyms.filter((g) => selected.has(g.id));
    await Promise.all(
      targets.map((g) =>
        adminFetch(`/api/admin/gym/${g.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...g, amenities: [] }),
        })
      )
    );
    setClearBusy(false);
    setClearAmenitiesOpen(false);
    setClearWord("");
    setSelected(new Set());
    showToast(`Cleared amenities for ${targets.length} gym${targets.length !== 1 ? "s" : ""}.`);
    search(q);
  }

  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    const r = await adminFetch(`/api/admin/gyms?q=${encodeURIComponent(query)}`);
    setGyms(await r.json());
    setSelected(new Set());
    setHasSearched(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialGymId) return;
    adminFetch(`/api/admin/gym/${initialGymId}`)
      .then((r) => r.json())
      .then((gym: Gym) => { if (gym?.id) { setOriginalGym({ ...gym }); setPanel({ gym, isNew: false }); } })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    search(q);
  }

  // Clear scrape suggestions when switching gyms
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setScrapedSuggestions(null); setDismissedSuggestions(new Set()); }, [panel?.gym?.id]);

  function handleScrapeResults(fields: ScrapedFields) {
    setScrapedSuggestions(fields);
    setDismissedSuggestions(new Set());
  }

  function handleDismissSuggestion(field: string) {
    setDismissedSuggestions((prev) => {
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }

  // Build filtered suggestions (exclude dismissed)
  const activeSuggestions: ScrapedFields | null = scrapedSuggestions
    ? Object.fromEntries(
        Object.entries(scrapedSuggestions).filter(([k]) => !dismissedSuggestions.has(k))
      ) as ScrapedFields
    : null;

  async function handleSave(updated: Gym) {
    if (panel?.isNew) {
      // OwnerGymForm initialises its internal state from props once, so the
      // ownerId typed in the separate input above doesn't reach the form's
      // onSave payload — override it from panel state here.
      const body = { ...updated, ownerId: panel.gym.ownerId, isTest: panel.gym.isTest ?? false, isFeatured: panel.gym.isFeatured ?? false, isActive: panel.gym.isActive !== false, isPaid: panel.gym.isPaid ?? false, createdBy: adminEmail };
      const r = await adminFetch("/api/admin/gyms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        showToast("Gym created.");
        setPanel(null);
        search(q);
      } else {
        showToast("Error creating gym.");
      }
    } else {
      const r = await adminFetch(`/api/admin/gym/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updated, isTest: panel?.gym.isTest ?? false, isFeatured: panel?.gym.isFeatured ?? false, isActive: panel?.gym.isActive !== false, isPaid: panel?.gym.isPaid ?? false }),
      });
      if (r.ok) {
        delete drafts.current[updated.id]; setDraftIds((s) => { const n = new Set(s); n.delete(updated.id); return n; });
        showToast("Gym updated.");
        setPanel(null);
        search(q);
      } else {
        showToast("Error updating gym.");
      }
    }
  }

  async function handleDelete(id: string) {
    const r = await adminFetch(`/api/admin/gym/${id}`, { method: "DELETE" });
    if (r.ok) {
      delete drafts.current[id]; setDraftIds((s) => { const n = new Set(s); n.delete(id); return n; });
      showToast("Gym deleted.");
      setConfirmDelete(null);
      search(q);
    } else {
      showToast("Error deleting gym.");
    }
  }

  async function handleUnclaim(id: string) {
    const gym = gyms.find((g) => g.id === id);
    if (!gym) return;
    const r = await adminFetch(`/api/admin/gym/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...gym, ownerId: "unclaimed" }),
    });
    if (r.ok) {
      showToast("Gym reverted to unclaimed.");
      setConfirmUnclaim(null);
      search(q);
    } else {
      showToast("Error unclaiming gym.");
    }
  }

  async function toggleActive(g: Gym) {
    const updated = { ...g, isActive: g.isActive === false ? true : false };
    const r = await adminFetch(`/api/admin/gym/${g.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (r.ok) {
      setGyms((prev) => prev.map((gym) => gym.id === g.id ? updated : gym));
    } else {
      showToast("Error updating gym.");
    }
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white bg-green-600">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, ID, owner, suburb, or postcode…"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg"
          >
            Search
          </button>
        </form>
      </div>

      {/* Filter controls */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value as typeof ownerFilter)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        >
          <option value="all">All owners</option>
          <option value="owned">Owned</option>
          <option value="unclaimed">Unclaimed</option>
        </select>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        >
          <option value="all">All states</option>
          {["WA", "NSW", "VIC", "QLD", "SA", "TAS", "ACT", "NT"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        >
          <option value="all">All plans</option>
          <option value="featured">Featured</option>
          <option value="paid">Paid</option>
          <option value="free">Free</option>
        </select>
        <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value as typeof reviewFilter)} className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange">
          <option value="all">All review status</option>
          <option value="reviewed">Admin reviewed</option>
          <option value="unreviewed">Not reviewed</option>
        </select>
        <button
          onClick={() => { setActiveFilter("all"); setOwnerFilter("all"); setStateFilter("all"); setPlanFilter("all"); setReviewFilter("all"); }}
          className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
        >
          Clear
        </button>
        <button
          onClick={() => { setActiveFilter("all"); setOwnerFilter("all"); setStateFilter("all"); setPlanFilter("all"); setReviewFilter("all"); }}
          className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
        >
          Reset
        </button>
        <span className="text-sm text-gray-400">{filteredGyms.length} gym{filteredGyms.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">{selected.size} gym{selected.size !== 1 ? "s" : ""} selected</span>
          <button
            onClick={() => setBulkOpen(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
          >
            Bulk Edit
          </button>
          <button
            onClick={() => { setClearWord(""); setClearAmenitiesOpen(true); }}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg"
          >
            Clear Amenities
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-blue-600 hover:underline">
            Deselect
          </button>
        </div>
      )}

      {/* Bulk edit modal */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              Bulk Edit — {selected.size} gym{selected.size !== 1 ? "s" : ""}
            </h3>
            <p className="text-xs text-gray-400 mb-5">Only filled fields will be applied. Blank = no change.</p>

            <div className="space-y-4">
              {/* Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Price per week ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={bulk.price}
                    onChange={(e) => setBulk((b) => ({ ...b, price: e.target.value }))}
                    placeholder="Leave blank = no change"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Price verified</label>
                  <select
                    value={bulk.priceVerified}
                    onChange={(e) => setBulk((b) => ({ ...b, priceVerified: e.target.value as "" | "true" | "false" }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">No change</option>
                    <option value="true">Set verified ✓</option>
                    <option value="false">Set unverified</option>
                  </select>
                </div>
              </div>

              {/* Owner / Test */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Owner ID</label>
                  <input
                    value={bulk.ownerId}
                    onChange={(e) => setBulk((b) => ({ ...b, ownerId: e.target.value }))}
                    placeholder="Leave blank = no change"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Test listing</label>
                  <select
                    value={bulk.isTest}
                    onChange={(e) => setBulk((b) => ({ ...b, isTest: e.target.value as "" | "true" | "false" }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">No change</option>
                    <option value="true">Mark as test</option>
                    <option value="false">Mark as live</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Featured listing</label>
                  <select
                    value={bulk.isFeatured}
                    onChange={(e) => setBulk((b) => ({ ...b, isFeatured: e.target.value as "" | "true" | "false" }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">No change</option>
                    <option value="true">Set featured ★</option>
                    <option value="false">Remove featured</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Active status</label>
                  <select
                    value={bulk.isActive}
                    onChange={(e) => setBulk((b) => ({ ...b, isActive: e.target.value as "" | "true" | "false" }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">No change</option>
                    <option value="true">Set active</option>
                    <option value="false">Set inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Paid listing</label>
                  <select
                    value={bulk.isPaid}
                    onChange={(e) => setBulk((b) => ({ ...b, isPaid: e.target.value as "" | "true" | "false" }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">No change</option>
                    <option value="true">Set paid ★</option>
                    <option value="false">Set free</option>
                  </select>
                </div>
              </div>

              {/* Images */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Add images (one URL per line)</p>
                <textarea
                  value={bulk.addImages}
                  onChange={(e) => setBulk((b) => ({ ...b, addImages: e.target.value }))}
                  placeholder={"https://example.com/gym-photo-1.jpg\nhttps://example.com/gym-photo-2.jpg"}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">Appended to each gym&apos;s existing images. Max 6 per gym total. Useful for gym chains sharing stock photos.</p>
              </div>

              {/* Amenities */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Amenities</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {dynamicAmenities.map((a) => {
                    const adding = bulk.addAmenities.has(a);
                    const removing = bulk.removeAmenities.has(a);
                    return (
                      <div key={a} className="flex items-center gap-2 text-sm">
                        <span className="w-28 text-gray-700 truncate">{AMENITY_ICONS[a]} {a}</span>
                        <button
                          onClick={() => toggleBulkAmenity(a, "add")}
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${adding ? "bg-green-100 border-green-400 text-green-800" : "border-gray-200 text-gray-400 hover:border-green-300"}`}
                        >
                          + Add
                        </button>
                        <button
                          onClick={() => toggleBulkAmenity(a, "remove")}
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${removing ? "bg-red-100 border-red-400 text-red-700" : "border-gray-200 text-gray-400 hover:border-red-300"}`}
                        >
                          − Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Specialties */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Specialties</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {dynamicSpecialties.map((s) => {
                    const adding = bulk.addSpecialties.has(s);
                    const removing = bulk.removeSpecialties.has(s);
                    return (
                      <div key={s} className="flex items-center gap-2 text-sm">
                        <span className="w-28 text-gray-700 truncate">{s}</span>
                        <button
                          onClick={() => toggleBulkSpecialty(s, "add")}
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${adding ? "bg-green-100 border-green-400 text-green-800" : "border-gray-200 text-gray-400 hover:border-green-300"}`}
                        >
                          + Add
                        </button>
                        <button
                          onClick={() => toggleBulkSpecialty(s, "remove")}
                          className={`px-2 py-0.5 rounded text-xs font-medium border ${removing ? "bg-red-100 border-red-400 text-red-700" : "border-gray-200 text-gray-400 hover:border-red-300"}`}
                        >
                          − Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => { setBulkOpen(false); resetBulk(); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={applyBulk}
                disabled={bulkBusy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {bulkBusy ? "Applying…" : `Apply to ${selected.size} gym${selected.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Amenities confirmation modal */}
      {clearAmenitiesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Clear Amenities</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will remove <strong>all amenities</strong> from{" "}
              <strong>{selected.size} gym{selected.size !== 1 ? "s" : ""}</strong>. This cannot be undone.
            </p>
            <p className="text-sm text-gray-700 mb-2">
              Type <span className="font-mono font-bold text-red-600">{clearConfirmWord}</span> to confirm:
            </p>
            <input
              type="text"
              value={clearWord}
              onChange={(e) => setClearWord(e.target.value.toUpperCase())}
              placeholder={clearConfirmWord}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono mb-5 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setClearAmenitiesOpen(false); setClearWord(""); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={clearAmenities}
                disabled={clearWord !== clearConfirmWord || clearBusy}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {clearBusy ? "Clearing…" : `Clear amenities for ${selected.size} gym${selected.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{filteredGyms.length} result{filteredGyms.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setPanel({ gym: EMPTY_GYM, isNew: true })}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg whitespace-nowrap"
        >
          + New Gym
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12"><p className="text-gray-400 text-sm">Loading…</p></div>
      ) : (
        <>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={gyms.length > 0 && selected.size === gyms.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-brand-orange"
                  />
                </th>
                {["ID", "Name", "Owner", "Suburb", "Active", "Reviewed", "Flags", "Actions"].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-left font-medium ${h !== "Actions" ? "cursor-pointer select-none hover:text-gray-700" : ""}`}
                    onClick={h !== "Actions" ? () => handleSort(h) : undefined}
                  >
                    {h}
                    {sortCol === h && (
                      <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedGyms.map((g) => (
                <tr key={g.id} className={selected.has(g.id) ? "bg-blue-50" : ""}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(g.id)}
                      onChange={() => toggleSelect(g.id)}
                      className="w-4 h-4 accent-brand-orange"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{g.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                  <td className="px-4 py-3 text-gray-600">{g.ownerId}</td>
                  <td className="px-4 py-3 text-gray-600">{g.address.suburb}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(g)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${g.isActive !== false ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                    >
                      {g.isActive !== false ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {g.adminEdited ? (
                      <span className="text-green-700 font-medium">
                        Yes
                        <span className="block text-gray-400 text-[10px]">{g.adminEditedAt ? new Date(g.adminEditedAt).toLocaleDateString() : ""}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {g.isFeatured && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">★ Featured</span>
                      )}
                      {g.isTest && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">Test</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a
                      href={gymUrl(g)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      View
                    </a>
                    <button
                      onClick={() => { setOriginalGym({ ...g }); setPanel({ gym: drafts.current[g.id] ?? g, isNew: false }); }}
                      className="text-brand-orange hover:underline text-sm font-medium ml-3"
                    >
                      Edit
                    </button>
                    {draftIds.has(g.id) && <span className="ml-2 text-xs text-amber-600 font-medium">Unsaved edits</span>}
                    {g.ownerId !== "unclaimed" && g.ownerId !== "owner-3" && (
                      <button
                        onClick={() => setConfirmUnclaim(g.id)}
                        className="text-amber-500 hover:underline text-sm font-medium ml-3"
                      >
                        Unclaim
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDelete(g.id)}
                      className="text-red-500 hover:underline text-sm font-medium ml-3"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {filteredGyms.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <p className="text-gray-400 text-sm">{hasSearched ? "No gyms found." : "Search to load gyms."}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100 text-xs text-gray-500">
          <span>Showing {displayedGyms.length} of {filteredGyms.length}</span>
          <div className="flex items-center gap-2">
            <span>Show:</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-orange">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All</option>
            </select>
          </div>
        </div>
        </>
      )}

      {/* Slide-in edit panel */}
      {panel && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => {
              if (!panel.isNew) { drafts.current[panel.gym.id] = { ...panel.gym }; setDraftIds((s) => new Set(s).add(panel.gym.id)); }
              setPanel(null);
            }}
          />
          <div className="w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-3 z-10">
              <h2 className="text-lg font-bold text-gray-900 mb-2">
                {panel.isNew ? "New Gym" : `Edit: ${panel.gym.name}`}
              </h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {!panel.isNew && panel.gym.adminEdited && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 border border-green-200">
                      Admin Reviewed {panel.gym.adminEditedAt ? new Date(panel.gym.adminEditedAt).toLocaleDateString() : ""}
                    </span>
                  )}
                  {!panel.isNew && draftIds.has(panel.gym.id) && (
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-200">Unsaved edits</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {!panel.isNew && panel.gym.suburbSlug && panel.gym.slug && (
                    <a
                      href={gymUrl(panel.gym)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-[5px] text-brand-orange border border-brand-orange-light rounded-lg text-sm hover:bg-orange-50 font-medium"
                    >
                      View
                    </a>
                  )}
                  {!panel.isNew && (
                    <button onClick={() => setConfirmDelete(panel.gym.id)} className="px-3 py-[5px] text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50">Delete</button>
                  )}
                  <button onClick={() => {
                    if (!panel.isNew) { delete drafts.current[panel.gym.id]; setDraftIds((s) => { const n = new Set(s); n.delete(panel.gym.id); return n; }); }
                    setPanel(null);
                  }} className="px-3 py-[5px] text-gray-500 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
                  <button type="submit" form="gym-edit-form" className="px-4 py-[5px] bg-brand-orange text-white rounded-lg text-sm font-medium">Save</button>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* ============================================================= */}
              {/* ADMIN-ONLY SECTION                                             */}
              {/* ============================================================= */}

              {/* Flags + Owner + Stripe */}
              <section className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Admin Controls</h3>
                <div className="grid grid-cols-2 gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={panel.gym.isActive !== false} onChange={(e) => setPanel((p) => p ? { ...p, gym: { ...p.gym, isActive: e.target.checked } } : p)} className="w-4 h-4 accent-brand-orange" />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={panel.gym.isTest ?? false} onChange={(e) => setPanel((p) => p ? { ...p, gym: { ...p.gym, isTest: e.target.checked } } : p)} className="w-4 h-4 accent-brand-orange" />
                    <span className="text-sm">Test</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={panel.gym.isPaid ?? false} onChange={(e) => {
                      const isPaid = e.target.checked;
                      setPanel((p) => {
                        if (!p) return p;
                        const gym = { ...p.gym, isPaid };
                        if (!isPaid) { gym.memberOffers = []; gym.memberOffersScroll = false; delete gym.memberOffersNotes; delete gym.memberOffersTnC; }
                        return { ...p, gym };
                      });
                    }} className="w-4 h-4 accent-brand-orange" />
                    <span className="text-sm">Paid</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={panel.gym.isFeatured ?? false} onChange={(e) => setPanel((p) => p ? { ...p, gym: { ...p.gym, isFeatured: e.target.checked } } : p)} className="w-4 h-4 accent-brand-orange" />
                    <span className="text-sm">Featured</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner ID</label>
                    <input
                      value={panel.gym.ownerId}
                      onChange={(e) => setPanel((p) => p ? { ...p, gym: { ...p.gym, ownerId: e.target.value } } : p)}
                      placeholder={panel.isNew ? "Leave blank for unclaimed" : ""}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Plan <span className="text-gray-400 font-normal">(billing tier — flag manually override)</span></label>
                    <select
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                      value={panel.gym.stripePlan ?? ""}
                      onChange={(e) => setPanel((p) => p ? { ...p, gym: { ...p.gym, stripePlan: (e.target.value || undefined) as Gym["stripePlan"] } } : p)}
                    >
                      <option value="">None</option>
                      <option value="paid">Paid</option>
                      <option value="featured">Featured</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Affiliated PTs */}
              <section className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Affiliated PTs</h3>
                {affiliatedPts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {affiliatedPts.map((pt) => (
                      <span key={pt.id} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 text-sm">
                        {pt.name || pt.id}
                        <button onClick={() => removePtAffiliation(pt.id)} className="text-gray-400 hover:text-red-500 ml-1">&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                {affiliatedPts.length === 0 && !panel.isNew && (
                  <p className="text-xs text-gray-400 mb-2">No affiliated PTs</p>
                )}
                <div className="flex gap-2">
                  <input
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                    value={newPtId}
                    onChange={(e) => setNewPtId(e.target.value)}
                    placeholder="PT ID (e.g. pt-001)"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPtAffiliation(); } }}
                  />
                  <button onClick={addPtAffiliation} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-100 shrink-0">Add</button>
                </div>
              </section>

              <hr className="border-gray-300" />

              <ScanButton websiteUrl={panel.gym.website || ""} type="gym" onResults={handleScrapeResults} />
              <OwnerGymForm gym={panel.gym} original={originalGym ?? undefined} onSave={handleSave} isAdmin suggestions={activeSuggestions} onDismissSuggestion={handleDismissSuggestion} onFormChange={(updated) => setPanel((p) => p ? { ...p, gym: { ...p.gym, ...updated } } : p)} />
            </div>
          </div>
        </div>
      )}

      {/* Unclaim confirmation modal */}
      {confirmUnclaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Revert gym to unclaimed?</h3>
            <p className="text-sm text-gray-500 mb-1">
              Gym <span className="font-mono font-medium">{confirmUnclaim}</span> will be set to <span className="font-medium">unclaimed</span>.
            </p>
            <p className="text-sm text-gray-400 mb-5">The owner&apos;s Cognito account is not affected — only this gym is released.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmUnclaim(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUnclaim(confirmUnclaim)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg"
              >
                Unclaim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete gym?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete gym <span className="font-mono">{confirmDelete}</span> from DynamoDB. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Users tab
// ---------------------------------------------------------------------------
function UsersTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [users, setUsers] = useState<CognitoUser[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(25);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [gymFilter, setGymFilter] = useState<"all" | "with-gym" | "no-gym">("all");
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ email: "", password: "", ownerId: "", isAdmin: false, isSuperAdmin: false });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [editOwnerFor, setEditOwnerFor] = useState<string | null>(null);
  const [editOwnerVal, setEditOwnerVal] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  function showToast(msg: string, error = false) {
    setToast(msg);
    setTimeout(() => setToast(""), error ? 8000 : 3000);
  }

  const search = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const r = await adminFetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
      const data = await r.json();
      if (r.ok && Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
        setToast(`Failed to load users: ${data?.error ?? r.statusText}`);
        setTimeout(() => setToast(""), 8000);
      }
    } catch (err) {
      setUsers([]);
      setToast(`Network error: ${String(err)}`);
      setTimeout(() => setToast(""), 8000);
    }
    setLoading(false);
  }, [setToast]);

  useEffect(() => { search(""); }, [search]);

  async function createUser() {
    const r = await adminFetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    if (r.ok) {
      showToast("User created.");
      setShowNew(false);
      setNewForm({ email: "", password: "", ownerId: "", isAdmin: false, isSuperAdmin: false });
      search(q);
    } else {
      const body = await r.json().catch(() => ({}));
      showToast(`Error: ${body.error ?? r.statusText}`);
    }
  }

  async function deleteUser(username: string) {
    const r = await adminFetch(`/api/admin/users/${encodeURIComponent(username)}`, { method: "DELETE" });
    const body = await r.json().catch(() => ({}));
    if (r.ok) {
      const n = body.gymsReleased ?? 0;
      showToast(n > 0 ? `User deleted. ${n} gym${n !== 1 ? "s" : ""} reverted to unclaimed.` : "User deleted.");
      setConfirmDelete(null);
      search(q);
    } else {
      showToast(`Error: ${body.error ?? r.statusText}`);
    }
  }

  async function resetPassword(username: string) {
    const r = await adminFetch(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPw }),
    });
    if (r.ok) {
      showToast("Password reset.");
      setResetFor(null);
      setResetPw("");
    } else {
      const body = await r.json().catch(() => ({}));
      showToast(`Reset failed: ${body.error ?? r.statusText}`, true);
    }
  }

  async function setOwnerId(username: string) {
    const r = await adminFetch(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: editOwnerVal }),
    });
    if (r.ok) {
      showToast("Owner ID updated.");
      setEditOwnerFor(null);
      setEditOwnerVal("");
      search(q);
    } else {
      showToast("Error updating Owner ID.");
    }
  }

  async function toggleSuperAdmin(username: string, email: string, currentValue: boolean) {
    if (email.toLowerCase() === "admin@mynextgym.com.au" && currentValue) {
      showToast("Cannot revoke super-admin from admin@mynextgym.com.au", true);
      return;
    }
    const r = await adminFetch(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSuperAdmin: currentValue ? "" : "true" }),
    });
    if (r.ok) {
      showToast(currentValue ? "Super-admin revoked." : "Super-admin granted.");
      search(q);
    } else {
      const body = await r.json().catch(() => ({}));
      showToast(`Error: ${body.error ?? r.statusText}`, true);
    }
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white bg-green-600">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <form
          onSubmit={(e) => { e.preventDefault(); search(q); }}
          className="flex gap-2 flex-1 min-w-[200px]"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email…"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg"
          >
            Search
          </button>
        </form>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)} className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive / Disabled</option>
        </select>
        <select value={gymFilter} onChange={(e) => setGymFilter(e.target.value as typeof gymFilter)} className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange">
          <option value="all">All users</option>
          <option value="with-gym">Has gym claim</option>
          <option value="no-gym">No gym claim</option>
        </select>
        <button
          onClick={() => { setActiveFilter("all"); setGymFilter("all"); }}
          className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
        >
          Clear
        </button>
        <button
          onClick={() => {
            const autoId = `owner-${crypto.randomUUID()}`;
            setNewForm((f) => ({ ...f, ownerId: autoId }));
            setShowNew(true);
          }}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg whitespace-nowrap"
        >
          + New User
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12"><p className="text-gray-400 text-sm">Loading…</p></div>
      ) : (
        <>
        {(() => {
          const filteredUsers = users.filter((u) => {
            if (activeFilter === "active" && !u.enabled) return false;
            if (activeFilter === "inactive" && u.enabled) return false;
            if (gymFilter === "with-gym" && !u.ownerId) return false;
            if (gymFilter === "no-gym" && u.ownerId) return false;
            return true;
          });
          const displayedUsers = pageSize === 0 ? filteredUsers : filteredUsers.slice(0, pageSize);
          return (
        <>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {["Email", "Status", "Owner ID", "Admin", "Super", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedUsers.map((u) => (
                <tr key={u.username}>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge status={u.status?.toLowerCase()} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.ownerId || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {u.isAdmin === "true" ? (
                      <span className="text-brand-orange font-semibold">Yes</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {u.isSuperAdmin === "true" ? (
                      <span className="text-purple-600 font-semibold">Yes</span>
                    ) : "—"}
                    {isSuperAdmin && u.isAdmin === "true" && (
                      <button
                        onClick={() => toggleSuperAdmin(u.username, u.email, u.isSuperAdmin === "true")}
                        className={`ml-2 text-xs font-medium ${
                          u.isSuperAdmin === "true"
                            ? "text-red-400 hover:text-red-600"
                            : "text-purple-400 hover:text-purple-600"
                        }`}
                      >
                        {u.isSuperAdmin === "true" ? "Revoke" : "Grant"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editOwnerFor === u.username ? (
                      <div className="flex gap-2 items-center">
                        <input
                          value={editOwnerVal}
                          onChange={(e) => setEditOwnerVal(e.target.value)}
                          placeholder="owner-xxxxxxxx"
                          className="px-2 py-1 border rounded text-xs w-36 font-mono focus:outline-none focus:ring-1 focus:ring-brand-orange"
                        />
                        <button
                          onClick={() => setOwnerId(u.username)}
                          className="px-2 py-1 bg-brand-orange text-white text-xs rounded font-medium"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditOwnerFor(null); setEditOwnerVal(""); }}
                          className="text-gray-400 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : resetFor === u.username ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={resetPw}
                            onChange={(e) => setResetPw(e.target.value)}
                            placeholder="New password"
                            className="px-2 py-1 border rounded text-xs w-40 focus:outline-none focus:ring-1 focus:ring-brand-orange font-mono"
                          />
                          <button
                            onClick={() => resetPassword(u.username)}
                            className="px-2 py-1 bg-brand-orange text-white text-xs rounded font-medium"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setResetFor(null); setResetPw(""); }}
                            className="text-gray-400 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="text-xs text-gray-400">Min 8 chars, upper + lower + number + symbol</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setEditOwnerFor(u.username); setEditOwnerVal(u.ownerId || ""); }}
                          className="text-blue-500 hover:underline text-xs font-medium"
                        >
                          Set ID
                        </button>
                        <button
                          onClick={() => setResetFor(u.username)}
                          className="text-brand-orange hover:underline text-xs font-medium"
                        >
                          Reset Password
                        </button>
                        {confirmDelete === u.username ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600">Delete?</span>
                            <button
                              onClick={() => deleteUser(u.username)}
                              className="px-2 py-0.5 bg-red-600 text-white text-xs rounded font-medium"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(u.username)}
                            className="text-red-400 hover:text-red-600 text-xs font-medium"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <p className="text-gray-400 text-sm">No users found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100 text-xs text-gray-500">
          <span>Showing {displayedUsers.length} of {filteredUsers.length}{filteredUsers.length !== users.length ? ` (${users.length} total)` : ""}</span>
          <div className="flex items-center gap-2">
            <span>Show:</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-orange">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All</option>
            </select>
          </div>
        </div>
        </>
          );
        })()}
        </>
      )}

      {/* New user modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Create User</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newForm.email}
                  onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newForm.password}
                  onChange={(e) => setNewForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Owner ID (optional)
                </label>
                <input
                  value={newForm.ownerId}
                  onChange={(e) => setNewForm((f) => ({ ...f, ownerId: e.target.value }))}
                  placeholder="owner-7"
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newForm.isAdmin}
                  onChange={(e) => setNewForm((f) => ({ ...f, isAdmin: e.target.checked }))}
                  className="w-4 h-4 accent-brand-orange"
                />
                <span className="text-sm text-gray-700">Admin user</span>
              </label>
              {isSuperAdmin && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newForm.isSuperAdmin}
                    onChange={(e) => setNewForm((f) => ({ ...f, isSuperAdmin: e.target.checked }))}
                    className="w-4 h-4 accent-purple-600"
                  />
                  <span className="text-sm text-gray-700">Super-admin</span>
                </label>
              )}
            </div>
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => setShowNew(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={createUser}
                className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leads tab
// ---------------------------------------------------------------------------
interface LeadRecord {
  id: string;
  gymId: string;
  gymName?: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  customData?: string;
  entityType?: "gym" | "pt";
  createdAt?: string;
  status?: string;
  notes?: string;
}

function defaultLeadsDateFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function LeadsTab({ onPendingCount }: { onPendingCount?: (n: number) => void }) {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultLeadsDateFrom);
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await adminFetch("/api/admin/leads");
        if (r.ok) {
          const data = await r.json();
          setLeads(data);
          onPendingCount?.(data.filter((l: LeadRecord) => !l.status || l.status === "new").length);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [onPendingCount]);

  const filtered = leads.filter((l) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !l.name.toLowerCase().includes(q) &&
        !l.email.toLowerCase().includes(q) &&
        !(l.phone ?? "").toLowerCase().includes(q) &&
        !(l.gymName ?? l.gymId).toLowerCase().includes(q)
      ) return false;
    }
    const date = (l.createdAt ?? "").slice(0, 10);
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  });

  const displayed = pageSize === 0 ? filtered : filtered.slice(0, pageSize);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-base font-semibold text-gray-900 shrink-0">Leads</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone, gym/PT…"
          className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        />
        <span className="text-gray-400 text-sm">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        />
        <button onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }} className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap">Clear</button>
        <button onClick={() => { setSearch(""); setDateFrom(defaultLeadsDateFrom()); setDateTo(""); }} className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap">Reset</button>
      </div>
      {loading ? (
        <div className="text-center py-12"><p className="text-gray-400 text-sm">Loading…</p></div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12"><p className="text-gray-400 text-sm">No leads yet.</p></div>
      ) : (
        <>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                {["Date", "Type", "Listing", "Name", "Email", "Phone", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.map((l) => {
                const isPT = l.entityType === "pt" || l.gymId.startsWith("pt-");
                const profileUrl = isPT ? `/pt/${l.gymId}` : `/gym/${l.gymId}`;
                return (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                  <td className="px-4 py-3">
                    {isPT ? (
                      <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">PT</span>
                    ) : (
                      <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Gym</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-brand-orange">
                      {l.gymName || l.gymId}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{l.name}</td>
                  <td className="px-4 py-3 text-gray-700 break-all">{l.email}</td>
                  <td className="px-4 py-3 text-gray-700">{l.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      !l.status || l.status === "new" ? "bg-orange-100 text-orange-800" :
                      l.status === "contacted" ? "bg-green-100 text-green-800" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {(l.status ?? "new").charAt(0).toUpperCase() + (l.status ?? "new").slice(1)}
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100 text-xs text-gray-500">
          <span>Showing {displayed.length} of {filtered.length}{filtered.length !== leads.length ? ` (${leads.length} total)` : ""}</span>
          <div className="flex items-center gap-2">
            <span>Show:</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-orange">
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>All</option>
            </select>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Datasets tab
// ---------------------------------------------------------------------------
interface DatasetRecord {
  id: string;
  name: string;
  entries: string[];
}

function DatasetsTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [selected, setSelected] = useState<DatasetRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<string[]>([]);
  const [newEntry, setNewEntry] = useState("");
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/datasets");
      const data = await r.json();
      setDatasets(Array.isArray(data) ? data : []);
    } catch { setDatasets([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function selectDataset(ds: DatasetRecord | null) {
    setSelected(ds);
    setEntries(ds ? [...ds.entries] : []);
    setNewEntry("");
    setEditIdx(null);
    setStatusMsg(null);
  }

  function addEntry() {
    const val = newEntry.trim();
    if (!val || entries.includes(val)) return;
    setEntries((prev) => [...prev, val]);
    setNewEntry("");
  }

  function removeEntry(idx: number) {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }

  function startEdit(idx: number) {
    setEditIdx(idx);
    setEditValue(entries[idx]);
  }

  function saveEdit() {
    if (editIdx === null) return;
    const val = editValue.trim();
    if (!val) return;
    setEntries((prev) => prev.map((e, i) => (i === editIdx ? val : e)));
    setEditIdx(null);
    setEditValue("");
  }

  async function saveDataset() {
    if (!selected) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const r = await adminFetch("/api/admin/datasets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, entries }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
        setStatusMsg({ type: "error", text: err.error || `Save failed (${r.status})` });
        return;
      }
      const result = await r.json();
      // If a fallback was promoted to DynamoDB, use the real ID going forward
      const newId = result.id ?? selected.id;
      const updated = { ...selected, id: newId, entries: [...entries] };
      setSelected(updated);
      setDatasets((prev) => prev.map((d) => (d.id === selected.id ? updated : d)));
      const gymsNote = result.gymsUpdated > 0 ? ` (${result.gymsUpdated} gym${result.gymsUpdated === 1 ? "" : "s"} updated)` : "";
      setStatusMsg({ type: "success", text: `Saved successfully${gymsNote}` });
    } catch (err) {
      setStatusMsg({ type: "error", text: `Save failed: ${err instanceof Error ? err.message : "Unknown error"}` });
    } finally { setSaving(false); }
  }

  async function doDeleteDataset() {
    if (!selected) return;
    await adminFetch(`/api/admin/datasets?id=${selected.id}`, { method: "DELETE" });
    setSelected(null);
    setEntries([]);
    load();
  }

  async function createDataset() {
    const name = newDatasetName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name) return;
    setCreating(true);
    try {
      const r = await adminFetch("/api/admin/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, entries: [] }),
      });
      if (r.ok) {
        const ds = await r.json();
        setDatasets((prev) => [...prev, ds]);
        selectDataset(ds);
        setNewDatasetName("");
      } else {
        const err = await r.json();
        alert(err.error || "Failed to create dataset");
      }
    } finally { setCreating(false); }
  }

  const [generatingIcons, setGeneratingIcons] = useState(false);

  async function generateIcons() {
    setGeneratingIcons(true);
    setStatusMsg(null);
    try {
      const r = await adminFetch("/api/admin/generate-icons", { method: "POST" });
      const data = await r.json();
      if (r.ok) {
        const total = (data.results ?? []).reduce((sum: number, r: { generated: string[] }) => sum + r.generated.length, 0);
        setStatusMsg({ type: "success", text: total > 0 ? `Generated ${total} icon(s)` : "All icons up to date" });
      } else {
        setStatusMsg({ type: "error", text: data.error || "Icon generation failed" });
      }
    } catch {
      setStatusMsg({ type: "error", text: "Icon generation failed" });
    }
    setGeneratingIcons(false);
  }

  const dirty = selected && JSON.stringify(entries) !== JSON.stringify(selected.entries);

  // Compute removed entries (present in original but missing from current)
  const removedEntries = selected
    ? selected.entries.filter((e) => !entries.includes(e))
    : [];

  // Generate a random 6-letter word for confirmation
  function generateConfirmWord() {
    const words = ["orange", "basket", "rocket", "castle", "forest", "planet", "bridge", "marble", "garden", "silver", "sunset", "breeze"];
    return words[Math.floor(Math.random() * words.length)];
  }

  function requestSaveConfirm() {
    if (removedEntries.length > 0) {
      const word = generateConfirmWord();
      setConfirmWord(word);
      setConfirmInput("");
      setShowSaveConfirm(true);
    } else {
      saveDataset();
    }
  }

  function requestDeleteConfirm() {
    const word = generateConfirmWord();
    setConfirmWord(word);
    setConfirmInput("");
    setShowDeleteConfirm(true);
  }

  if (loading) return <div className="text-center py-12"><p className="text-gray-400 text-sm">Loading datasets…</p></div>;

  return (
    <div className="space-y-6">
      {/* Confirmation modal for save (when entries removed) */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Save</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 font-medium mb-1">Warning: Removing entries from listings</p>
              <p className="text-sm text-amber-700">
                {removedEntries.length} {removedEntries.length === 1 ? "entry" : "entries"} will be removed from <strong>all gym listings</strong> that currently use {removedEntries.length === 1 ? "it" : "them"}:
              </p>
              <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
                {removedEntries.map((e) => (
                  <li key={e} className="text-sm text-amber-800 font-medium">&bull; {e}</li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Type <strong className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{confirmWord}</strong> to confirm:
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange mb-4"
              placeholder={`Type "${confirmWord}" to confirm`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmInput === confirmWord) {
                  setShowSaveConfirm(false);
                  saveDataset();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowSaveConfirm(false); saveDataset(); }}
                disabled={confirmInput !== confirmWord}
                className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal for delete */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Delete Dataset</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800 font-medium mb-1">This cannot be undone</p>
              <p className="text-sm text-red-700">
                Deleting &ldquo;{selected?.name}&rdquo; will remove all {selected?.entries.length ?? 0} entries from every gym listing that uses them.
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Type <strong className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{confirmWord}</strong> to confirm:
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
              placeholder={`Type "${confirmWord}" to confirm`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && confirmInput === confirmWord) {
                  setShowDeleteConfirm(false);
                  doDeleteDataset();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); doDeleteDataset(); }}
                disabled={confirmInput !== confirmWord}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Delete Dataset
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select dataset</label>
          <select
            className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[200px] focus:outline-none focus:ring-2 focus:ring-brand-orange"
            value={selected?.id ?? ""}
            onChange={(e) => {
              const ds = datasets.find((d) => d.id === e.target.value) ?? null;
              selectDataset(ds);
            }}
          >
            <option value="">Choose...</option>
            {datasets.map((ds) => (
              <option key={ds.id} value={ds.id}>{ds.name} ({ds.entries.length} entries)</option>
            ))}
          </select>
        </div>
        {isSuperAdmin && (
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New dataset</label>
              <input
                type="text"
                value={newDatasetName}
                onChange={(e) => setNewDatasetName(e.target.value)}
                placeholder="e.g. class-types"
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createDataset(); } }}
              />
            </div>
            <button
              onClick={createDataset}
              disabled={creating || !newDatasetName.trim()}
              className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              Create
            </button>
          </div>
        )}
      </div>

      {!isSuperAdmin && (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3">
          Dataset editing is restricted to super-admins. Contact admin@mynextgym.com.au for changes.
        </p>
      )}

      {selected && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{selected.name}</h3>
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                {statusMsg && (
                  <span className={`text-xs font-medium ${statusMsg.type === "success" ? "text-green-600" : "text-red-600"}`}>{statusMsg.text}</span>
                )}
                {dirty && !statusMsg && (
                  <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
                )}
                <button
                  onClick={requestSaveConfirm}
                  disabled={saving || !dirty}
                  className="px-4 py-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={generateIcons}
                  disabled={generatingIcons}
                  className="px-4 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {generatingIcons ? "Generating..." : "Generate SVGs"}
                </button>
                <button
                  onClick={requestDeleteConfirm}
                  className="px-4 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Add entry — superadmin only */}
          {isSuperAdmin && (
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                placeholder="Add new entry..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEntry(); } }}
              />
              <button
                onClick={addEntry}
                disabled={!newEntry.trim() || entries.includes(newEntry.trim())}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}

          {/* Entries list */}
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No entries yet.{isSuperAdmin ? " Add one above." : ""}</p>
          ) : (
            <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
              {entries.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 group">
                  {editIdx === idx ? (
                    <>
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditIdx(null); }}
                        autoFocus
                      />
                      <button onClick={saveEdit} className="text-xs text-green-600 hover:text-green-700 font-medium">Save</button>
                      <button onClick={() => setEditIdx(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-800">{entry}</span>
                      {isSuperAdmin && (
                        <>
                          <button
                            onClick={() => startEdit(idx)}
                            className="text-xs text-gray-400 hover:text-brand-orange opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeEntry(idx)}
                            className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-3">{entries.length} entries total</p>
        </div>
      )}
    </div>
  );
}
