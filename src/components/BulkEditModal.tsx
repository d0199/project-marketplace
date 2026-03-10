import { useState, useEffect } from "react";
import type { Gym, OpeningHours } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Field definitions
// ─────────────────────────────────────────────────────────────────────────────
interface FieldDef {
  key: string;
  label: string;
  section: string;
  type: "text" | "textarea" | "url" | "number" | "amenities" | "hours" | "member-offers";
  premium: boolean;
}

const BULK_FIELDS: FieldDef[] = [
  // Basic Info
  { key: "description", label: "Description", section: "Basic Info", type: "textarea", premium: false },
  { key: "phone", label: "Phone", section: "Basic Info", type: "text", premium: false },
  { key: "email", label: "Email", section: "Basic Info", type: "text", premium: false },
  { key: "website", label: "Website", section: "Basic Info", type: "url", premium: false },
  // Address
  { key: "address.street", label: "Street Address", section: "Address", type: "text", premium: false },
  { key: "address.suburb", label: "Suburb", section: "Address", type: "text", premium: false },
  { key: "address.postcode", label: "Postcode", section: "Address", type: "text", premium: false },
  // Amenities
  { key: "amenities", label: "Amenities", section: "Amenities", type: "amenities", premium: false },
  // Hours
  { key: "hours", label: "Opening Hours", section: "Opening Hours", type: "hours", premium: false },
  // Premium fields
  { key: "instagram", label: "Instagram URL", section: "Social Media & Booking", type: "url", premium: true },
  { key: "facebook", label: "Facebook URL", section: "Social Media & Booking", type: "url", premium: true },
  { key: "bookingUrl", label: "Booking URL", section: "Social Media & Booking", type: "url", premium: true },
  { key: "hoursComment", label: "Hours Comment", section: "Social Media & Booking", type: "text", premium: true },
  { key: "memberOffers", label: "Member Offers", section: "Member Offers", type: "member-offers", premium: true },
  { key: "memberOffersNotes", label: "Member Offers Notes", section: "Member Offers", type: "text", premium: true },
];

const DAYS: (keyof OpeningHours)[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  gyms: Gym[];
  ownerEmail: string;
  ownerId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function BulkEditModal({ gyms, ownerEmail, ownerId, onClose, onSubmitted }: Props) {
  const [step, setStep] = useState<"field" | "value">("field");
  const [selectedField, setSelectedField] = useState<FieldDef | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fieldValue, setFieldValue] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Dataset lists
  const [amenityList, setAmenityList] = useState<string[]>([]);
  const [memberOfferList, setMemberOfferList] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/datasets/amenities")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.entries) setAmenityList(d.entries); })
      .catch(() => {});
    fetch("/api/datasets/member-offers")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.entries) setMemberOfferList(d.entries); })
      .catch(() => {});
  }, []);

  const allPaid = gyms.every((g) => g.isPaid);

  // Group fields by section
  const sections: { name: string; fields: FieldDef[] }[] = [];
  for (const f of BULK_FIELDS) {
    let section = sections.find((s) => s.name === f.section);
    if (!section) {
      section = { name: f.section, fields: [] };
      sections.push(section);
    }
    section.fields.push(f);
  }

  function selectField(f: FieldDef) {
    setSelectedField(f);
    // Initialize default value based on type
    if (f.type === "amenities") setFieldValue([]);
    else if (f.type === "member-offers") setFieldValue([]);
    else if (f.type === "hours") setFieldValue({ monday: "", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" });
    else if (f.type === "number") setFieldValue(0);
    else setFieldValue("");
    setStep("value");
    setError("");
  }

  async function handleSubmit() {
    if (!selectedField) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/owner/bulk-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymIds: gyms.map((g) => g.id),
          field: selectedField.key,
          value: fieldValue,
          ownerEmail,
          ownerId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to submit");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // Format value for the summary display
  function formatValue(): string {
    if (!selectedField) return "";
    if (selectedField.type === "amenities" || selectedField.type === "member-offers") {
      const arr = fieldValue as string[];
      return arr.length === 0 ? "(none)" : arr.join(", ");
    }
    if (selectedField.type === "hours") {
      const h = fieldValue as OpeningHours;
      const filled = DAYS.filter((d) => h[d]);
      return filled.length === 0 ? "(all cleared)" : `${filled.length} days set`;
    }
    const v = String(fieldValue ?? "");
    return v || "(empty)";
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Bulk Edit</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Apply changes to {gyms.length} gym{gyms.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Affected gyms summary */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {gyms.map((g) => (
              <span key={g.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {g.name}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-2 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          {/* Step 1: Choose a field */}
          {step === "field" && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                Choose a field to update across all selected gyms.
              </p>
              {sections.map((section) => {
                const isPremiumSection = section.fields.every((f) => f.premium);
                const locked = isPremiumSection && !allPaid;
                return (
                  <div key={section.name}>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        {section.name}
                      </h3>
                      {locked && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                          Paid plans only
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {section.fields.map((f) => {
                        const disabled = f.premium && !allPaid;
                        return (
                          <button
                            key={f.key}
                            onClick={() => !disabled && selectField(f)}
                            disabled={disabled}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-colors ${
                              disabled
                                ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                                : "bg-gray-50 hover:bg-orange-50 hover:text-brand-orange text-gray-700 cursor-pointer"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{f.label}</span>
                              {disabled ? (
                                <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 2: Set the value */}
          {step === "value" && selectedField && (
            <div className="space-y-5">
              <button
                onClick={() => setStep("field")}
                className="text-sm text-gray-500 hover:text-brand-orange flex items-center gap-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to field list
              </button>

              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">{selectedField.label}</h3>
                <p className="text-sm text-gray-500">
                  Set the new value — this will replace the current value on all {gyms.length} selected gym{gyms.length !== 1 ? "s" : ""}.
                </p>
              </div>

              {/* Editor based on field type */}
              <div>
                {(selectedField.type === "text" || selectedField.type === "url") && (
                  <input
                    type={selectedField.type === "url" ? "url" : "text"}
                    value={fieldValue ?? ""}
                    onChange={(e) => setFieldValue(e.target.value)}
                    placeholder={`Enter new ${selectedField.label.toLowerCase()}`}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                    autoFocus
                  />
                )}

                {selectedField.type === "textarea" && (
                  <textarea
                    rows={4}
                    value={fieldValue ?? ""}
                    onChange={(e) => setFieldValue(e.target.value)}
                    placeholder={`Enter new ${selectedField.label.toLowerCase()}`}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange resize-none"
                    autoFocus
                  />
                )}

                {selectedField.type === "number" && (
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={fieldValue ?? 0}
                    onChange={(e) => setFieldValue(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
                    autoFocus
                  />
                )}

                {selectedField.type === "amenities" && (
                  <AmenityPicker
                    available={amenityList}
                    selected={fieldValue ?? []}
                    onChange={setFieldValue}
                  />
                )}

                {selectedField.type === "member-offers" && (
                  <CheckboxPicker
                    available={memberOfferList}
                    selected={fieldValue ?? []}
                    onChange={setFieldValue}
                    label="member offers"
                  />
                )}

                {selectedField.type === "hours" && (
                  <HoursEditor
                    hours={fieldValue ?? {}}
                    onChange={setFieldValue}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — only show submit on step 2 */}
        {step === "value" && selectedField && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            {/* Summary */}
            <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="text-xs font-semibold text-blue-800 mb-1">
                Change summary
              </div>
              <div className="text-sm text-blue-900">
                <span className="font-medium">{selectedField.label}</span> will be updated to{" "}
                <span className="font-medium">{formatValue()}</span>{" "}
                on <span className="font-semibold">{gyms.length} gym{gyms.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit for Review"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components: amenity / checkbox picker, hours editor
// ─────────────────────────────────────────────────────────────────────────────

function AmenityPicker({
  available,
  selected,
  onChange,
}: {
  available: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = search
    ? available.filter((a) => a.toLowerCase().includes(search.toLowerCase()))
    : available;

  function toggle(item: string) {
    onChange(
      selected.includes(item)
        ? selected.filter((s) => s !== item)
        : [...selected, item]
    );
  }

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search amenities..."
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange mb-2"
      />
      <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
        {filtered.map((item) => (
          <label key={item} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={() => toggle(item)}
              className="w-4 h-4 accent-brand-orange"
            />
            <span className="text-sm text-gray-700">{item}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 px-2 py-3 text-center">No matches</p>
        )}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">{selected.length} selected</p>
      )}
    </div>
  );
}

function CheckboxPicker({
  available,
  selected,
  onChange,
  label,
}: {
  available: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  label: string;
}) {
  function toggle(item: string) {
    onChange(
      selected.includes(item)
        ? selected.filter((s) => s !== item)
        : [...selected, item]
    );
  }

  return (
    <div>
      <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-100 rounded-xl p-2">
        {available.map((item) => (
          <label key={item} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={() => toggle(item)}
              className="w-4 h-4 accent-brand-orange"
            />
            <span className="text-sm text-gray-700 capitalize">{item}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">{selected.length} {label} selected</p>
      )}
    </div>
  );
}

function HoursEditor({
  hours,
  onChange,
}: {
  hours: OpeningHours;
  onChange: (h: OpeningHours) => void;
}) {
  function setDay(day: keyof OpeningHours, value: string) {
    onChange({ ...hours, [day]: value });
  }

  return (
    <div className="space-y-2">
      {DAYS.map((day) => (
        <div key={day} className="flex items-center gap-3">
          <span className="text-sm text-gray-600 w-24 capitalize">{day}</span>
          <input
            type="text"
            value={hours[day] ?? ""}
            onChange={(e) => setDay(day, e.target.value)}
            placeholder="e.g. 6:00am – 9:00pm"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
        </div>
      ))}
      <p className="text-xs text-gray-400 mt-1">Leave blank for &ldquo;Closed&rdquo;</p>
    </div>
  );
}
