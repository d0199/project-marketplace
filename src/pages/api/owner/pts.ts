import type { NextApiRequest, NextApiResponse } from "next";
import { ptStore } from "@/lib/ptStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const ownerId = req.query.ownerId as string;
  if (!ownerId) return res.status(400).json({ error: "ownerId required" });
  const pts = await ptStore.getByOwner(ownerId);
  res.json(pts);
}
