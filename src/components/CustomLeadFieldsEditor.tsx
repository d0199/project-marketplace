import { useState } from "react";
import type { CustomLeadField } from "@/types";

const MAX_CUSTOM_FIELDS = 3;

export default function CustomLeadFieldsEditor({
  fields,
  onChange,
}: {
  fields: CustomLeadField[];
  onChange: (fields: CustomLeadField[]) => void;
}) {
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
    </div>
  );
}
