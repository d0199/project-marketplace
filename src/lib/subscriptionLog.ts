import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";

export interface BillingSnapshot {
  isPaid?: boolean;
  isFeatured?: boolean;
  isFreeTrial?: boolean;
  trialExpiresAt?: string;
  stripePlan?: string;
  stripeSubscriptionId?: string;
}

interface LogEventParams {
  entityId: string;
  entityType: "gym" | "pt";
  entityName?: string;
  eventType: string;
  source: "stripe" | "admin" | "cron";
  adminEmail?: string;
  before?: BillingSnapshot;
  after?: BillingSnapshot;
}

/**
 * Log a subscription/billing event. Fire-and-forget — never throws.
 */
export function logSubscriptionEvent(params: LogEventParams): void {
  if (!isAmplifyConfigured()) return;
  dataClient.models.SubscriptionEvent.create({
    entityId: params.entityId,
    entityType: params.entityType,
    entityName: params.entityName ?? "",
    eventType: params.eventType,
    source: params.source,
    adminEmail: params.adminEmail ?? "",
    details: JSON.stringify({ before: params.before, after: params.after }),
    occurredAt: new Date().toISOString(),
  }).catch((err) => {
    console.error("[subscriptionLog] Failed:", err);
  });
}

/** Extract billing fields from a gym/PT record */
export function billingSnapshot(entity: Record<string, unknown>): BillingSnapshot {
  return {
    isPaid: entity.isPaid as boolean | undefined,
    isFeatured: entity.isFeatured as boolean | undefined,
    isFreeTrial: entity.isFreeTrial as boolean | undefined,
    trialExpiresAt: entity.trialExpiresAt as string | undefined,
    stripePlan: entity.stripePlan as string | undefined,
    stripeSubscriptionId: entity.stripeSubscriptionId as string | undefined,
  };
}

/** Detect what billing change occurred, returns eventType or null if no change */
export function detectBillingChange(before: BillingSnapshot, after: BillingSnapshot): string | null {
  // Trial started
  if (!before.isFreeTrial && after.isFreeTrial) return "trial_started";
  // Trial date extended
  if (before.isFreeTrial && after.isFreeTrial && before.trialExpiresAt !== after.trialExpiresAt) return "trial_extended";
  // Trial manually turned off
  if (before.isFreeTrial && !after.isFreeTrial) return "admin_override";
  // Billing flag changes
  if (before.isPaid !== after.isPaid || before.isFeatured !== after.isFeatured || before.stripePlan !== after.stripePlan) return "admin_override";
  return null;
}
