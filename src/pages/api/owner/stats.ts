import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";

function zeroStats() {
  return { leads: 0, pageViews: 0, websiteClicks: 0, phoneClicks: 0, emailClicks: 0, bookingClicks: 0 };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAmplifyConfigured()) return res.status(503).json({ error: "Backend not configured" });
  if (req.method !== "GET") return res.status(405).end();

  const { ownerId, from, to } = req.query as Record<string, string>;
  if (!ownerId) return res.status(400).json({ error: "ownerId required" });

  // Get owner's gyms via GSI (fast index query), with filter fallback
  const allGyms: { id: string; name?: string | null }[] = [];
  let gymToken: string | null | undefined;
  const useGymGSI = typeof dataClient.models.Gym.listGymByOwnerId === "function";
  do {
    const r = useGymGSI
      ? await dataClient.models.Gym.listGymByOwnerId(
          { ownerId },
          { limit: 1000, nextToken: gymToken }
        )
      : await dataClient.models.Gym.list({
          limit: 1000,
          nextToken: gymToken,
          filter: { ownerId: { eq: ownerId } },
        });
    allGyms.push(...(r.data ?? []));
    gymToken = r.nextToken;
  } while (gymToken);

  // Get owner's PTs via GSI, with filter fallback
  const allPTs: { id: string; name?: string | null }[] = [];
  let ptToken: string | null | undefined;
  const usePtGSI = typeof dataClient.models.PersonalTrainer?.listPersonalTrainerByOwnerId === "function";
  do {
    const r = usePtGSI
      ? await dataClient.models.PersonalTrainer.listPersonalTrainerByOwnerId(
          { ownerId },
          { limit: 1000, nextToken: ptToken }
        )
      : await dataClient.models.PersonalTrainer.list({
          limit: 1000,
          nextToken: ptToken,
          filter: { ownerId: { eq: ownerId } },
        });
    allPTs.push(...(r.data ?? []));
    ptToken = r.nextToken;
  } while (ptToken);

  if (allGyms.length === 0 && allPTs.length === 0) {
    return res.status(200).json({ gyms: [], pts: [], aggregate: zeroStats() });
  }

  const gymMap = new Map(allGyms.map((g) => [g.id, g.name ?? ""]));
  const ptMap = new Map(allPTs.map((p) => [p.id, p.name ?? ""]));
  const allEntityIds = new Set([...gymMap.keys(), ...ptMap.keys()]);

  // Fetch all DailyGymStat records, filter client-side
  const allDaily: Record<string, unknown>[] = [];
  let nextToken: string | null | undefined;
  do {
    const r = await dataClient.models.DailyGymStat.list({ limit: 1000, nextToken });
    allDaily.push(...(r.data ?? []));
    nextToken = r.nextToken;
  } while (nextToken);

  const filteredDaily = allDaily.filter((d) => {
    if (!allEntityIds.has(String(d.gymId ?? ""))) return false;
    if (from && String(d.date ?? "") < from) return false;
    if (to && String(d.date ?? "") > to) return false;
    return true;
  });

  // Aggregate per entity (gym or PT)
  const perEntity = new Map<string, ReturnType<typeof zeroStats>>();
  for (const d of filteredDaily) {
    const gid = String(d.gymId ?? "");
    if (!perEntity.has(gid)) perEntity.set(gid, zeroStats());
    const s = perEntity.get(gid)!;
    s.pageViews += Number(d.pageViews ?? 0);
    s.websiteClicks += Number(d.websiteClicks ?? 0);
    s.phoneClicks += Number(d.phoneClicks ?? 0);
    s.emailClicks += Number(d.emailClicks ?? 0);
    s.bookingClicks += Number(d.bookingClicks ?? 0);
  }

  // Count leads per entity in date range
  const allLeads: Record<string, unknown>[] = [];
  let lt: string | null | undefined;
  do {
    const r = await dataClient.models.Lead.list({ limit: 1000, nextToken: lt });
    allLeads.push(...(r.data ?? []));
    lt = r.nextToken;
  } while (lt);

  for (const l of allLeads) {
    const gid = String(l.gymId ?? "");
    if (!allEntityIds.has(gid)) continue;
    const date = String(l.createdAt ?? "").slice(0, 10);
    if (from && date < from) continue;
    if (to && date > to) continue;
    if (!perEntity.has(gid)) perEntity.set(gid, zeroStats());
    perEntity.get(gid)!.leads++;
  }

  // Build response — separate gyms and PTs
  const gymStats = Array.from(gymMap.entries()).map(([gymId, gymName]) => ({
    gymId,
    gymName,
    stats: perEntity.get(gymId) ?? zeroStats(),
  }));

  const ptStats = Array.from(ptMap.entries()).map(([ptId, ptName]) => ({
    gymId: ptId,
    gymName: ptName,
    stats: perEntity.get(ptId) ?? zeroStats(),
  }));

  const aggregate = zeroStats();
  for (const { stats } of [...gymStats, ...ptStats]) {
    aggregate.leads += stats.leads;
    aggregate.pageViews += stats.pageViews;
    aggregate.websiteClicks += stats.websiteClicks;
    aggregate.phoneClicks += stats.phoneClicks;
    aggregate.emailClicks += stats.emailClicks;
    aggregate.bookingClicks += stats.bookingClicks;
  }

  return res.status(200).json({ gyms: gymStats, pts: ptStats, aggregate });
}
