import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { requireAdmin } from "@/lib/adminAuth";

async function listAllLeads() {
  const results: Record<string, unknown>[] = [];
  let nextToken: string | null | undefined;
  do {
    const res = await dataClient.models.Lead.list({ limit: 1000, nextToken });
    results.push(...(res.data ?? []));
    nextToken = res.nextToken;
  } while (nextToken);
  return results;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;

  if (!isAmplifyConfigured()) {
    return res.status(503).json({ error: "Backend not configured" });
  }

  if (req.method !== "GET") return res.status(405).end();

  try {
    const leads = await listAllLeads();
    leads.sort((a, b) =>
      String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
    );
    return res.status(200).json(leads);
  } catch (err) {
    console.error("[admin/leads] error:", err);
    return res.status(500).json({ error: "Failed to load leads" });
  }
}
