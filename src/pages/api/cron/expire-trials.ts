import type { NextApiRequest, NextApiResponse } from "next";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";
import { logSubscriptionEvent } from "@/lib/subscriptionLog";

/**
 * Cron endpoint: checks all gyms/PTs with isFreeTrial=true.
 * If trialExpiresAt has passed, clears isFreeTrial, isPaid, and isFeatured.
 *
 * Protected by a shared secret in the `authorization` header or `secret` query param.
 * Call via: GET /api/cron/expire-trials?secret=<CRON_SECRET>
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth: check secret from header or query
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.authorization?.replace("Bearer ", "") ?? req.query.secret;
  if (secret && provided !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = new Date();
  const expired: { type: string; id: string; name: string }[] = [];

  // Check gyms
  try {
    const gyms = await ownerStore.getAll();
    for (const gym of gyms) {
      if (!gym.isFreeTrial) continue;
      if (!gym.trialExpiresAt) continue;
      if (new Date(gym.trialExpiresAt) > now) continue;

      // Snapshot before clearing
      const beforeGym = { isFreeTrial: true, isPaid: gym.isPaid, isFeatured: gym.isFeatured, trialExpiresAt: gym.trialExpiresAt };
      // Trial has expired — clear flags
      gym.isFreeTrial = false;
      gym.isPaid = false;
      gym.isFeatured = false;
      // Clear member offers (same as unchecking Paid in admin)
      gym.memberOffers = [];
      gym.memberOffersScroll = false;
      delete gym.memberOffersNotes;
      delete gym.memberOffersTnC;
      await ownerStore.update(gym);
      logSubscriptionEvent({
        entityId: gym.id, entityType: "gym", entityName: gym.name,
        eventType: "trial_expired", source: "cron",
        before: beforeGym, after: { isFreeTrial: false, isPaid: false, isFeatured: false },
      });
      expired.push({ type: "gym", id: gym.id, name: gym.name });
    }
  } catch (err) {
    console.error("[expire-trials] Error processing gyms:", err);
  }

  // Check PTs
  try {
    const pts = await ptStore.getAll();
    for (const pt of pts) {
      if (!pt.isFreeTrial) continue;
      if (!pt.trialExpiresAt) continue;
      if (new Date(pt.trialExpiresAt) > now) continue;

      // Snapshot before clearing
      const beforePt = { isFreeTrial: true, isPaid: pt.isPaid, isFeatured: pt.isFeatured, trialExpiresAt: pt.trialExpiresAt };
      // Trial has expired — clear flags
      pt.isFreeTrial = false;
      pt.isPaid = false;
      pt.isFeatured = false;
      pt.memberOffers = [];
      delete pt.memberOffersNotes;
      delete pt.memberOffersTnC;
      await ptStore.update(pt);
      logSubscriptionEvent({
        entityId: pt.id, entityType: "pt", entityName: pt.name,
        eventType: "trial_expired", source: "cron",
        before: beforePt, after: { isFreeTrial: false, isPaid: false, isFeatured: false },
      });
      expired.push({ type: "pt", id: pt.id, name: pt.name });
    }
  } catch (err) {
    console.error("[expire-trials] Error processing PTs:", err);
  }

  console.log(`[expire-trials] Expired ${expired.length} trial(s):`, expired.map((e) => `${e.type}:${e.id}`).join(", ") || "none");

  return res.status(200).json({
    ok: true,
    expiredCount: expired.length,
    expired,
  });
}
