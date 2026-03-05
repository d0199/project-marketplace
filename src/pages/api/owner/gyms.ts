import type { NextApiRequest, NextApiResponse } from "next";
import { ownerStore } from "@/lib/ownerStore";
import type { Gym } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Gym[]>
) {
  const { ownerId } = req.query;
  if (!ownerId || typeof ownerId !== "string") {
    return res.status(400).json([]);
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(await ownerStore.getByOwner(ownerId));
}
