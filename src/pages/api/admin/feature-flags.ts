import type { NextApiRequest, NextApiResponse } from "next";
import { featureFlagStore } from "@/lib/featureFlags";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/auditLog";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  if (req.method === "GET") {
    const flags = await featureFlagStore.get();
    return res.json(flags);
  }

  if (req.method === "PUT") {
    const updated = await featureFlagStore.update(req.body);
    logAdminAction({ adminEmail, action: "feature-flag.update", entityType: "feature-flag", details: JSON.stringify(req.body) });
    return res.json(updated);
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).end();
}
