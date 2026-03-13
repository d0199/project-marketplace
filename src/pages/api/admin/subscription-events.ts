import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuth";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  if (req.method !== "GET") return res.status(405).end();

  if (!isAmplifyConfigured()) {
    return res.status(200).json([]);
  }

  const entityId = req.query.entityId as string;
  if (!entityId) {
    return res.status(400).json({ error: "entityId required" });
  }

  try {
    const results: Record<string, unknown>[] = [];
    let nextToken: string | null | undefined;
    do {
      const resp = await dataClient.models.SubscriptionEvent.listSubscriptionEventByEntityId(
        { entityId },
        { limit: 100, nextToken }
      );
      results.push(...(resp.data ?? []));
      nextToken = resp.nextToken;
    } while (nextToken);

    // Sort by occurredAt descending (newest first)
    results.sort((a, b) =>
      String(b.occurredAt ?? "").localeCompare(String(a.occurredAt ?? ""))
    );

    return res.status(200).json(results);
  } catch (err) {
    console.error("[subscription-events]", err);
    return res.status(500).json({ error: String(err) });
  }
}
