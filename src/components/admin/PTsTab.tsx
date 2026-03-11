import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { PersonalTrainer, Address } from "@/types";
import { adminFetch } from "@/lib/adminFetch";
import { POSTCODE_COORDS } from "@/lib/utils";
import { ptUrl } from "@/lib/slugify";
import CustomLeadFieldsEditor from "@/components/CustomLeadFieldsEditor";

interface Props {
  adminEmail?: string;
  initialPtId?: string;
}

const EMPTY_PT: PersonalTrainer = {
  id: "",
  slug: "",
  suburbSlug: "",
  ownerId: "unclaimed",
  isActive: true,
  name: "",
  description: "",
  address: { street: "", suburb: "", state: "WA", postcode: "" },
  phone: "",
  email: "",
  website: "",
  lat: -31.9505,
  lng: 115.8605,
  images: [],
  gymIds: [],
  specialties: [],
  qualifications: [],
};

export default function PTsTab({ adminEmail, initialPtId }: Props) {
  const [pts, setPts] = useState<PersonalTrainer[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [panel, setPanel] = useState<{ pt: PersonalTrainer; isNew: boolean } | null>(null);
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("active");
  const [ownerFilter, setOwnerFilter] = useState<"all" | "owned" | "unclaimed">("owned");
  const [stateFilter, setStateFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "paid" | "featured">("all");
  const [editOwnerFor, setEditOwnerFor] = useState<string | null>(null);
  const [editOwnerVal, setEditOwnerVal] = useState("");
  const [confirmUnclaim, setConfirmUnclaim] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!initialPtId) return;
    adminFetch(`/api/admin/pt/${initialPtId}`)
      .then((r) => r.json())
      .then((pt: PersonalTrainer) => { if (pt?.id) setPanel({ pt, isNew: false }); })
      .catch(() => {});
  }, [initialPtId]);

  async function load() {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/pts");
      const data = await r.json();
      if (Array.isArray(data)) setPts(data);
    } catch { /* */ }
    setHasSearched(true);
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const filtered = pts.filter((pt) => {
    if (activeFilter === "active" && pt.isActive === false) return false;
    if (activeFilter === "inactive" && pt.isActive !== false) return false;
    const isUnclaimed = !pt.ownerId || pt.ownerId === "unclaimed" || pt.ownerId === "owner-3";
    if (ownerFilter === "owned" && isUnclaimed) return false;
    if (ownerFilter === "unclaimed" && !isUnclaimed) return false;
    if (stateFilter !== "all" && pt.address.state !== stateFilter) return false;
    if (planFilter === "featured" && !pt.isFeatured) return false;
    if (planFilter === "paid" && (!pt.isPaid || pt.isFeatured)) return false;
    if (planFilter === "free" && (pt.isPaid || pt.isFeatured)) return false;
    if (q) {
      const search = q.toLowerCase();
      if (
        !pt.name.toLowerCase().includes(search) &&
        !pt.email.toLowerCase().includes(search) &&
        !pt.address.suburb.toLowerCase().includes(search) &&
        !pt.id.toLowerCase().includes(search) &&
        !(pt.ownerId ?? "").toLowerCase().includes(search) &&
        !pt.address.postcode.toLowerCase().includes(search)
      ) return false;
    }
    return true;
  });

  async function handleSave() {
    if (!panel) return;
    const { pt, isNew } = panel;
    try {
      if (isNew) {
        const r = await adminFetch("/api/admin/pts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...pt, createdBy: adminEmail }),
        });
        if (!r.ok) throw new Error("Create failed");
      } else {
        const r = await adminFetch(`/api/admin/pt/${pt.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pt),
        });
        if (!r.ok) throw new Error("Update failed");
      }
      setPanel(null);
      showToast(isNew ? "PT created" : "PT updated");
      load();
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : "Save failed"}`);
    }
  }

  async function handleDelete(id: string) {
    try {
      await adminFetch(`/api/admin/pt/${id}`, { method: "DELETE" });
      setConfirmDelete(null);
      setPanel(null);
      showToast("PT deleted");
      load();
    } catch {
      showToast("Delete failed");
    }
  }

  async function toggleActive(pt: PersonalTrainer) {
    const updated = { ...pt, isActive: !pt.isActive };
    await adminFetch(`/api/admin/pt/${pt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    load();
  }

  async function saveOwnerId(ptId: string) {
    const val = editOwnerVal.trim();
    if (!val) return;
    const pt = pts.find((p) => p.id === ptId);
    if (!pt) return;
    try {
      await adminFetch(`/api/admin/pt/${ptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pt, ownerId: val }),
      });
      showToast("Owner ID updated");
      setEditOwnerFor(null);
      setEditOwnerVal("");
      load();
    } catch {
      showToast("Error updating Owner ID");
    }
  }

  async function handleUnclaim(id: string) {
    const pt = pts.find((p) => p.id === id);
    if (!pt) return;
    try {
      const r = await adminFetch(`/api/admin/pt/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pt, ownerId: "unclaimed" }),
      });
      if (r.ok) {
        showToast("PT reverted to unclaimed.");
        setConfirmUnclaim(null);
        load();
      } else {
        showToast("Error unclaiming PT.");
      }
    } catch {
      showToast("Error unclaiming PT.");
    }
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${toast.includes("Error") || toast.includes("failed") ? "bg-red-600" : "bg-green-600"}`}>
          {toast}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Personal Trainer</h3>
            <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete this PT? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Unclaim confirmation */}
      {confirmUnclaim && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Revert PT to unclaimed?</h3>
            <p className="text-sm text-gray-600 mb-3">
              PT <span className="font-mono font-medium">{confirmUnclaim}</span> will be set to <span className="font-medium">unclaimed</span>.
            </p>
            <p className="text-sm text-gray-400 mb-5">The owner&apos;s Cognito account is not affected — only this PT is released.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmUnclaim(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={() => handleUnclaim(confirmUnclaim)} className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700">Unclaim</button>
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="flex items-center gap-4 mb-4">
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2 flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, ID, owner, suburb, or postcode…"
            className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
          <button type="submit" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-sm font-medium rounded-lg">
            Search
          </button>
        </form>
        <button
          onClick={() => setPanel({ pt: { ...EMPTY_PT }, isNew: true })}
          className="px-4 py-2 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-lg whitespace-nowrap"
        >
          + New PT
        </button>
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
        <button
          onClick={() => { setActiveFilter("all"); setOwnerFilter("all"); setStateFilter("all"); setPlanFilter("all"); }}
          className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
        >
          Clear
        </button>
        <button
          onClick={() => { setActiveFilter("active"); setOwnerFilter("owned"); setStateFilter("all"); setPlanFilter("all"); }}
          className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
        >
          Reset
        </button>
        <span className="text-sm text-gray-400">{filtered.length} PT{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">{hasSearched ? "No personal trainers found." : "Click Search to load PTs."}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Suburb</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Gyms</th>
                <th className="px-4 py-3 font-medium">Specialties</th>
                <th className="px-4 py-3 font-medium">Flags</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pt) => (
                <tr key={pt.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{pt.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{pt.name || <span className="text-gray-400 italic">Unnamed</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{pt.address.suburb}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {editOwnerFor === pt.id ? (
                      <span className="flex items-center gap-1">
                        <input
                          value={editOwnerVal}
                          onChange={(e) => setEditOwnerVal(e.target.value)}
                          className="w-28 px-1.5 py-0.5 border rounded text-xs"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") saveOwnerId(pt.id); if (e.key === "Escape") setEditOwnerFor(null); }}
                        />
                        <button onClick={() => saveOwnerId(pt.id)} className="text-green-600 hover:text-green-800 text-xs">Save</button>
                        <button onClick={() => setEditOwnerFor(null)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <span className={pt.ownerId === "unclaimed" ? "text-gray-400 italic" : ""}>{pt.ownerId === "unclaimed" ? "Unclaimed" : pt.ownerId}</span>
                        <button
                          onClick={() => { setEditOwnerFor(pt.id); setEditOwnerVal(pt.ownerId === "unclaimed" ? "" : pt.ownerId); }}
                          className="text-brand-orange hover:text-brand-orange-dark ml-1"
                          title="Set Owner ID"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{pt.gymIds.length}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{pt.specialties.slice(0, 3).join(", ")}{pt.specialties.length > 3 ? "..." : ""}</td>
                  <td className="px-4 py-3">
                    <span className="flex gap-1">
                      {pt.isFeatured && <span className="text-yellow-500" title="Featured">★</span>}
                      {pt.isPaid && <span className="text-green-500" title="Paid">$</span>}
                      {pt.isTest && <span className="text-purple-500" title="Test">T</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(pt)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${pt.isActive !== false ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                    >
                      {pt.isActive !== false ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <a href={ptUrl(pt)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm font-medium">View</a>
                    <button onClick={() => setPanel({ pt: { ...pt }, isNew: false })} className="text-brand-orange hover:underline text-sm font-medium ml-3">Edit</button>
                    {pt.ownerId !== "unclaimed" && (
                      <button onClick={() => setConfirmUnclaim(pt.id)} className="text-yellow-600 hover:underline text-sm font-medium ml-3">Unclaim</button>
                    )}
                    <button onClick={() => setConfirmDelete(pt.id)} className="text-red-500 hover:underline text-sm font-medium ml-3">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Panel */}
      {panel && (
        <PTEditPanel
          panel={panel}
          setPanel={setPanel}
          onSave={handleSave}
          onDelete={(id) => setConfirmDelete(id)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Panel
// ---------------------------------------------------------------------------
function normalize(s: string) { return s.toLowerCase().replace(/[^a-z0-9 ]/g, ""); }

function PTEditPanel({
  panel,
  setPanel,
  onSave,
  onDelete,
}: {
  panel: { pt: PersonalTrainer; isNew: boolean };
  setPanel: (p: { pt: PersonalTrainer; isNew: boolean } | null) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  const { pt, isNew } = panel;
  const [newImageUrl, setNewImageUrl] = useState("");
  const dragIndex = useRef<number | null>(null);
  const [newGymId, setNewGymId] = useState("");
  const [newQualification, setNewQualification] = useState("");
  const [specialtySearch, setSpecialtySearch] = useState("");
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [memberOfferSearch, setMemberOfferSearch] = useState("");
  const [availableMemberOffers, setAvailableMemberOffers] = useState<string[]>([]);

  // AI description generation (admin — unlimited)
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  async function generateDescription() {
    setAiLoading(true);
    setAiError("");
    setAiSuggestion("");
    try {
      const context = {
        name: pt.name,
        suburb: pt.address.suburb,
        postcode: pt.address.postcode,
        state: pt.address.state,
        specialties: pt.specialties,
        qualifications: pt.qualifications,
        experienceYears: pt.experienceYears,
        languages: pt.languages,
        memberOffers: pt.memberOffers,
        pricePerSession: pt.pricePerSession,
        sessionDuration: pt.sessionDuration,
        availability: pt.availability,
        website: pt.website,
        description: pt.description,
        gender: pt.gender,
      };
      const r = await adminFetch("/api/owner/description-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pt", context }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "AI request failed");
      setAiSuggestion(data.result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI request failed");
    }
    setAiLoading(false);
  }

  useEffect(() => {
    fetch("/api/datasets/pt-specialties")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.entries) setAvailableSpecialties(data.entries); })
      .catch(() => {});
    fetch("/api/datasets/pt-member-offers")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.entries) setAvailableMemberOffers(data.entries); })
      .catch(() => {});
  }, []);

  function update(patch: Partial<PersonalTrainer>) {
    setPanel({ pt: { ...pt, ...patch }, isNew });
  }

  function updateAddress(patch: Partial<Address>) {
    const addr = { ...pt.address, ...patch };
    if (patch.postcode && POSTCODE_COORDS[patch.postcode]) {
      const [lat, lng] = POSTCODE_COORDS[patch.postcode];
      update({ address: addr, lat, lng });
    } else {
      update({ address: addr });
    }
  }

  function onDragStart(idx: number) {
    dragIndex.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === idx) return;
    const imgs = [...pt.images];
    imgs.splice(idx, 0, imgs.splice(from, 1)[0]);
    const fps = [...(pt.imageFocalPoints ?? pt.images.map(() => 50))];
    fps.splice(idx, 0, fps.splice(from, 1)[0]);
    update({ images: imgs, imageFocalPoints: fps });
    dragIndex.current = idx;
  }

  function addImage() {
    const url = newImageUrl.trim();
    if (!url || pt.images.length >= 6) return;
    update({
      images: [...pt.images, url],
      imageFocalPoints: [...(pt.imageFocalPoints ?? pt.images.map(() => 50)), 50],
    });
    setNewImageUrl("");
  }

  function removeImage(i: number) {
    update({
      images: pt.images.filter((_, idx) => idx !== i),
      imageFocalPoints: (pt.imageFocalPoints ?? pt.images.map(() => 50)).filter((_, idx) => idx !== i),
    });
  }

  function addGymId() {
    const id = newGymId.trim();
    if (!id || pt.gymIds.includes(id)) return;
    update({ gymIds: [...pt.gymIds, id] });
    setNewGymId("");
  }

  function removeGymId(id: string) {
    update({ gymIds: pt.gymIds.filter((g) => g !== id) });
  }

  function addSpecialty(s: string) {
    if (!pt.specialties.includes(s)) update({ specialties: [...pt.specialties, s] });
    setSpecialtySearch("");
  }

  function removeSpecialty(s: string) {
    update({ specialties: pt.specialties.filter((x) => x !== s) });
  }

  function addMemberOffer(s: string) {
    if (!(pt.memberOffers ?? []).includes(s)) update({ memberOffers: [...(pt.memberOffers ?? []), s] });
    setMemberOfferSearch("");
  }

  function removeMemberOffer(s: string) {
    update({ memberOffers: (pt.memberOffers ?? []).filter((x) => x !== s) });
  }

  function addQualification() {
    const val = newQualification.trim();
    if (!val || pt.qualifications.includes(val)) return;
    update({ qualifications: [...pt.qualifications, val] });
    setNewQualification("");
  }

  function removeQualification(q: string) {
    update({ qualifications: pt.qualifications.filter((x) => x !== q) });
  }

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex justify-end" onClick={() => setPanel(null)}>
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">
            {isNew ? "New Personal Trainer" : `Edit: ${pt.name || "Unnamed"}`}
          </h2>
          <div className="flex gap-2">
            {!isNew && (
              <button onClick={() => onDelete(pt.id)} className="px-3 py-1.5 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50">Delete</button>
            )}
            <button onClick={() => setPanel(null)} className="px-3 py-1.5 text-gray-500 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={onSave} className="px-4 py-1.5 bg-brand-orange text-white rounded-lg text-sm font-medium">Save</button>
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
                <input type="checkbox" checked={pt.isActive !== false} onChange={(e) => update({ isActive: e.target.checked })} className="w-4 h-4 accent-brand-orange" />
                <span className="text-sm">Active</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pt.isTest ?? false} onChange={(e) => update({ isTest: e.target.checked })} className="w-4 h-4 accent-brand-orange" />
                <span className="text-sm">Test</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pt.isPaid ?? false} onChange={(e) => update({ isPaid: e.target.checked })} className="w-4 h-4 accent-brand-orange" />
                <span className="text-sm">Paid</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pt.isFeatured ?? false} onChange={(e) => update({ isFeatured: e.target.checked })} className="w-4 h-4 accent-brand-orange" />
                <span className="text-sm">Featured</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className={labelCls}>Owner ID</label>
                <input className={inputCls} value={pt.ownerId} onChange={(e) => update({ ownerId: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Stripe Plan</label>
                <select className={inputCls} value={pt.stripePlan ?? ""} onChange={(e) => update({ stripePlan: (e.target.value || undefined) as PersonalTrainer["stripePlan"] })}>
                  <option value="">None</option>
                  <option value="paid">Paid</option>
                  <option value="featured">Featured</option>
                </select>
              </div>
            </div>
          </section>

          {/* Affiliated Gyms (admin-only) */}
          <section className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Affiliated Gyms</h3>
            {pt.gymIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pt.gymIds.map((gid) => (
                  <span key={gid} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-3 py-1 text-sm">
                    {gid}
                    <button onClick={() => removeGymId(gid)} className="text-gray-400 hover:text-red-500 ml-1">&times;</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input className={inputCls} value={newGymId} onChange={(e) => setNewGymId(e.target.value)} placeholder="Gym ID (e.g. gym-001)" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGymId(); } }} />
              <button onClick={addGymId} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-100 shrink-0">Add</button>
            </div>
          </section>

          {/* Qualification Verification (admin-only) */}
          <section className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Qualification Verification</h3>
              <span className={`text-xs font-semibold ${pt.qualificationsVerified ? "text-green-700" : "text-gray-400"}`}>
                {pt.qualificationsVerified ? "All Verified" : `${(pt.qualificationsVerifiedList ?? []).length}/${pt.qualifications?.length ?? 0} Verified`}
              </span>
            </div>
            {(pt.qualifications?.length ?? 0) > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3 space-y-1.5">
                {pt.qualifications.map((q: string) => {
                  const isVerified = (pt.qualificationsVerifiedList ?? []).includes(q);
                  return (
                    <label key={q} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                      <input
                        type="checkbox"
                        checked={isVerified}
                        onChange={() => {
                          const current = new Set(pt.qualificationsVerifiedList ?? []);
                          if (isVerified) current.delete(q); else current.add(q);
                          const newList = [...current];
                          update({
                            qualificationsVerifiedList: newList,
                            qualificationsVerified: newList.length >= (pt.qualifications?.length ?? 0),
                          });
                        }}
                        className="w-4 h-4 accent-green-600"
                      />
                      <span className={isVerified ? "text-green-700" : "text-gray-700"}>{q}</span>
                      {isVerified && <span className="text-xs text-green-600 font-medium ml-auto">Verified</span>}
                    </label>
                  );
                })}
              </div>
            )}
            <div>
              <label className={labelCls}>Verification notes</label>
              <input
                className={inputCls}
                value={pt.qualificationsNotes ?? ""}
                onChange={(e) => update({ qualificationsNotes: e.target.value })}
                placeholder="e.g. Verified via AIF portal 2026-03-10"
              />
            </div>
            {pt.qualificationEvidence && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-semibold text-amber-800 mb-1">Evidence submitted by PT:</p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">{pt.qualificationEvidence}</p>
              </div>
            )}
          </section>

          <hr className="border-gray-300" />

          {/* ============================================================= */}
          {/* LISTING FIELDS (mirrors OwnerPTForm)                           */}
          {/* ============================================================= */}

          {/* Basic Info */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Basic Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Name *</label>
                <input className={inputCls} value={pt.name} onChange={(e) => update({ name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <button
                    type="button"
                    onClick={generateDescription}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors disabled:opacity-50"
                  >
                    {aiLoading ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Generating…
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                        </svg>
                        Write with AI
                      </>
                    )}
                  </button>
                </div>
                <textarea className={inputCls} rows={3} value={pt.description} onChange={(e) => update({ description: e.target.value })} />
                {aiError && (
                  <p className="mt-2 text-sm text-red-600">{aiError}</p>
                )}
                {aiSuggestion && (
                  <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-xs font-medium text-purple-700 mb-2">AI Suggestion</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiSuggestion}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => { update({ description: aiSuggestion }); setAiSuggestion(""); }}
                        className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiSuggestion("")}
                        className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-white border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>Gender</label>
                <select className={inputCls} value={pt.gender ?? ""} onChange={(e) => update({ gender: e.target.value || undefined })}>
                  <option value="">Not specified</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Experience (years)</label>
                <input type="number" className={inputCls} value={pt.experienceYears ?? ""} onChange={(e) => update({ experienceYears: e.target.value ? parseInt(e.target.value) : undefined })} />
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Contact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" className={inputCls} value={pt.email} onChange={(e) => update({ email: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input className={inputCls} value={pt.phone} onChange={(e) => update({ phone: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Website</label>
                <input className={inputCls} value={pt.website} onChange={(e) => update({ website: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Booking URL</label>
                <input className={inputCls} value={pt.bookingUrl ?? ""} onChange={(e) => update({ bookingUrl: e.target.value || undefined })} />
              </div>
              <div>
                <label className={labelCls}>Instagram</label>
                <input className={inputCls} value={pt.instagram ?? ""} onChange={(e) => update({ instagram: e.target.value || undefined })} placeholder="https://instagram.com/..." />
              </div>
              <div>
                <label className={labelCls}>Facebook</label>
                <input className={inputCls} value={pt.facebook ?? ""} onChange={(e) => update({ facebook: e.target.value || undefined })} placeholder="https://facebook.com/..." />
              </div>
              <div>
                <label className={labelCls}>TikTok</label>
                <input className={inputCls} value={pt.tiktok ?? ""} onChange={(e) => update({ tiktok: e.target.value || undefined })} placeholder="https://tiktok.com/@..." />
              </div>
            </div>
          </section>

          {/* Address */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Street</label>
                <input className={inputCls} value={pt.address.street} onChange={(e) => updateAddress({ street: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Suburb</label>
                <input className={inputCls} value={pt.address.suburb} onChange={(e) => updateAddress({ suburb: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Postcode</label>
                <input className={inputCls} value={pt.address.postcode} onChange={(e) => updateAddress({ postcode: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>State</label>
                <input className={inputCls} value={pt.address.state} onChange={(e) => updateAddress({ state: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Lat</label>
                  <input type="number" step="any" className={inputCls} value={pt.lat} onChange={(e) => update({ lat: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className={labelCls}>Lng</label>
                  <input type="number" step="any" className={inputCls} value={pt.lng} onChange={(e) => update({ lng: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Pricing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Price per Session ($)</label>
                <input type="number" step="0.01" className={inputCls} value={pt.pricePerSession ?? ""} onChange={(e) => update({ pricePerSession: e.target.value ? parseFloat(e.target.value) : undefined })} />
              </div>
              <div>
                <label className={labelCls}>Session Duration (mins)</label>
                <input type="number" className={inputCls} value={pt.sessionDuration ?? ""} onChange={(e) => update({ sessionDuration: e.target.value ? parseInt(e.target.value) : undefined })} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Pricing Notes</label>
                <input className={inputCls} value={pt.pricingNotes ?? ""} onChange={(e) => update({ pricingNotes: e.target.value || undefined })} placeholder="e.g. Discounts for 10-pack sessions" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Availability</label>
                <input className={inputCls} value={pt.availability ?? ""} onChange={(e) => update({ availability: e.target.value || undefined })} placeholder="e.g. Mon-Fri 6am-8pm, Sat 7am-12pm" />
              </div>
            </div>
          </section>

          {/* Specialties — search dropdown with pills (mirrors OwnerPTForm) */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Specialties</h3>
            {pt.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {pt.specialties.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">
                    {s}
                    <button type="button" onClick={() => removeSpecialty(s)} className="ml-0.5 text-indigo-400 hover:text-indigo-700">&times;</button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={specialtySearch}
                onChange={(e) => setSpecialtySearch(e.target.value)}
                placeholder="Search specialties..."
                className={inputCls}
              />
              {specialtySearch.trim().length >= 1 && (() => {
                const q = normalize(specialtySearch);
                const matches = availableSpecialties
                  .filter((s) => !pt.specialties.includes(s))
                  .filter((s) => normalize(s).includes(q))
                  .slice(0, 10);
                if (matches.length === 0) return (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 p-3 text-sm text-gray-400">
                    No matching specialties.
                  </div>
                );
                return (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 max-h-48 overflow-y-auto">
                    {matches.map((s) => (
                      <button key={s} type="button" onClick={() => addSpecialty(s)} className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Member Offers — search dropdown with pills (mirrors OwnerPTForm) */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Member Offers</h3>
            {(pt.memberOffers ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {(pt.memberOffers ?? []).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-50 text-brand-orange text-sm font-medium border border-orange-200">
                    {s}
                    <button type="button" onClick={() => removeMemberOffer(s)} className="ml-0.5 text-orange-400 hover:text-orange-700">&times;</button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={memberOfferSearch}
                onChange={(e) => setMemberOfferSearch(e.target.value)}
                placeholder="Search member offers..."
                className={inputCls}
              />
              {memberOfferSearch.trim().length >= 1 && (() => {
                const q = normalize(memberOfferSearch);
                const matches = availableMemberOffers
                  .filter((s) => !(pt.memberOffers ?? []).includes(s))
                  .filter((s) => normalize(s).includes(q))
                  .slice(0, 10);
                if (matches.length === 0) return (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 p-3 text-sm text-gray-400">
                    No matching offers.
                  </div>
                );
                return (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 max-h-48 overflow-y-auto">
                    {matches.map((s) => (
                      <button key={s} type="button" onClick={() => addMemberOffer(s)} className="w-full text-left px-4 py-2 text-sm hover:bg-orange-50 hover:text-brand-orange transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="mt-4">
              <label className={labelCls}>Benefits / Affiliations</label>
              <p className="text-xs text-gray-400 mb-1">Separate each benefit with a comma — shown as bullet points on your profile.</p>
              <textarea
                className={inputCls}
                rows={2}
                value={pt.memberOffersNotes ?? ""}
                onChange={(e) => update({ memberOffersNotes: e.target.value || undefined })}
                placeholder="e.g. Free body composition scan, 10% off supplements"
              />
            </div>
            <div className="mt-4">
              <label className={labelCls}>Terms &amp; Conditions</label>
              <textarea
                className={inputCls}
                rows={2}
                value={pt.memberOffersTnC ?? ""}
                onChange={(e) => update({ memberOffersTnC: e.target.value || undefined })}
                placeholder="e.g. Offers valid for new clients only. Discount packs expire after 6 months."
              />
            </div>
          </section>

          {/* Qualifications */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Qualifications</h3>
            {pt.qualifications.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {pt.qualifications.map((qual) => (
                  <span key={qual} className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 rounded-full px-3 py-1 text-sm">
                    {qual}
                    <button onClick={() => removeQualification(qual)} className="text-blue-400 hover:text-red-500 ml-1">&times;</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input className={inputCls} value={newQualification} onChange={(e) => setNewQualification(e.target.value)} placeholder="e.g. Cert III Fitness, Cert IV PT" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQualification(); } }} />
              <button onClick={addQualification} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 shrink-0">Add</button>
            </div>
          </section>

          {/* Languages */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Languages</h3>
            <LanguageEditor languages={pt.languages ?? []} onChange={(languages) => update({ languages })} />
          </section>

          {/* Images */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Images</h3>
            <p className="text-xs text-gray-500 mb-3">
              First image is your profile photo. Remaining images rotate in the background banner. Drag to reorder — up to 6 images.
            </p>
            <div className="space-y-3 mb-4">
              {pt.images.map((url, idx) => {
                const focalY = pt.imageFocalPoints?.[idx] ?? 50;
                return (
                  <div
                    key={url + idx}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={(e) => onDragOver(e, idx)}
                    className="rounded-lg border border-gray-100 hover:border-gray-200 bg-white hover:bg-gray-50 px-3 py-2 -mx-1 transition-colors cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-gray-300 select-none text-base leading-none shrink-0" title="Drag to reorder">⠿</span>
                      <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        <Image
                          src={url}
                          alt={`Image ${idx + 1}`}
                          fill
                          className="object-cover"
                          style={{ objectPosition: `center ${focalY}%` }}
                          sizes="64px"
                        />
                      </div>
                      <span className="flex-1 text-xs text-gray-600 truncate">{url}</span>
                      {idx === 0 && (
                        <span className="text-xs bg-brand-orange text-white px-2 py-0.5 rounded-full shrink-0">Primary</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0"
                        aria-label="Remove image"
                      >
                        ×
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 pl-7">
                      <span className="text-xs text-gray-400 shrink-0">Focus</span>
                      <span className="text-xs text-gray-400 shrink-0">Top</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={focalY}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          const fps = [...(pt.imageFocalPoints ?? pt.images.map(() => 50))];
                          fps[idx] = val;
                          update({ imageFocalPoints: fps });
                        }}
                        className="flex-1 accent-brand-orange cursor-pointer"
                      />
                      <span className="text-xs text-gray-400 shrink-0">Bottom</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {pt.images.length < 6 && (
              <div className="flex gap-2">
                <input
                  type="url"
                  className={inputCls}
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://… paste image URL"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImage(); } }}
                />
                <button onClick={addImage} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 shrink-0">Add</button>
              </div>
            )}
          </section>

          {/* Custom Enquiry Fields */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Custom Enquiry Fields</h3>
            <p className="text-xs text-gray-500 mb-3">Add extra questions to your contact form. Prospects will see these when sending an enquiry.</p>
            <CustomLeadFieldsEditor
              fields={pt.customLeadFields ?? []}
              onChange={(customLeadFields) => update({ customLeadFields })}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Language editor — tag-style input for languages
// ---------------------------------------------------------------------------
function LanguageEditor({ languages, onChange }: { languages: string[]; onChange: (l: string[]) => void }) {
  const [val, setVal] = useState("");

  function add() {
    const v = val.trim();
    if (!v || languages.includes(v)) return;
    onChange([...languages, v]);
    setVal("");
  }

  return (
    <div>
      {languages.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {languages.map((l) => (
            <span key={l} className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
              {l}
              <button onClick={() => onChange(languages.filter((x) => x !== l))} className="text-gray-400 hover:text-red-500 ml-1">&times;</button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder="e.g. English, Mandarin"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button onClick={add} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 shrink-0">Add</button>
      </div>
    </div>
  );
}
