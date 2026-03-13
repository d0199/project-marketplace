import { useState, useEffect } from "react";
import { adminFetch } from "@/lib/adminFetch";
import type { SubscriptionEvent } from "@/types";

const EVENT_LABELS: Record<string, string> = {
  trial_started: "Free trial started",
  trial_expired: "Free trial expired",
  trial_extended: "Trial date changed",
  subscription_created: "Subscription created",
  plan_changed: "Plan changed",
  subscription_cancelled: "Subscription cancelled",
  admin_override: "Admin billing change",
};

const EVENT_COLORS: Record<string, string> = {
  trial_started: "bg-orange-400",
  trial_expired: "bg-red-400",
  trial_extended: "bg-orange-300",
  subscription_created: "bg-green-500",
  plan_changed: "bg-blue-400",
  subscription_cancelled: "bg-red-500",
  admin_override: "bg-gray-400",
};

const SOURCE_BADGES: Record<string, string> = {
  stripe: "bg-purple-100 text-purple-700",
  admin: "bg-blue-100 text-blue-700",
  cron: "bg-gray-100 text-gray-700",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function DetailLine({ label, value }: { label: string; value: string | undefined }) {
  if (!value && value !== "false") return null;
  return <span className="text-xs text-gray-500">{label}: <strong>{value}</strong></span>;
}

export default function SubscriptionHistory({ entityId, entityType }: { entityId: string; entityType: "gym" | "pt" }) {
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!entityId || !open) return;
    setLoading(true);
    adminFetch(`/api/admin/subscription-events?entityId=${entityId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setEvents(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entityId, entityType, open]);

  return (
    <div className="mt-3 border border-gray-200 rounded-lg">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
      >
        <span>Subscription History</span>
        <span className="text-xs text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3">
          {loading ? (
            <p className="text-xs text-gray-400 py-2">Loading...</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No billing events recorded yet.</p>
          ) : (
            <div className="space-y-0">
              {events.map((evt, i) => {
                let details: { before?: Record<string, unknown>; after?: Record<string, unknown> } = {};
                try { details = JSON.parse(evt.details ?? "{}"); } catch { /* ignore */ }

                return (
                  <div key={evt.id ?? i} className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center pt-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${EVENT_COLORS[evt.eventType] ?? "bg-gray-300"}`} />
                      {i < events.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800">
                          {EVENT_LABELS[evt.eventType] ?? evt.eventType}
                        </span>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_BADGES[evt.source] ?? "bg-gray-100 text-gray-600"}`}>
                          {evt.source}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatDate(evt.occurredAt)}
                        {evt.adminEmail && <span className="ml-2">by {evt.adminEmail}</span>}
                      </div>
                      {/* Before/After details */}
                      {details.after && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          <DetailLine label="Paid" value={String(details.after.isPaid ?? "")} />
                          <DetailLine label="Featured" value={String(details.after.isFeatured ?? "")} />
                          <DetailLine label="Plan" value={details.after.stripePlan as string} />
                          <DetailLine label="Trial" value={String(details.after.isFreeTrial ?? "")} />
                          <DetailLine label="Expires" value={details.after.trialExpiresAt as string} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
