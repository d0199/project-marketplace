import type { NextApiRequest, NextApiResponse } from "next";
import { ownerStore } from "@/lib/ownerStore";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/auditLog";
import { logSubscriptionEvent, billingSnapshot, detectBillingChange } from "@/lib/subscriptionLog";
import type { Gym } from "@/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  const gymId = String(req.query.gymId);

  if (req.method === "GET") {
    const gym = await ownerStore.getById(gymId);
    if (!gym) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(gym);
  }

  if (req.method === "PUT") {
    try {
      const gym = req.body as Gym;
      if (gym.id !== gymId) return res.status(400).json({ error: "ID mismatch" });
      const existing = await ownerStore.getById(gymId);
      const beforeBilling = existing ? billingSnapshot(existing as unknown as Record<string, unknown>) : {};
      const now = new Date().toISOString();
      gym.adminEdited = true;
      gym.adminEditedAt = now;
      gym.adminEditedBy = adminEmail;
      gym.adminEditHistory = [...(existing?.adminEditHistory ?? []), { by: adminEmail, at: now }].slice(-20);
      await ownerStore.update(gym);
      const afterBilling = billingSnapshot(gym as unknown as Record<string, unknown>);
      const changeType = detectBillingChange(beforeBilling, afterBilling);
      if (changeType) {
        logSubscriptionEvent({
          entityId: gymId, entityType: "gym", entityName: gym.name,
          eventType: changeType, source: "admin", adminEmail,
          before: beforeBilling, after: afterBilling,
        });
      }
      try { await res.revalidate(`/gym/${gym.suburbSlug}/${gym.slug}`); } catch { /* ignore */ }
      logAdminAction({ adminEmail, action: "gym.update", entityType: "gym", entityId: gymId, entityName: gym.name });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[admin/gym PUT] error:", gymId, err);
      return res.status(500).json({ error: String(err) });
    }
  }

  if (req.method === "DELETE") {
    const gym = await ownerStore.getById(gymId);
    await ownerStore.delete(gymId);
    if (gym) { try { await res.revalidate(`/gym/${gym.suburbSlug}/${gym.slug}`); } catch { /* ignore */ } }
    logAdminAction({ adminEmail, action: "gym.delete", entityType: "gym", entityId: gymId, entityName: gym?.name ?? gymId });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
