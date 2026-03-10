import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";

interface AuditEntry {
  adminEmail: string;
  action: string;       // e.g. "gym.update", "claim.approve", "user.delete"
  entityType?: string;  // "gym" | "pt" | "claim" | "user" | "dataset" | "feature-flag"
  entityId?: string;
  entityName?: string;
  details?: string;     // JSON or free text
}

/**
 * Log an admin action to the AdminAuditLog table.
 * Fire-and-forget — never throws, never blocks the response.
 */
export function logAdminAction(entry: AuditEntry): void {
  if (!isAmplifyConfigured()) return;
  dataClient.models.AdminAuditLog.create(entry).catch((err) => {
    console.error("[auditLog] Failed to write audit entry:", err);
  });
}
