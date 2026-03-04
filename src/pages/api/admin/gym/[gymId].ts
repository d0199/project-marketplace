import type { NextApiRequest, NextApiResponse } from "next";
import { ownerStore } from "@/lib/ownerStore";
import type { Gym } from "@/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const gymId = String(req.query.gymId);

  if (req.method === "GET") {
    const gym = await ownerStore.getById(gymId);
    if (!gym) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(gym);
  }

  if (req.method === "PUT") {
    const gym = req.body as Gym;
    if (gym.id !== gymId) return res.status(400).json({ error: "ID mismatch" });
    await ownerStore.update(gym);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    await ownerStore.delete(gymId);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
