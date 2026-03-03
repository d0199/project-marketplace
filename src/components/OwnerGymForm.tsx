import { useState } from "react";
import type { Gym, OpeningHours } from "@/types";
import { ALL_AMENITIES, AMENITY_ICONS } from "@/lib/utils";

interface Props {
  gym: Gym;
  onSave: (updated: Gym) => void;
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

export default function OwnerGymForm({ gym, onSave }: Props) {
  const [form, setForm] = useState<Gym>({ ...gym });
  const [toast, setToast] = useState("");

  function setField<K extends keyof Gym>(key: K, value: Gym[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setAddressField(key: keyof Gym["address"], value: string) {
    setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
    setToast("Changes saved successfully!");
    setTimeout(() => setToast(""), 3000);
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
              min={1}
              value={form.pricePerWeek}
              onChange={(e) =>
                setField("pricePerWeek", parseInt(e.target.value) || 0)
              }
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
        </div>
      </section>

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
      </section>

      <div className="flex justify-end">
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
