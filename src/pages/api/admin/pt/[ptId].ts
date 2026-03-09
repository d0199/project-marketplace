import type { NextApiRequest, NextApiResponse } from "next";
import { ptStore } from "@/lib/ptStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ptId = req.query.ptId as string;

  if (req.method === "GET") {
    const pt = await ptStore.getById(ptId);
    if (!pt) return res.status(404).json({ error: "Not found" });
    return res.json(pt);
  }

  if (req.method === "PUT") {
    const pt = await ptStore.getById(ptId);
    if (!pt) return res.status(404).json({ error: "Not found" });
    const updated = { ...pt, ...req.body, id: ptId };
    await ptStore.update(updated);
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    await ptStore.delete(ptId);
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
