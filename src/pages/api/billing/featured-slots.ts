import type { NextApiRequest, NextApiResponse } from "next";
import { ownerStore } from "@/lib/ownerStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const { postcode, gymId } = req.query as { postcode: string; gymId?: string };

  if (!postcode) return res.status(400).json({ error: "Missing postcode" });

  const all = await ownerStore.getAll();
  const count = all.filter(
    (g) => g.isFeatured && g.address.postcode === postcode && g.id !== gymId
  ).length;

  return res.status(200).json({ count, available: count < 3 });
}
