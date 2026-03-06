import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";

function zeroStats() {
  return { leads: 0, pageViews: 0, websiteClicks: 0, phoneClicks: 0, emailClicks: 0 };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAmplifyConfigured()) return res.status(503).json({ error: "Backend not configured" });
  if (req.method !== "GET") return res.status(405).end();

  const { ownerId, from, to } = req.query as Record<string, string>;
  if (!ownerId) return res.status(400).json({ error: "ownerId required" });

  // Get owner's gyms — paginate to handle large datasets
  const allGyms: { id: string; name?: string | null }[] = [];
  let gymToken: string | null | undefined;
  do {
    const res = await dataClient.models.Gym.list({
      filter: { ownerId: { eq: ownerId } },
      limit: 1000,
      nextToken: gymToken,
    });
    allGyms.push(...(res.data ?? []));
    gymToken = res.nextToken;
  } while (gymToken);

  if (allGyms.length === 0) {
    return res.status(200).json({ gyms: [], aggregate: zeroStats() });
  }

  const gymMap = new Map(allGyms.map((g) => [g.id, g.name ?? ""]));
  const gymIds = new Set(gymMap.keys());

  // Fetch all DailyGymStat records, filter client-side
  const allDaily: Record<string, unknown>[] = [];
  let nextToken: string | null | undefined;
  do {
    const r = await dataClient.models.DailyGymStat.list({ limit: 1000, nextToken });
    allDaily.push(...(r.data ?? []));
    nextToken = r.nextToken;
  } while (nextToken);

  const filteredDaily = allDaily.filter((d) => {
    if (!gymIds.has(String(d.gymId ?? ""))) return false;
    if (from && String(d.date ?? "") < from) return false;
    if (to && String(d.date ?? "") > to) return false;
    return true;
  });

  // Aggregate per gym
  const perGym = new Map<string, ReturnType<typeof zeroStats>>();
  for (const d of filteredDaily) {
    const gid = String(d.gymId ?? "");
    if (!perGym.has(gid)) perGym.set(gid, zeroStats());
    const s = perGym.get(gid)!;
    s.pageViews += Number(d.pageViews ?? 0);
    s.websiteClicks += Number(d.websiteClicks ?? 0);
    s.phoneClicks += Number(d.phoneClicks ?? 0);
    s.emailClicks += Number(d.emailClicks ?? 0);
  }

  // Count leads per gym in date range
  const allLeads: Record<string, unknown>[] = [];
  let lt: string | null | undefined;
  do {
    const r = await dataClient.models.Lead.list({ limit: 1000, nextToken: lt });
    allLeads.push(...(r.data ?? []));
    lt = r.nextToken;
  } while (lt);

  for (const l of allLeads) {
    const gid = String(l.gymId ?? "");
    if (!gymIds.has(gid)) continue;
    const date = String(l.createdAt ?? "").slice(0, 10);
    if (from && date < from) continue;
    if (to && date > to) continue;
    if (!perGym.has(gid)) perGym.set(gid, zeroStats());
    perGym.get(gid)!.leads++;
  }

  // Build response
  const gymStats = Array.from(gymMap.entries()).map(([gymId, gymName]) => ({
    gymId,
    gymName,
    stats: perGym.get(gymId) ?? zeroStats(),
  }));

  const aggregate = zeroStats();
  for (const { stats } of gymStats) {
    aggregate.leads += stats.leads;
    aggregate.pageViews += stats.pageViews;
    aggregate.websiteClicks += stats.websiteClicks;
    aggregate.phoneClicks += stats.phoneClicks;
    aggregate.emailClicks += stats.emailClicks;
  }

  return res.status(200).json({ gyms: gymStats, aggregate });
}
