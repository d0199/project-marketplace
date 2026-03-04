import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { getCurrentUser, fetchUserAttributes, signOut } from "aws-amplify/auth";
import type { Gym } from "@/types";
import OwnerGymForm from "@/components/OwnerGymForm";
import { ALL_AMENITIES, AMENITY_ICONS } from "@/lib/utils";

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
}

interface CognitoUser {
  username: string;
  email: string;
  status: string;
  ownerId: string;
  isAdmin: string;
  enabled: boolean;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Empty gym template for "New Gym"
// ---------------------------------------------------------------------------
const EMPTY_GYM: Gym = {
  id: "",
  ownerId: "",
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
  const [tab, setTab] = useState<"claims" | "gyms" | "users">("claims");

  // Auth check
  useEffect(() => {
    (async () => {
      try {
        await getCurrentUser();
        const attrs = await fetchUserAttributes();
        if (attrs["custom:isAdmin"] !== "true") {
          setAccessDenied(true);
        } else {
          if (router.query.gym) setTab("gyms");
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-black text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-brand-orange">mynextgym</span> Admin
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
          {(["claims", "gyms", "users"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-4 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-brand-orange text-brand-orange"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6 max-w-7xl mx-auto">
        {tab === "claims" && <ClaimsTab />}
        {tab === "gyms" && <GymsTab initialGymId={initialGymId} />}
        {tab === "users" && <UsersTab />}
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

function ClaimsTab() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean }>({ msg: "", ok: true });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState<{ ownerId: string; isNewUser: boolean } | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/claims");
    setClaims(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast({ msg: "", ok: true }), 5000);
  }

  async function action(id: string, act: "approve" | "reject") {
    setBusy(id + act);
    const r = await fetch(`/api/admin/claims?action=${act}&id=${id}`, {
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

      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-base font-semibold text-gray-900">Listing Claims</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by name, email, or gym…"
          className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        />
      </div>
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : claims.length === 0 ? (
        <p className="text-gray-500 text-sm">No claims yet.</p>
      ) : (
        <div className="space-y-4">
          {claims.filter((c) => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
              c.claimantName.toLowerCase().includes(q) ||
              c.claimantEmail.toLowerCase().includes(q) ||
              (c.gymName ?? "").toLowerCase().includes(q) ||
              (c.gymAddress ?? "").toLowerCase().includes(q)
            );
          }).map((c) => (
            <div
              key={c.id}
              className={`bg-white rounded-lg border p-4 ${c.status !== "pending" ? "opacity-60" : ""}`}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{c.gymName || c.gymId}</p>
                  <p className="text-xs text-gray-400">{c.gymAddress}</p>
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

              {/* Message */}
              {c.message && (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-0.5">Message</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{c.message}</p>
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
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gyms tab
// ---------------------------------------------------------------------------
function GymsTab({ initialGymId }: { initialGymId?: string }) {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<{ gym: Gym; isNew: boolean } | null>(null);
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState<{
    price: string;
    priceVerified: "" | "true" | "false";
    ownerId: string;
    isTest: "" | "true" | "false";
    isFeatured: "" | "true" | "false";
    addAmenities: Set<string>;
    removeAmenities: Set<string>;
  }>({ price: "", priceVerified: "", ownerId: "", isTest: "", isFeatured: "", addAmenities: new Set(), removeAmenities: new Set() });
  const [bulkBusy, setBulkBusy] = useState(false);

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
    setSelected(selected.size === gyms.length ? new Set() : new Set(gyms.map((g) => g.id)));
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

  function resetBulk() {
    setBulk({ price: "", priceVerified: "", ownerId: "", isTest: "", isFeatured: "", addAmenities: new Set(), removeAmenities: new Set() });
  }

  async function applyBulk() {
    setBulkBusy(true);
    const targets = gyms.filter((g) => selected.has(g.id));
    await Promise.all(
      targets.map((g) => {
        const updated = { ...g };
        const price = parseInt(bulk.price);
        if (bulk.price !== "" && price > 0) updated.pricePerWeek = price;
        if (bulk.priceVerified !== "") updated.priceVerified = bulk.priceVerified === "true";
        if (bulk.ownerId !== "") updated.ownerId = bulk.ownerId;
        if (bulk.isTest !== "") updated.isTest = bulk.isTest === "true";
        if (bulk.isFeatured !== "") updated.isFeatured = bulk.isFeatured === "true";
        if (bulk.addAmenities.size > 0 || bulk.removeAmenities.size > 0) {
          const amenitySet = new Set(g.amenities);
          bulk.addAmenities.forEach((a) => amenitySet.add(a));
          bulk.removeAmenities.forEach((a) => amenitySet.delete(a));
          updated.amenities = Array.from(amenitySet);
        }
        return fetch(`/api/admin/gym/${g.id}`, {
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

  const search = useCallback(async (query: string) => {
    setLoading(true);
    const r = await fetch(`/api/admin/gyms?q=${encodeURIComponent(query)}`);
    setGyms(await r.json());
    setSelected(new Set());
    setLoading(false);
  }, []);

  useEffect(() => { search(""); }, [search]);

  useEffect(() => {
    if (!initialGymId) return;
    fetch(`/api/admin/gym/${initialGymId}`)
      .then((r) => r.json())
      .then((gym: Gym) => { if (gym?.id) setPanel({ gym, isNew: false }); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    search(q);
  }

  async function handleSave(updated: Gym) {
    if (panel?.isNew) {
      // OwnerGymForm initialises its internal state from props once, so the
      // ownerId typed in the separate input above doesn't reach the form's
      // onSave payload — override it from panel state here.
      const body = { ...updated, ownerId: panel.gym.ownerId, isTest: panel.gym.isTest ?? false, isFeatured: panel.gym.isFeatured ?? false };
      const r = await fetch("/api/admin/gyms", {
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
      const r = await fetch(`/api/admin/gym/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updated, isTest: panel?.gym.isTest ?? false, isFeatured: panel?.gym.isFeatured ?? false }),
      });
      if (r.ok) {
        showToast("Gym updated.");
        setPanel(null);
        search(q);
      } else {
        showToast("Error updating gym.");
      }
    }
  }

  async function handleDelete(id: string) {
    const r = await fetch(`/api/admin/gym/${id}`, { method: "DELETE" });
    if (r.ok) {
      showToast("Gym deleted.");
      setConfirmDelete(null);
      search(q);
    } else {
      showToast("Error deleting gym.");
    }
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
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
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg"
          >
            Search
          </button>
        </form>
        <button
          onClick={() => setPanel({ gym: EMPTY_GYM, isNew: true })}
          className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg whitespace-nowrap"
        >
          + New Gym
        </button>
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
          <button onClick={() => setSelected(new Set())} className="text-sm text-blue-600 hover:underline">
            Clear
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
                    min={1}
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
              </div>

              {/* Amenities */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Amenities</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {ALL_AMENITIES.map((a) => {
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

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={gyms.length > 0 && selected.size === gyms.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-brand-orange"
                  />
                </th>
                {["ID", "Name", "Owner", "Suburb", "Test", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gyms.map((g) => (
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
                      href={`/gym/${g.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:underline text-xs font-medium mr-3"
                    >
                      View
                    </a>
                    <button
                      onClick={() => setPanel({ gym: g, isNew: false })}
                      className="text-brand-orange hover:underline text-xs font-medium mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(g.id)}
                      className="text-red-500 hover:underline text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {gyms.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No gyms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-in edit panel */}
      {panel && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setPanel(null)}
          />
          <div className="w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-semibold">
                {panel.isNew ? "New Gym" : `Edit: ${panel.gym.name}`}
              </h2>
              <button
                onClick={() => setPanel(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              {panel.isNew && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owner ID <span className="text-gray-400 font-normal">(leave blank to create as unclaimed listing)</span>
                  </label>
                  <input
                    value={panel.gym.ownerId}
                    onChange={(e) =>
                      setPanel((p) =>
                        p ? { ...p, gym: { ...p.gym, ownerId: e.target.value } } : p
                      )
                    }
                    placeholder="Leave blank for unclaimed listing"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
              )}
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={panel.gym.isTest ?? false}
                    onChange={(e) =>
                      setPanel((p) =>
                        p ? { ...p, gym: { ...p.gym, isTest: e.target.checked } } : p
                      )
                    }
                    className="w-4 h-4 accent-brand-orange"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Test listing <span className="text-gray-400 font-normal">(hidden from public — visible only to @mynextgym.com.au users)</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={panel.gym.isFeatured ?? false}
                    onChange={(e) =>
                      setPanel((p) =>
                        p ? { ...p, gym: { ...p.gym, isFeatured: e.target.checked } } : p
                      )
                    }
                    className="w-4 h-4 accent-brand-orange"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Featured listing <span className="text-gray-400 font-normal">(pinned to top of results — max 3, rotates evenly)</span>
                  </span>
                </label>
              </div>
              <OwnerGymForm gym={panel.gym} onSave={handleSave} />
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
function UsersTab() {
  const [users, setUsers] = useState<CognitoUser[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ email: "", password: "", ownerId: "", isAdmin: false });
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [toast, setToast] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const search = useCallback(async (query: string) => {
    setLoading(true);
    const r = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
    setUsers(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { search(""); }, [search]);

  async function createUser() {
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    if (r.ok) {
      showToast("User created.");
      setShowNew(false);
      setNewForm({ email: "", password: "", ownerId: "", isAdmin: false });
      search(q);
    } else {
      const body = await r.json().catch(() => ({}));
      showToast(`Error: ${body.error ?? r.statusText}`);
    }
  }

  async function resetPassword(username: string) {
    const r = await fetch(`/api/admin/users/${encodeURIComponent(username)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: resetPw }),
    });
    if (r.ok) {
      showToast("Password reset.");
      setResetFor(null);
      setResetPw("");
    } else {
      showToast("Error resetting password.");
    }
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-4 mb-4">
        <form
          onSubmit={(e) => { e.preventDefault(); search(q); }}
          className="flex gap-2 flex-1"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email…"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg"
          >
            Search
          </button>
        </form>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg whitespace-nowrap"
        >
          + New User
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {["Email", "Status", "Owner ID", "Admin", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
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
                  <td className="px-4 py-3">
                    {resetFor === u.username ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="password"
                          value={resetPw}
                          onChange={(e) => setResetPw(e.target.value)}
                          placeholder="New password"
                          className="px-2 py-1 border rounded text-xs w-36 focus:outline-none focus:ring-1 focus:ring-brand-orange"
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
                    ) : (
                      <button
                        onClick={() => setResetFor(u.username)}
                        className="text-brand-orange hover:underline text-xs font-medium"
                      >
                        Reset Password
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
