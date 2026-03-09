import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Gym, OpeningHours } from "@/types";
import { ALL_AMENITIES, AMENITY_ICONS, ALL_MEMBER_OFFERS, MEMBER_OFFER_ICONS, POSTCODE_COORDS } from "@/lib/utils";

interface Props {
  gym: Gym;
  gymId?: string;
  isAdmin?: boolean;
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

export default function OwnerGymForm({ gym, gymId, isAdmin, onSave }: Props) {
  const [form, setForm] = useState<Gym>({ ...gym });
  const [toast, setToast] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");

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
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-5 py-3 rounded-lg shadow-lg font-medium animate-pulse">
          {toast}
        </div>
      )}

      {/* Basic info */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
          Basic Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gym Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              value={form.website}
              onChange={(e) => setField("website", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pricing note <span className="text-gray-400 font-normal">(shown below price)</span>
                </label>
                <input
                  type="text"
                  value={form.pricingNotes ?? ""}
                  onChange={(e) => setField("pricingNotes", e.target.value)}
                  placeholder="e.g. Verified using AI"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Social Media + Booking — paid listings only */}
      {(form.isPaid || isAdmin) && <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
          Social Media &amp; Booking
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instagram URL
            </label>
            <input
              type="url"
              value={form.instagram ?? ""}
              onChange={(e) => setField("instagram", e.target.value || undefined)}
              placeholder="https://instagram.com/yourgym"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Facebook URL
            </label>
            <input
              type="url"
              value={form.facebook ?? ""}
              onChange={(e) => setField("facebook", e.target.value || undefined)}
              placeholder="https://facebook.com/yourgym"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Online Booking URL
            </label>
            <input
              type="url"
              value={form.bookingUrl ?? ""}
              onChange={(e) => setField("bookingUrl", e.target.value || undefined)}
              placeholder="https://app.mindbodyonline.com/... or your booking page"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
            <p className="text-xs text-gray-400 mt-1">Mindbody, Glofox, Pike13, or any direct booking link. Displays a &ldquo;Book Now&rdquo; button on your profile.</p>
          </div>
        </div>
      </section>}

      {/* Address */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
          Address
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street
            </label>
            <input
              value={form.address.street}
              onChange={(e) => setAddressField("street", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Suburb
            </label>
            <input
              value={form.address.suburb}
              onChange={(e) => setAddressField("suburb", e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Postcode
            </label>
            <input
              value={form.address.postcode}
              onChange={(e) => setAddressField("postcode", e.target.value)}
              maxLength={4}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
        </div>
      </section>

      {/* Amenities */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
          Amenities
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ALL_AMENITIES.map((amenity) => (
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amenities note <span className="text-gray-400 font-normal">(shown below amenities)</span>
          </label>
          <input
            type="text"
            value={form.amenitiesNotes ?? ""}
            onChange={(e) => setField("amenitiesNotes", e.target.value)}
            placeholder="e.g. Verified using AI"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
          />
        </div>
      </section>

      {/* Specialties */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
          Specialties
        </h2>
        <p className="text-xs text-gray-400 mb-3">Tag programs or disciplines your gym is known for (e.g. HYROX, Pilates, CrossFit, Olympic Lifting)</p>
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
        <div className="flex gap-2">
          <input
            type="text"
            id="specialty-input"
            placeholder="Type a specialty and press Add"
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const input = e.currentTarget;
                const val = input.value.trim();
                if (val && !(form.specialties ?? []).includes(val)) {
                  setForm((f) => ({ ...f, specialties: [...(f.specialties ?? []), val] }));
                  input.value = "";
                }
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              const input = document.getElementById("specialty-input") as HTMLInputElement;
              const val = input?.value.trim();
              if (val && !(form.specialties ?? []).includes(val)) {
                setForm((f) => ({ ...f, specialties: [...(f.specialties ?? []), val] }));
                input.value = "";
              }
            }}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </section>

      {/* Member Offers — paid listings only */}
      {(form.isPaid || isAdmin) && <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
          Member Offers
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {ALL_MEMBER_OFFERS.map((offer) => (
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Benefits / affiliations
            </label>
            <textarea
              rows={3}
              value={form.memberOffersNotes ?? ""}
              onChange={(e) => setField("memberOffersNotes", e.target.value || undefined)}
              placeholder="e.g. No joining fee, Health fund rebates, Corporate discounts"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Separate each benefit with a comma — shown as bullet points on your profile.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Terms &amp; Conditions
            </label>
            <textarea
              rows={3}
              value={form.memberOffersTnC ?? ""}
              onChange={(e) => setField("memberOffersTnC", e.target.value || undefined)}
              placeholder="Any T&Cs for the above offers…"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none text-sm"
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
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">This short message scrolls across the bottom of your listing card when enabled.</p>
        </div>
      </section>}

      {/* Images */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
          Images
        </h2>
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
              className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b">
          Opening Hours
        </h2>
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
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
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
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
              />
            )}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between">
        {gymId ? (
          <Link
            href={`/gym/${gymId}`}
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
