import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import type { PersonalTrainer, Address } from "@/types";
import { POSTCODE_COORDS } from "@/lib/utils";
import CustomLeadFieldsEditor from "@/components/CustomLeadFieldsEditor";
import { adminFetch } from "@/lib/adminFetch";

function normalize(s: string) { return s.toLowerCase().replace(/[^a-z0-9 ]/g, ""); }

interface Props {
  pt: PersonalTrainer;
  ownerEmail?: string;
  isAdmin?: boolean;
  onSave: (updated: PersonalTrainer) => Promise<string | undefined | void> | string | undefined | void;
  onVerifyQualifications?: () => void;
}

export default function OwnerPTForm({ pt, ownerEmail, isAdmin, onSave, onVerifyQualifications }: Props) {
  const [form, setForm] = useState<PersonalTrainer>({ ...pt });
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newQualification, setNewQualification] = useState("");
  const [specialtySearch, setSpecialtySearch] = useState("");
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([]);
  const [memberOfferSearch, setMemberOfferSearch] = useState("");
  const [availableMemberOffers, setAvailableMemberOffers] = useState<string[]>([]);

  // AI description generation
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiCallsRef = useRef(0);
  const isAdminEmail = ownerEmail?.endsWith("@mynextgym.com.au") || isAdmin;

  async function generateDescription() {
    if (!isAdminEmail && aiCallsRef.current >= 5) {
      setAiError("You've reached the AI generation limit. Please edit the description manually or try again later.");
      return;
    }
    setAiLoading(true);
    setAiError("");
    setAiSuggestion("");
    try {
      const context = {
        name: form.name,
        suburb: form.address.suburb,
        postcode: form.address.postcode,
        state: form.address.state,
        specialties: form.specialties,
        qualifications: form.qualifications,
        experienceYears: form.experienceYears,
        languages: form.languages,
        memberOffers: form.memberOffers,
        pricePerSession: form.pricePerSession,
        sessionDuration: form.sessionDuration,
        availability: form.availability,
        website: form.website,
        description: form.description,
        gender: form.gender,
      };
      const r = await adminFetch("/api/owner/description-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "pt", context }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "AI request failed");
      setAiSuggestion(data.result);
      if (!isAdminEmail) aiCallsRef.current += 1;
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

  const dragIndex = useRef<number | null>(null);

  function update(patch: Partial<PersonalTrainer>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function updateAddress(patch: Partial<Address>) {
    const addr = { ...form.address, ...patch };
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
    setForm((f) => {
      const imgs = [...f.images];
      imgs.splice(idx, 0, imgs.splice(from, 1)[0]);
      const fps = [...(f.imageFocalPoints ?? f.images.map(() => 50))];
      fps.splice(idx, 0, fps.splice(from, 1)[0]);
      return { ...f, images: imgs, imageFocalPoints: fps };
    });
    dragIndex.current = idx;
  }

  function addImage() {
    const url = newImageUrl.trim();
    if (!url || form.images.length >= 6) return;
    setForm((f) => ({
      ...f,
      images: [...f.images, url],
      imageFocalPoints: [...(f.imageFocalPoints ?? f.images.map(() => 50)), 50],
    }));
    setNewImageUrl("");
  }

  function removeImage(i: number) {
    setForm((f) => ({
      ...f,
      images: f.images.filter((_, idx) => idx !== i),
      imageFocalPoints: (f.imageFocalPoints ?? f.images.map(() => 50)).filter((_, idx) => idx !== i),
    }));
  }

  function addSpecialty(s: string) {
    if (!form.specialties.includes(s)) {
      update({ specialties: [...form.specialties, s] });
    }
    setSpecialtySearch("");
  }

  function removeSpecialty(s: string) {
    update({ specialties: form.specialties.filter((x) => x !== s) });
  }

  function addMemberOffer(s: string) {
    if (!(form.memberOffers ?? []).includes(s)) {
      update({ memberOffers: [...(form.memberOffers ?? []), s] });
    }
    setMemberOfferSearch("");
  }

  function removeMemberOffer(s: string) {
    update({ memberOffers: (form.memberOffers ?? []).filter((x) => x !== s) });
  }

  function addQualification() {
    const val = newQualification.trim();
    if (!val || form.qualifications.includes(val)) return;
    update({ qualifications: [...form.qualifications, val] });
    setNewQualification("");
  }

  function removeQualification(q: string) {
    update({
      qualifications: form.qualifications.filter((x) => x !== q),
      qualificationsVerifiedList: (form.qualificationsVerifiedList ?? []).filter((x) => x !== q),
    });
  }

  function addLanguage(val: string) {
    const v = val.trim();
    if (!v || (form.languages ?? []).includes(v)) return;
    update({ languages: [...(form.languages ?? []), v] });
  }

  function removeLanguage(l: string) {
    update({ languages: (form.languages ?? []).filter((x) => x !== l) });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const msg = await onSave(form);
      if (msg) {
        setToast(msg);
        setTimeout(() => setToast(""), 5000);
      } else {
        setToast("Changes saved!");
        setTimeout(() => setToast(""), 3000);
      }
    } catch {
      setToast("Error saving changes.");
      setTimeout(() => setToast(""), 3000);
    }
    setSaving(false);
  }

  const isPaid = form.isPaid || form.isFeatured;

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${toast.includes("review") || toast.includes("submitted") ? "bg-blue-600" : toast.includes("Error") ? "bg-red-600" : "bg-green-600"}`}>
          {toast}
        </div>
      )}

      {/* Basic Info */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Basic Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Name *</label>
            <input className={inputCls} value={form.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
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
            <textarea className={inputCls} rows={3} value={form.description} onChange={(e) => update({ description: e.target.value })} />
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
            <select className={inputCls} value={form.gender ?? ""} onChange={(e) => update({ gender: e.target.value || undefined })}>
              <option value="">Not specified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Experience (years)</label>
            <input type="number" className={inputCls} value={form.experienceYears ?? ""} onChange={(e) => update({ experienceYears: e.target.value ? parseInt(e.target.value) : undefined })} />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => update({ email: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input className={inputCls} value={form.phone} onChange={(e) => update({ phone: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Website</label>
            <input className={inputCls} value={form.website} onChange={(e) => update({ website: e.target.value })} />
          </div>
          {isPaid && (
            <>
              <div>
                <label className={labelCls}>Booking URL</label>
                <input className={inputCls} value={form.bookingUrl ?? ""} onChange={(e) => update({ bookingUrl: e.target.value || undefined })} />
              </div>
              <div>
                <label className={labelCls}>Instagram</label>
                <input className={inputCls} value={form.instagram ?? ""} onChange={(e) => update({ instagram: e.target.value || undefined })} placeholder="https://instagram.com/..." />
              </div>
              <div>
                <label className={labelCls}>Facebook</label>
                <input className={inputCls} value={form.facebook ?? ""} onChange={(e) => update({ facebook: e.target.value || undefined })} placeholder="https://facebook.com/..." />
              </div>
              <div>
                <label className={labelCls}>TikTok</label>
                <input className={inputCls} value={form.tiktok ?? ""} onChange={(e) => update({ tiktok: e.target.value || undefined })} placeholder="https://tiktok.com/@..." />
              </div>
            </>
          )}
          {!isPaid && (
            <div className="sm:col-span-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-sm text-gray-500">Upgrade to a paid plan to add social media links and booking URL.</p>
            </div>
          )}
        </div>
      </section>

      {/* Address */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Address</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Street</label>
            <input className={inputCls} value={form.address.street} onChange={(e) => updateAddress({ street: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Suburb</label>
            <input className={inputCls} value={form.address.suburb} onChange={(e) => updateAddress({ suburb: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Postcode</label>
            <input className={inputCls} value={form.address.postcode} onChange={(e) => updateAddress({ postcode: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <input className={inputCls} value={form.address.state} onChange={(e) => updateAddress({ state: e.target.value })} />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Pricing</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Price per Session ($)</label>
            <input type="number" step="0.01" className={inputCls} value={form.pricePerSession ?? ""} onChange={(e) => update({ pricePerSession: e.target.value ? parseFloat(e.target.value) : undefined })} />
          </div>
          <div>
            <label className={labelCls}>Session Duration (mins)</label>
            <input type="number" className={inputCls} value={form.sessionDuration ?? ""} onChange={(e) => update({ sessionDuration: e.target.value ? parseInt(e.target.value) : undefined })} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Pricing Notes</label>
            <input className={inputCls} value={form.pricingNotes ?? ""} onChange={(e) => update({ pricingNotes: e.target.value || undefined })} placeholder="e.g. Discounts for 10-pack sessions" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Availability</label>
            <input className={inputCls} value={form.availability ?? ""} onChange={(e) => update({ availability: e.target.value || undefined })} placeholder="e.g. Mon-Fri 6am-8pm, Sat 7am-12pm" />
          </div>
        </div>
      </section>

      {/* Specialties */}
      {isPaid && (
        <section>
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Specialties</h3>
          {form.specialties.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {form.specialties.map((s) => (
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
                .filter((s) => !form.specialties.includes(s))
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
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSpecialty(s)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* Member Offers — paid only */}
      {isPaid && (
        <section>
          <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Member Offers</h3>
          {(form.memberOffers ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {(form.memberOffers ?? []).map((s) => (
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
                .filter((s) => !(form.memberOffers ?? []).includes(s))
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
                    <button
                      key={s}
                      type="button"
                      onClick={() => addMemberOffer(s)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-orange-50 hover:text-brand-orange transition-colors"
                    >
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
              value={form.memberOffersNotes ?? ""}
              onChange={(e) => update({ memberOffersNotes: e.target.value || undefined })}
              placeholder="e.g. Free body composition scan, 10% off supplements"
            />
          </div>
          <div className="mt-4">
            <label className={labelCls}>Terms &amp; Conditions</label>
            <textarea
              className={inputCls}
              rows={2}
              value={form.memberOffersTnC ?? ""}
              onChange={(e) => update({ memberOffersTnC: e.target.value || undefined })}
              placeholder="e.g. Offers valid for new clients only. Discount packs expire after 6 months."
            />
          </div>
        </section>
      )}

      {/* Qualifications */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Qualifications</h3>
        {form.qualifications.length > 0 && (() => {
          const verifiedSet = new Set(form.qualificationsVerifiedList ?? []);
          return (
            <div className="flex flex-wrap gap-2 mb-3">
              {form.qualifications.map((qual) => {
                const isVerified = verifiedSet.has(qual);
                return (
                  <span key={qual} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${isVerified ? "bg-green-50 text-green-800 border border-green-200" : "bg-blue-50 text-blue-800"}`}>
                    {isVerified && (
                      <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {qual}
                    <button onClick={() => removeQualification(qual)} className={`${isVerified ? "text-green-400 hover:text-red-500" : "text-blue-400 hover:text-red-500"} ml-1`}>&times;</button>
                  </span>
                );
              })}
            </div>
          );
        })()}
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={newQualification}
            onChange={(e) => setNewQualification(e.target.value)}
            placeholder="e.g. Cert III Fitness, Cert IV PT"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQualification(); } }}
          />
          <button onClick={addQualification} className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 shrink-0">Add</button>
        </div>
        {(() => {
          const verifiedSet = new Set(form.qualificationsVerifiedList ?? []);
          const unverifiedQuals = form.qualifications.filter((q) => !verifiedSet.has(q));
          const hasVerified = verifiedSet.size > 0;
          if (unverifiedQuals.length > 0 && onVerifyQualifications) {
            return (
              <button
                type="button"
                onClick={onVerifyQualifications}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-medium hover:bg-amber-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {hasVerified ? "Verify new qualifications" : "Verify my qualifications"}
              </button>
            );
          }
          if (form.qualificationsVerified && form.qualifications.length > 0) {
            return (
              <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                All qualifications verified
              </p>
            );
          }
          return null;
        })()}
      </section>

      {/* Languages */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Languages</h3>
        {(form.languages ?? []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {(form.languages ?? []).map((l) => (
              <span key={l} className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
                {l}
                <button onClick={() => removeLanguage(l)} className="text-gray-400 hover:text-red-500 ml-1">&times;</button>
              </span>
            ))}
          </div>
        )}
        <LanguageInput onAdd={addLanguage} />
      </section>

      {/* Images */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">Images</h3>
        <p className="text-xs text-gray-500 mb-3">
          First image is your profile photo. Remaining images rotate in the background banner. Drag to reorder — up to 6 images.
        </p>
        <div className="space-y-3 mb-4">
          {form.images.map((url, idx) => {
            const focalY = form.imageFocalPoints?.[idx] ?? 50;
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
                {/* Focal point slider */}
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
                      setForm((f) => {
                        const fps = [...(f.imageFocalPoints ?? f.images.map(() => 50))];
                        fps[idx] = val;
                        return { ...f, imageFocalPoints: fps };
                      });
                    }}
                    className="flex-1 accent-brand-orange cursor-pointer"
                  />
                  <span className="text-xs text-gray-400 shrink-0">Bottom</span>
                </div>
              </div>
            );
          })}
        </div>
        {form.images.length < 6 && (
          <div className="flex gap-2">
            <input
              type="url"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="https://… paste image URL"
              className={`${inputCls} flex-1`}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImage(); } }}
            />
            <button
              type="button"
              onClick={addImage}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        )}
      </section>

      {/* Custom Lead Fields */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-1">Custom Enquiry Fields</h3>
        <p className="text-xs text-gray-500 mb-3">
          Add extra questions to your contact form. Prospects will see these when sending an enquiry.
          {!isPaid && " Upgrade to a paid plan to activate the contact form on your profile."}
        </p>
        <CustomLeadFieldsEditor
          fields={form.customLeadFields ?? []}
          onChange={(customLeadFields) => update({ customLeadFields })}
        />
      </section>

      {/* Save */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
          className="px-6 py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function LanguageInput({ onAdd }: { onAdd: (val: string) => void }) {
  const [val, setVal] = useState("");
  function add() {
    if (val.trim()) { onAdd(val.trim()); setVal(""); }
  }
  return (
    <div className="flex gap-2">
      <input
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="e.g. English, Mandarin"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
      />
      <button onClick={add} className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 shrink-0">Add</button>
    </div>
  );
}

