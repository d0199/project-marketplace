import { useState, useEffect } from "react";
import type { PersonalTrainer, Address } from "@/types";
import { adminFetch } from "@/lib/adminFetch";
import { POSTCODE_COORDS } from "@/lib/utils";

interface Props {
  adminEmail?: string;
}

const EMPTY_PT: PersonalTrainer = {
  id: "",
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

export default function PTsTab({ adminEmail }: Props) {
  const [pts, setPts] = useState<PersonalTrainer[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [panel, setPanel] = useState<{ pt: PersonalTrainer; isNew: boolean } | null>(null);
  const [toast, setToast] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("active");
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "paid" | "featured">("all");
  const [editOwnerFor, setEditOwnerFor] = useState<string | null>(null);
  const [editOwnerVal, setEditOwnerVal] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/pts");
      const data = await r.json();
      if (Array.isArray(data)) setPts(data);
    } catch { /* */ }
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  const filtered = pts.filter((pt) => {
    if (activeFilter === "active" && pt.isActive === false) return false;
    if (activeFilter === "inactive" && pt.isActive !== false) return false;
    if (planFilter === "featured" && !pt.isFeatured) return false;
    if (planFilter === "paid" && (!pt.isPaid || pt.isFeatured)) return false;
    if (planFilter === "free" && (pt.isPaid || pt.isFeatured)) return false;
    if (q) {
      const search = q.toLowerCase();
      if (
        !pt.name.toLowerCase().includes(search) &&
        !pt.email.toLowerCase().includes(search) &&
        !pt.address.suburb.toLowerCase().includes(search) &&
        !pt.id.toLowerCase().includes(search)
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

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-brand-orange text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm">
            <p className="font-semibold mb-4">Delete this PT?</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Delete</button>
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search PTs..."
            className="px-3 py-2 border rounded-lg text-sm w-64"
          />
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)} className="px-2 py-2 border rounded-lg text-sm">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)} className="px-2 py-2 border rounded-lg text-sm">
            <option value="all">All Plans</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="featured">Featured</option>
          </select>
          <button
            onClick={() => { setQ(""); setActiveFilter("all"); setPlanFilter("all"); }}
            className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
          >
            Clear
          </button>
          <button
            onClick={() => { setQ(""); setActiveFilter("active"); setPlanFilter("all"); }}
            className="text-sm text-gray-400 hover:text-gray-600 whitespace-nowrap"
          >
            Reset
          </button>
          <span className="text-sm text-gray-500">{filtered.length} PTs</span>
        </div>
        <button
          onClick={() => setPanel({ pt: { ...EMPTY_PT }, isNew: true })}
          className="px-4 py-2 bg-brand-orange text-white rounded-lg text-sm font-medium"
        >
          + New PT
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No personal trainers found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 font-medium">ID</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Suburb</th>
                <th className="pb-2 font-medium">Owner</th>
                <th className="pb-2 font-medium">Gyms</th>
                <th className="pb-2 font-medium">Specialties</th>
                <th className="pb-2 font-medium">Flags</th>
                <th className="pb-2 font-medium">Active</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pt) => (
                <tr key={pt.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 pr-3 text-xs text-gray-400 font-mono">{pt.id}</td>
                  <td className="py-2 pr-3 font-medium text-gray-900 max-w-[200px] truncate">{pt.name || <span className="text-gray-400 italic">Unnamed</span>}</td>
                  <td className="py-2 pr-3 text-gray-600">{pt.address.suburb}</td>
                  <td className="py-2 pr-3 text-gray-600 text-xs">
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
                  <td className="py-2 pr-3 text-gray-600">{pt.gymIds.length}</td>
                  <td className="py-2 pr-3 text-gray-600 max-w-[200px] truncate">{pt.specialties.slice(0, 3).join(", ")}{pt.specialties.length > 3 ? "..." : ""}</td>
                  <td className="py-2 pr-3">
                    <span className="flex gap-1">
                      {pt.isFeatured && <span className="text-yellow-500" title="Featured">★</span>}
                      {pt.isPaid && <span className="text-green-500" title="Paid">$</span>}
                      {pt.isTest && <span className="text-purple-500" title="Test">T</span>}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <button
                      onClick={() => toggleActive(pt)}
                      className={`px-2 py-0.5 rounded text-xs font-medium ${pt.isActive !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {pt.isActive !== false ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="py-2">
                    <a href={`/pt/${pt.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">View</a>
                    <button onClick={() => setPanel({ pt: { ...pt }, isNew: false })} className="text-brand-orange hover:underline text-sm ml-3">Edit</button>
                    <button onClick={() => setConfirmDelete(pt.id)} className="text-red-500 hover:underline text-sm ml-3">Delete</button>
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
  const [newGymId, setNewGymId] = useState("");
  const [newQualification, setNewQualification] = useState("");
  const [specialtySearch, setSpecialtySearch] = useState("");
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [memberOfferSearch, setMemberOfferSearch] = useState("");
  const [availableMemberOffers, setAvailableMemberOffers] = useState<string[]>([]);

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
    // Auto-fill lat/lng from postcode
    if (patch.postcode && POSTCODE_COORDS[patch.postcode]) {
      const [lat, lng] = POSTCODE_COORDS[patch.postcode];
      update({ address: addr, lat, lng });
    } else {
      update({ address: addr });
    }
  }

  function addImage() {
    const url = newImageUrl.trim();
    if (!url) return;
    update({ images: [...pt.images, url] });
    setNewImageUrl("");
  }

  function removeImage(i: number) {
    update({ images: pt.images.filter((_, idx) => idx !== i) });
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

  function toggleSpecialty(s: string) {
    if (pt.specialties.includes(s)) {
      update({ specialties: pt.specialties.filter((x) => x !== s) });
    } else {
      update({ specialties: [...pt.specialties, s] });
    }
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

  function toggleMemberOffer(o: string) {
    const current = pt.memberOffers ?? [];
    if (current.includes(o)) {
      update({ memberOffers: current.filter((x) => x !== o) });
    } else {
      update({ memberOffers: [...current, o] });
    }
  }

  const filteredSpecialties = specialtySearch
    ? availableSpecialties.filter((s) => s.toLowerCase().includes(specialtySearch.toLowerCase()))
    : availableSpecialties;

  const filteredMemberOffers = memberOfferSearch
    ? availableMemberOffers.filter((o) => o.toLowerCase().includes(memberOfferSearch.toLowerCase()))
    : availableMemberOffers;

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex justify-end" onClick={() => setPanel(null)}>
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
          {/* Basic Info */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Basic Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Name *</label>
                <input className={inputCls} value={pt.name} onChange={(e) => update({ name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Description</label>
                <textarea className={inputCls} rows={3} value={pt.description} onChange={(e) => update({ description: e.target.value })} />
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
                <input className={inputCls} value={pt.instagram ?? ""} onChange={(e) => update({ instagram: e.target.value || undefined })} />
              </div>
              <div>
                <label className={labelCls}>Facebook</label>
                <input className={inputCls} value={pt.facebook ?? ""} onChange={(e) => update({ facebook: e.target.value || undefined })} />
              </div>
              <div>
                <label className={labelCls}>TikTok</label>
                <input className={inputCls} value={pt.tiktok ?? ""} onChange={(e) => update({ tiktok: e.target.value || undefined })} />
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
                <input className={inputCls} value={pt.pricingNotes ?? ""} onChange={(e) => update({ pricingNotes: e.target.value || undefined })} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Availability</label>
                <input className={inputCls} value={pt.availability ?? ""} onChange={(e) => update({ availability: e.target.value || undefined })} placeholder="e.g. Mon-Fri 6am-8pm, Sat 7am-12pm" />
              </div>
            </div>
          </section>

          {/* Flags */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Flags</h3>
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

          {/* Affiliated Gyms */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Affiliated Gyms</h3>
            {pt.gymIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pt.gymIds.map((gid) => (
                  <span key={gid} className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
                    {gid}
                    <button onClick={() => removeGymId(gid)} className="text-gray-400 hover:text-red-500 ml-1">&times;</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input className={inputCls} value={newGymId} onChange={(e) => setNewGymId(e.target.value)} placeholder="Gym ID (e.g. gym-001)" />
              <button onClick={addGymId} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 shrink-0">Add</button>
            </div>
          </section>

          {/* Specialties */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Specialties</h3>
            <input
              type="text"
              value={specialtySearch}
              onChange={(e) => setSpecialtySearch(e.target.value)}
              placeholder="Search specialties..."
              className={`${inputCls} mb-2`}
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredSpecialties.map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pt.specialties.includes(s)}
                    onChange={() => toggleSpecialty(s)}
                    className="w-4 h-4 accent-brand-orange"
                  />
                  <span className="text-sm">{s}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Member Offers (paid feature) */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Member Offers <span className="text-xs font-normal text-gray-400">(paid feature)</span></h3>
            <input
              type="text"
              value={memberOfferSearch}
              onChange={(e) => setMemberOfferSearch(e.target.value)}
              placeholder="Search offers..."
              className={`${inputCls} mb-2`}
            />
            <div className="max-h-40 overflow-y-auto space-y-1">
              {filteredMemberOffers.map((o) => (
                <label key={o} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(pt.memberOffers ?? []).includes(o)}
                    onChange={() => toggleMemberOffer(o)}
                    className="w-4 h-4 accent-brand-orange"
                  />
                  <span className="text-sm capitalize">{o}</span>
                </label>
              ))}
            </div>
            <div className="mt-3">
              <label className={labelCls}>Member Offers Notes</label>
              <input
                className={inputCls}
                value={pt.memberOffersNotes ?? ""}
                onChange={(e) => update({ memberOffersNotes: e.target.value || undefined })}
                placeholder="e.g. Free consultation for first-time members"
              />
            </div>
          </section>

          {/* Qualifications */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">Qualifications</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pt.qualificationsVerified ?? false}
                  onChange={(e) => update({ qualificationsVerified: e.target.checked })}
                  className="w-4 h-4 accent-green-600"
                />
                <span className={`text-xs font-semibold ${pt.qualificationsVerified ? "text-green-700" : "text-gray-400"}`}>
                  {pt.qualificationsVerified ? "Verified" : "Unverified"}
                </span>
              </label>
            </div>
            {pt.qualifications.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {pt.qualifications.map((qual) => (
                  <span key={qual} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${pt.qualificationsVerified ? "bg-green-50 text-green-800" : "bg-blue-50 text-blue-800"}`}>
                    {qual}
                    <button onClick={() => removeQualification(qual)} className={`${pt.qualificationsVerified ? "text-green-400" : "text-blue-400"} hover:text-red-500 ml-1`}>&times;</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input className={inputCls} value={newQualification} onChange={(e) => setNewQualification(e.target.value)} placeholder="e.g. Cert III Fitness, Cert IV PT" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQualification(); } }} />
              <button onClick={addQualification} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 shrink-0">Add</button>
            </div>
            <div className="mt-3">
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

          {/* Languages */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Languages</h3>
            <LanguageEditor languages={pt.languages ?? []} onChange={(languages) => update({ languages })} />
          </section>

          {/* Images */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Images</h3>
            {pt.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {pt.images.map((url, i) => (
                  <div key={i} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-24 object-cover rounded-lg" />
                    <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input className={inputCls} value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="Image URL" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImage(); } }} />
              <button onClick={addImage} className="px-3 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 shrink-0">Add</button>
            </div>
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
