import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";

const VALID_STATUSES = ["new", "read", "contacted"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAmplifyConfigured()) return res.status(503).json({ error: "Backend not configured" });

  // ── GET: list leads for owner's gyms ──────────────────────────────────────
  if (req.method === "GET") {
    const { ownerId, from, to } = req.query as Record<string, string>;
    if (!ownerId) return res.status(400).json({ error: "ownerId required" });

    // Resolve the owner's gym IDs via GSI (fast index query), with filter fallback
    const allGyms: { id: string }[] = [];
    let gymToken: string | null | undefined;
    const useGSI = typeof dataClient.models.Gym.listGymByOwnerId === "function";
    do {
      const res = useGSI
        ? await dataClient.models.Gym.listGymByOwnerId(
            { ownerId },
            { limit: 1000, nextToken: gymToken }
          )
        : await dataClient.models.Gym.list({
            limit: 1000,
            nextToken: gymToken,
            filter: { ownerId: { eq: ownerId } },
          });
      allGyms.push(...(res.data ?? []));
      gymToken = res.nextToken;
    } while (gymToken);
    const gymIds = new Set(allGyms.map((g) => g.id));
    if (gymIds.size === 0) return res.status(200).json([]);

    // Paginate all leads, filter client-side by gymId + date range
    const results: Record<string, unknown>[] = [];
    let nextToken: string | null | undefined;
    do {
      const r = await dataClient.models.Lead.list({ limit: 1000, nextToken });
      results.push(...(r.data ?? []));
      nextToken = r.nextToken;
    } while (nextToken);

    let leads = results.filter((l) => gymIds.has(String(l.gymId ?? "")));
    if (from) leads = leads.filter((l) => String(l.createdAt ?? "").slice(0, 10) >= from);
    if (to) leads = leads.filter((l) => String(l.createdAt ?? "").slice(0, 10) <= to);

    leads.sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );
    return res.status(200).json(leads);
  }

  // ── PATCH: update a lead's status ─────────────────────────────────────────
  if (req.method === "PATCH") {
    const { leadId, status } = req.body as { leadId: string; status: string };
    if (!leadId || !status) return res.status(400).json({ error: "leadId and status required" });
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });

    await dataClient.models.Lead.update({ id: leadId, status });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
