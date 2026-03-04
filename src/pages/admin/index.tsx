import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { getCurrentUser, fetchUserAttributes, signOut } from "aws-amplify/auth";
import type { Gym } from "@/types";
import OwnerGymForm from "@/components/OwnerGymForm";

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
  createdAt?: string;
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
        {tab === "gyms" && <GymsTab />}
        {tab === "users" && <UsersTab />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Claims tab
// ---------------------------------------------------------------------------
function ClaimsTab() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/claims");
    setClaims(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function action(id: string, act: "approve" | "reject") {
    setBusy(id + act);
    const r = await fetch(`/api/admin/claims?action=${act}&id=${id}`, {
      method: "PATCH",
    });
    if (r.ok) {
      showToast(act === "approve" ? "Claim approved — Cognito user created." : "Claim rejected.");
      await load();
    } else {
      const body = await r.json().catch(() => ({}));
      showToast(`Error: ${body.error ?? r.statusText}`);
    }
    setBusy(null);
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}
      <h2 className="text-base font-semibold text-gray-900 mb-4">Listing Claims</h2>
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : claims.length === 0 ? (
        <p className="text-gray-500 text-sm">No claims yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {["Gym", "Claimant", "Email", "Phone", "Message", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {claims.map((c) => (
                <tr key={c.id} className={c.status !== "pending" ? "opacity-50" : ""}>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {c.gymName || c.gymId}
                    <div className="text-xs text-gray-400">{c.gymAddress}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.claimantName}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.claimantEmail}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.claimantPhone}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-gray-600">{c.message}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge status={c.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => action(c.id, "approve")}
                          disabled={busy !== null}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded font-medium disabled:opacity-50"
                        >
                          {busy === c.id + "approve" ? "…" : "Approve"}
                        </button>
                        <button
                          onClick={() => action(c.id, "reject")}
                          disabled={busy !== null}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded font-medium disabled:opacity-50"
                        >
                          {busy === c.id + "reject" ? "…" : "Reject"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gyms tab
// ---------------------------------------------------------------------------
function GymsTab() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<{ gym: Gym; isNew: boolean } | null>(null);
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const search = useCallback(async (query: string) => {
    setLoading(true);
    const r = await fetch(`/api/admin/gyms?q=${encodeURIComponent(query)}`);
    setGyms(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { search(""); }, [search]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    search(q);
  }

  async function handleSave(updated: Gym) {
    if (panel?.isNew) {
      const r = await fetch("/api/admin/gyms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
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
        body: JSON.stringify(updated),
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
            placeholder="Search by name, ID, owner, or suburb…"
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

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {["ID", "Name", "Owner", "Suburb", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {gyms.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{g.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                  <td className="px-4 py-3 text-gray-600">{g.ownerId}</td>
                  <td className="px-4 py-3 text-gray-600">{g.address.suburb}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
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
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
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
                    Owner ID
                  </label>
                  <input
                    value={panel.gym.ownerId}
                    onChange={(e) =>
                      setPanel((p) =>
                        p ? { ...p, gym: { ...p.gym, ownerId: e.target.value } } : p
                      )
                    }
                    placeholder="owner-1"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
              )}
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
