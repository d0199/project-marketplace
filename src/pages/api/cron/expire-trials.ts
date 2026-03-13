import type { NextApiRequest, NextApiResponse } from "next";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";
import { logSubscriptionEvent } from "@/lib/subscriptionLog";

let cronSecret: string | null = null;

async function getCronSecret(): Promise<string> {
  if (cronSecret) return cronSecret;
  // Try SSM first
  try {
    const appId = process.env.AMPLIFY_APP_ID ?? "d36uz2q25gygnh";
    const region = process.env.AWS_REGION ?? "ap-southeast-2";
    const client = new SSMClient({ region });
    const result = await client.send(
      new GetParametersCommand({
        Names: [`/amplify/shared/${appId}/CRON_SECRET`],
        WithDecryption: true,
      })
    );
    const val = result.Parameters?.[0]?.Value;
    if (val) { cronSecret = val; return val; }
  } catch (err) {
    console.warn("[expire-trials] SSM fetch failed, falling back to env:", err);
  }
  // Fallback to env var
  cronSecret = process.env.CRON_SECRET ?? "";
  return cronSecret;
}

/**
 * Cron endpoint: checks gyms/PTs with isFreeTrial=true.
 * If trialExpiresAt has passed, clears isFreeTrial, isPaid, and isFeatured.
 *
 * Uses filtered DynamoDB scans to only fetch trial records, not all gyms/PTs.
 *
 * Protected by a shared secret in the `authorization` header or `secret` query param.
 * Call via: GET /api/cron/expire-trials?secret=<CRON_SECRET>
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth: check secret from SSM or env
  const secret = await getCronSecret();
  const provided = req.headers.authorization?.replace("Bearer ", "") ?? req.query.secret;
  if (secret && provided !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isAmplifyConfigured()) {
    return res.status(200).json({ ok: true, expiredCount: 0, expired: [], message: "Backend not configured" });
  }

  const now = new Date();
  const expired: { type: string; id: string; name: string }[] = [];

  // Check gyms — filtered scan for isFreeTrial=true only
  try {
    const trialGyms: Record<string, unknown>[] = [];
    let nextToken: string | null | undefined;
    do {
      const resp = await dataClient.models.Gym.list({
        filter: { isFreeTrial: { eq: true } },
        limit: 1000,
        nextToken,
      });
      trialGyms.push(...(resp.data ?? []));
      nextToken = resp.nextToken;
    } while (nextToken);

    for (const raw of trialGyms) {
      const trialExpiresAt = raw.trialExpiresAt as string | undefined;
      if (!trialExpiresAt) continue;
      if (new Date(trialExpiresAt) > now) continue;

      const id = raw.id as string;
      const name = (raw.name as string) ?? id;
      const gym = await ownerStore.getById(id);
      if (!gym) continue;

      // Snapshot before clearing
      const before = { isFreeTrial: true, isPaid: gym.isPaid, isFeatured: gym.isFeatured, trialExpiresAt: gym.trialExpiresAt };

      // Trial has expired — clear flags
      gym.isFreeTrial = false;
      gym.isPaid = false;
      gym.isFeatured = false;
      gym.memberOffers = [];
      gym.memberOffersScroll = false;
      delete gym.memberOffersNotes;
      delete gym.memberOffersTnC;
      await ownerStore.update(gym);

      logSubscriptionEvent({
        entityId: id, entityType: "gym", entityName: name,
        eventType: "trial_expired", source: "cron",
        before, after: { isFreeTrial: false, isPaid: false, isFeatured: false },
      });
      expired.push({ type: "gym", id, name });
    }
  } catch (err) {
    console.error("[expire-trials] Error processing gyms:", err);
  }

  // Check PTs — filtered scan for isFreeTrial=true only
  try {
    const trialPTs: Record<string, unknown>[] = [];
    let nextToken: string | null | undefined;
    do {
      const resp = await dataClient.models.PersonalTrainer.list({
        filter: { isFreeTrial: { eq: true } },
        limit: 1000,
        nextToken,
      });
      trialPTs.push(...(resp.data ?? []));
      nextToken = resp.nextToken;
    } while (nextToken);

    for (const raw of trialPTs) {
      const trialExpiresAt = raw.trialExpiresAt as string | undefined;
      if (!trialExpiresAt) continue;
      if (new Date(trialExpiresAt) > now) continue;

      const id = raw.id as string;
      const name = (raw.name as string) ?? id;
      const pt = await ptStore.getById(id);
      if (!pt) continue;

      // Snapshot before clearing
      const before = { isFreeTrial: true, isPaid: pt.isPaid, isFeatured: pt.isFeatured, trialExpiresAt: pt.trialExpiresAt };

      // Trial has expired — clear flags
      pt.isFreeTrial = false;
      pt.isPaid = false;
      pt.isFeatured = false;
      pt.memberOffers = [];
      delete pt.memberOffersNotes;
      delete pt.memberOffersTnC;
      await ptStore.update(pt);

      logSubscriptionEvent({
        entityId: id, entityType: "pt", entityName: name,
        eventType: "trial_expired", source: "cron",
        before, after: { isFreeTrial: false, isPaid: false, isFeatured: false },
      });
      expired.push({ type: "pt", id, name });
    }
  } catch (err) {
    console.error("[expire-trials] Error processing PTs:", err);
  }

  console.log(`[expire-trials] Scanned trial records, expired ${expired.length}:`, expired.map((e) => `${e.type}:${e.id}`).join(", ") || "none");

  return res.status(200).json({
    ok: true,
    expiredCount: expired.length,
    expired,
  });
}
