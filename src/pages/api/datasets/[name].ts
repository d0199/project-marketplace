import type { NextApiRequest, NextApiResponse } from "next";
import { datasetStore } from "@/lib/datasetStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const name = req.query.name as string;
  const ds = await datasetStore.getByName(name);
  if (!ds) return res.status(404).json({ error: "Not found" });
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
  res.json({ name: ds.name, entries: ds.entries });
}
