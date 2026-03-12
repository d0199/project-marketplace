import type { NextApiRequest, NextApiResponse } from "next";
import { featureFlagStore } from "@/lib/featureFlags";

/** Public endpoint — returns only the API kill-switch flags (no auth required). */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const flags = await featureFlagStore.get();
  res.json({ claudeApi: flags.claudeApi, googleApi: flags.googleApi });
}
