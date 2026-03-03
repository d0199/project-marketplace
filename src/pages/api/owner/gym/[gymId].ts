import type { NextApiRequest, NextApiResponse } from "next";
import { ownerStore } from "@/lib/ownerStore";
import type { Gym } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Gym | { error: string }>
) {
  const id = req.query.gymId as string;

  if (req.method === "GET") {
    const gym = await ownerStore.getById(id);
    if (!gym) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(gym);
  }

  if (req.method === "PUT") {
    const updated = req.body as Gym;
    if (!updated || updated.id !== id) {
      return res.status(400).json({ error: "Invalid body" });
    }
    await ownerStore.update(updated);
    return res.status(200).json(updated);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
