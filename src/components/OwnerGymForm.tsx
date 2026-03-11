import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Gym, OpeningHours } from "@/types";
import { ALL_AMENITIES, AMENITY_ICONS, ALL_MEMBER_OFFERS, MEMBER_OFFER_ICONS, ALL_SPECIALTIES, POSTCODE_COORDS } from "@/lib/utils";
import { gymUrl } from "@/lib/slugify";
import { adminFetch } from "@/lib/adminFetch";

function normalize(s: string) { return s.toLowerCase().replace(/[^a-z0-9 ]/g, ""); }

interface Props {
  gym: Gym;
  gymId?: string;
  isAdmin?: boolean;
  ownerEmail?: string;
  onSave: (updated: Gym) => Promise<string | undefined | void> | string | undefined | void;
}

const DAYS: (keyof OpeningHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export default function OwnerGymForm({ gym, gymId, isAdmin, ownerEmail, onSave }: Props) {
  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  const [form, setForm] = useState<Gym>({ ...gym });
  const [toast, setToast] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");

  // AI description generation
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const aiCallsRef = useRef(0);
  const isAdminEmail = ownerEmail?.endsWith("@mynextgym.com.au") || isAdmin;

  async function generateDescription() {
    if (!isAdminEmail && aiCallsRef.current >= 3) {
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
        amenities: form.amenities,
        specialties: form.specialties,
        memberOffers: form.memberOffers,
        pricePerWeek: form.pricePerWeek,
        website: form.website,
        description: form.description,
        hours: form.hours,
      };
      const r = await adminFetch("/api/owner/description-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "gym", context }),
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
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>([...ALL_SPECIALTIES]);
  const [availableAmenities, setAvailableAmenities] = useState<string[]>([...ALL_AMENITIES]);
  const [availableMemberOffers, setAvailableMemberOffers] = useState<string[]>([...ALL_MEMBER_OFFERS]);
  const [specSearch, setSpecSearch] = useState("");

  // Fetch datasets from API (fallback to hardcoded lists)
  useEffect(() => {
    fetch("/api/datasets/specialties")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.entries?.length) setAvailableSpecialties(data.entries); })
      .catch(() => {});
    fetch("/api/datasets/amenities")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.entries?.length) setAvailableAmenities(data.entries); })
      .catch(() => {});
    fetch("/api/datasets/member-offers")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.entries?.length) setAvailableMemberOffers(data.entries); })
      .catch(() => {});
  }, []);

  // Sync admin-only flags into form state when the panel updates them
  useEffect(() => {
    setForm((f) => ({ ...f, isPaid: gym.isPaid }));
  }, [gym.isPaid]);

  const dragIndex = useRef<number | null>(null);

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

  function setField<K extends keyof Gym>(key: K, value: Gym[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setAddressField(key: keyof Gym["address"], value: string) {
    setForm((f) => {
      const updated = { ...f, address: { ...f.address, [key]: value } };
      // Auto-fill lat/lng when a known postcode is entered
      if (key === "postcode" && value.length === 4 && POSTCODE_COORDS[value]) {
        const [lat, lng] = POSTCODE_COORDS[value];
        updated.lat = lat;
        updated.lng = lng;
      }
      return updated;
    });
  }

  function setHoursField(day: keyof OpeningHours, value: string) {
    setForm((f) => ({ ...f, hours: { ...f.hours, [day]: value } }));
  }

  function toggleAmenity(amenity: string) {
    setForm((f) => {
      const has = f.amenities.includes(amenity);
      return {
        ...f,
        amenities: has
          ? f.amenities.filter((a) => a !== amenity)
          : [...f.amenities, amenity],
      };
    });
  }

  function toggleMemberOffer(offer: string) {
    setForm((f) => {
      const current = f.memberOffers ?? [];
      const has = current.includes(offer);
      return {
        ...f,
        memberOffers: has ? current.filter((o) => o !== offer) : [...current, offer],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const msg = await onSave(form);
    setToast(typeof msg === "string" ? msg : "Changes saved successfully!");
    setTimeout(() => setToast(""), 5000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${toast.includes("review") || toast.includes("submitted") ? "bg-blue-600" : toast.includes("Error") ? "bg-red-600" : "bg-green-600"}`}>
          {toast}
        </div>
      )}

      {/* Basic info */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
          Basic Information
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>
              Gym Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
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
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              className={`${inputCls} resize-none`}
            />
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
                    onClick={() => { setField("description", aiSuggestion); setAiSuggestion(""); }}
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
            <label className={labelCls}>
              Phone
            </label>
            <input
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Website
            </label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setField("website", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Price per Week ($)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.pricePerWeek}
              onChange={(e) =>
                setField("pricePerWeek", parseFloat(e.target.value) || 0)
              }
              className={inputCls}
            />
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.priceVerified ?? false}
                onChange={(e) => setField("priceVerified", e.target.checked)}
                className="w-4 h-4 accent-brand-orange"
              />
              <span className="text-sm text-gray-600">Show this price on the listing</span>
            </label>
            {form.priceVerified && (
              <div className="mt-3">
                <label className={labelCls}>
                  Pricing note <span className="text-gray-400 font-normal">(shown below price)</span>
                </label>
                <input
                  type="text"
                  value={form.pricingNotes ?? ""}
                  onChange={(e) => setField("pricingNotes", e.target.value)}
                  placeholder="e.g. Verified using AI"
                  className={inputCls}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Social Media + Booking — paid listings only */}
      {(form.isPaid || isAdmin) && <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
          Social Media &amp; Booking
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Instagram URL
            </label>
            <input
              type="url"
              value={form.instagram ?? ""}
              onChange={(e) => setField("instagram", e.target.value || undefined)}
              placeholder="https://instagram.com/yourgym"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Facebook URL
            </label>
            <input
              type="url"
              value={form.facebook ?? ""}
              onChange={(e) => setField("facebook", e.target.value || undefined)}
              placeholder="https://facebook.com/yourgym"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>
              Online Booking URL
            </label>
            <input
              type="url"
              value={form.bookingUrl ?? ""}
              onChange={(e) => setField("bookingUrl", e.target.value || undefined)}
              placeholder="https://app.mindbodyonline.com/... or your booking page"
              className={inputCls}
            />
            <p className="text-xs text-gray-400 mt-1">Mindbody, Glofox, Pike13, or any direct booking link. Displays a &ldquo;Book Now&rdquo; button on your profile.</p>
          </div>
        </div>
      </section>}

      {/* Address */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
          Address
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>
              Street
            </label>
            <input
              value={form.address.street}
              onChange={(e) => setAddressField("street", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Suburb
            </label>
            <input
              value={form.address.suburb}
              onChange={(e) => setAddressField("suburb", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>
              Postcode
            </label>
            <input
              value={form.address.postcode}
              onChange={(e) => setAddressField("postcode", e.target.value)}
              maxLength={4}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
          Amenities
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {availableAmenities.map((amenity) => (
            <label
              key={amenity}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={form.amenities.includes(amenity)}
                onChange={() => toggleAmenity(amenity)}
                className="w-4 h-4 rounded accent-brand-orange"
              />
              <span className="text-sm text-gray-700">
                {AMENITY_ICONS[amenity]} {amenity}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <label className={labelCls}>
            Amenities note <span className="text-gray-400 font-normal">(shown below amenities)</span>
          </label>
          <input
            type="text"
            value={form.amenitiesNotes ?? ""}
            onChange={(e) => setField("amenitiesNotes", e.target.value)}
            placeholder="e.g. Verified using AI"
            className={inputCls}
          />
        </div>
      </section>

      {/* Specialties — admin only, select from dataset */}
      {isAdmin && <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
          Specialties
        </h3>
        <p className="text-xs text-gray-400 mb-3">Tag programs or disciplines this gym is known for. Search and select from the approved list. Manage the list in Admin &rarr; Datasets.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {(form.specialties ?? []).map((s) => (
            <span key={s} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">
              {s}
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, specialties: (f.specialties ?? []).filter((x) => x !== s) }))}
                className="ml-0.5 text-indigo-400 hover:text-indigo-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="relative">
          <input
            type="text"
            value={specSearch}
            onChange={(e) => setSpecSearch(e.target.value)}
            placeholder="Search specialties..."
            className={inputCls}
          />
          {specSearch.trim().length >= 1 && (() => {
            const q = normalize(specSearch);
            const matches = availableSpecialties
              .filter((s) => !(form.specialties ?? []).includes(s))
              .filter((s) => normalize(s).includes(q))
              .slice(0, 10);
            if (matches.length === 0) return (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 p-3 text-sm text-gray-400">
                No matching specialties. Add new entries in Datasets tab.
              </div>
            );
            return (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-100 max-h-48 overflow-y-auto">
                {matches.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, specialties: [...(f.specialties ?? []), s] }));
                      setSpecSearch("");
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      </section>}

      {/* Member Offers — paid listings only */}
      {(form.isPaid || isAdmin) && <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
          Member Offers
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {availableMemberOffers.map((offer) => (
            <label key={offer} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(form.memberOffers ?? []).includes(offer)}
                onChange={() => toggleMemberOffer(offer)}
                className="w-4 h-4 rounded accent-brand-orange"
              />
              <span className="text-sm text-gray-700">
                {MEMBER_OFFER_ICONS[offer]} {offer}
              </span>
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Benefits / affiliations
            </label>
            <textarea
              rows={3}
              value={form.memberOffersNotes ?? ""}
              onChange={(e) => setField("memberOffersNotes", e.target.value || undefined)}
              placeholder="e.g. No joining fee, Health fund rebates, Corporate discounts"
              className={`${inputCls} resize-none`}
            />
            <p className="text-xs text-gray-400 mt-1">Separate each benefit with a comma — shown as bullet points on your profile.</p>
          </div>
          <div>
            <label className={labelCls}>
              Terms &amp; Conditions
            </label>
            <textarea
              rows={3}
              value={form.memberOffersTnC ?? ""}
              onChange={(e) => setField("memberOffersTnC", e.target.value || undefined)}
              placeholder="Any T&Cs for the above offers…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Scrolling card banner
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.memberOffersScroll ?? false}
                onChange={(e) => setField("memberOffersScroll", e.target.checked)}
                className="w-4 h-4 accent-brand-orange"
              />
              <span className="text-xs text-gray-500">Show on card</span>
            </label>
          </div>
          <input
            type="text"
            value={form.memberScrollText ?? ""}
            onChange={(e) => setField("memberScrollText", e.target.value || undefined)}
            placeholder="e.g. No joining fee this month — ask us how!"
            className={inputCls}
          />
          <p className="text-xs text-gray-400 mt-1">This short message scrolls across the bottom of your listing card when enabled.</p>
        </div>
      </section>}

      {/* Images */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
          Images
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          First image is the primary photo shown on cards. Drag to reorder — add up to 6 images.
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
                    onClick={() => setForm((f) => ({
                      ...f,
                      images: f.images.filter((_, i) => i !== idx),
                      imageFocalPoints: (f.imageFocalPoints ?? f.images.map(() => 50)).filter((_, i) => i !== idx),
                    }))}
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
            />
            <button
              type="button"
              onClick={() => {
                const url = newImageUrl.trim();
                if (url) {
                  setForm((f) => ({
                    ...f,
                    images: [...f.images, url],
                    imageFocalPoints: [...(f.imageFocalPoints ?? f.images.map(() => 50)), 50],
                  }));
                  setNewImageUrl("");
                }
              }}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        )}
      </section>

      {/* Hours */}
      <section>
        <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-3">
          Opening Hours
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600 w-24 capitalize">
                {day}
              </span>
              <input
                value={form.hours[day] ?? ""}
                onChange={(e) => setHoursField(day, e.target.value)}
                placeholder="e.g. 6:00am – 9:00pm"
                className={`${inputCls} flex-1`}
              />
            </div>
          ))}
        </div>
        {(form.isPaid || isAdmin) && (
          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={form.hoursComment !== undefined && form.hoursComment !== ""}
                onChange={(e) => setField("hoursComment", e.target.checked ? (form.hoursComment || " ").trim() || "" : undefined)}
                className="w-4 h-4 accent-brand-orange"
              />
              <span className="text-sm text-gray-700">Add a note to opening hours</span>
            </label>
            {form.hoursComment !== undefined && (
              <textarea
                rows={2}
                value={form.hoursComment}
                onChange={(e) => setField("hoursComment", e.target.value)}
                placeholder="e.g. Public holidays may vary. 24/7 access via key fob."
                className={`${inputCls} resize-none`}
              />
            )}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between">
        {gymId ? (
          <Link
            href={gymUrl(gym)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-orange hover:text-brand-orange-dark font-medium flex items-center gap-1"
          >
            View Page →
          </Link>
        ) : <span />}
        <button
          type="submit"
          className="px-8 py-3 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
}
