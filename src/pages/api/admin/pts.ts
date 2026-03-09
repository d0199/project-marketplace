import type { NextApiRequest, NextApiResponse } from "next";
import { ptStore } from "@/lib/ptStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const pts = await ptStore.getAll();
    return res.json(pts);
  }

  if (req.method === "POST") {
    try {
      const pt = await ptStore.create(req.body);
      return res.json(pt);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Create failed";
      return res.status(500).json({ error: message });
    }
  }

  return res.status(405).end();
}
