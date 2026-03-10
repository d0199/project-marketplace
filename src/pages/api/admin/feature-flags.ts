import type { NextApiRequest, NextApiResponse } from "next";
import { featureFlagStore } from "@/lib/featureFlags";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const flags = await featureFlagStore.get();
    return res.json(flags);
  }

  if (req.method === "PUT") {
    const updated = await featureFlagStore.update(req.body);
    return res.json(updated);
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).end();
}
