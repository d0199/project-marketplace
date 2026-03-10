import { useState, useEffect } from "react";
import type { PersonalTrainer, Address, CustomLeadField } from "@/types";
import { POSTCODE_COORDS } from "@/lib/utils";

function normalize(s: string) { return s.toLowerCase().replace(/[^a-z0-9 ]/g, ""); }

interface Props {
  pt: PersonalTrainer;
  onSave: (updated: PersonalTrainer) => Promise<string | undefined | void> | string | undefined | void;
}

export default function OwnerPTForm({ pt, onSave }: Props) {
  const [form, setForm] = useState<PersonalTrainer>({ ...pt });
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
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

  function addImage() {
    const url = newImageUrl.trim();
    if (!url) return;
    update({ images: [...form.images, url] });
    setNewImageUrl("");
  }

  function removeImage(i: number) {
    update({ images: form.images.filter((_, idx) => idx !== i) });
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
    update({ qualifications: form.qualifications.filter((x) => x !== q) });
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
            <label className={labelCls}>Description</label>
            <textarea className={inputCls} rows={3} value={form.description} onChange={(e) => update({ description: e.target.value })} />
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
        {form.qualifications.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {form.qualifications.map((qual) => (
              <span key={qual} className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 rounded-full px-3 py-1 text-sm">
                {qual}
                <button onClick={() => removeQualification(qual)} className="text-blue-400 hover:text-red-500 ml-1">&times;</button>
              </span>
            ))}
          </div>
        )}
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
        {form.images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {form.images.map((url, i) => (
              <div key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-24 object-cover rounded-lg" />
                <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mb-2">First image is used as your profile photo.</p>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={newImageUrl}
            onChange={(e) => setNewImageUrl(e.target.value)}
            placeholder="Image URL"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImage(); } }}
          />
          <button onClick={addImage} className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200 shrink-0">Add</button>
        </div>
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

const MAX_CUSTOM_FIELDS = 3;

function CustomLeadFieldsEditor({ fields, onChange }: { fields: CustomLeadField[]; onChange: (fields: CustomLeadField[]) => void }) {
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<CustomLeadField["type"]>("text");
  const [newOptions, setNewOptions] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const atLimit = fields.length >= MAX_CUSTOM_FIELDS;

  function addField() {
    const label = newLabel.trim();
    if (!label || atLimit) return;
    if (fields.some((f) => f.label === label)) return;
    const field: CustomLeadField = { label, type: newType, required: newRequired };
    if (newType === "select" && newOptions.trim()) {
      field.options = newOptions.split(",").map((o) => o.trim()).filter(Boolean);
    }
    onChange([...fields, field]);
    setNewLabel("");
    setNewOptions("");
    setNewRequired(false);
  }

  function removeField(label: string) {
    onChange(fields.filter((f) => f.label !== label));
  }

  function moveField(idx: number, dir: -1 | 1) {
    const next = [...fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  }

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange";

  return (
    <div className="space-y-3">
      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((field, i) => (
            <div key={field.label} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveField(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none">&uarr;</button>
                <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs leading-none">&darr;</button>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-900">{field.label}</span>
                <span className="text-xs text-gray-400 ml-2">{field.type}</span>
                {field.required && <span className="text-xs text-red-400 ml-1">required</span>}
                {field.type === "select" && field.options && (
                  <span className="text-xs text-gray-400 ml-2">({field.options.join(", ")})</span>
                )}
              </div>
              <button onClick={() => removeField(field.label)} className="text-gray-400 hover:text-red-500 text-sm">&times;</button>
            </div>
          ))}
        </div>
      )}

      {/* Add new field */}
      {atLimit ? (
        <p className="text-xs text-gray-400">Maximum of {MAX_CUSTOM_FIELDS} custom fields reached.</p>
      ) : (
        <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputCls}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Field label (e.g. Fitness Goal)"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addField(); } }}
            />
            <select className={inputCls} value={newType} onChange={(e) => setNewType(e.target.value as CustomLeadField["type"])}>
              <option value="text">Text (short)</option>
              <option value="textarea">Text (long)</option>
              <option value="select">Dropdown</option>
            </select>
          </div>
          {newType === "select" && (
            <input
              className={inputCls}
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              placeholder="Options (comma-separated, e.g. Weight Loss, Muscle Gain, General Fitness)"
            />
          )}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} className="w-4 h-4 accent-brand-orange" />
              <span className="text-sm text-gray-600">Required</span>
            </label>
            <button
              onClick={addField}
              disabled={!newLabel.trim()}
              className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              + Add Field ({fields.length}/{MAX_CUSTOM_FIELDS})
            </button>
          </div>
        </div>
      )}

      {fields.length === 0 && (
        <p className="text-xs text-gray-400">
          No custom fields yet. The default form collects name, email, phone, and message.
        </p>
      )}
    </div>
  );
}
