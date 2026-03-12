import type { NextApiRequest, NextApiResponse } from "next";
import { ownerStore } from "@/lib/ownerStore";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/auditLog";
import type { Gym } from "@/types";
import { gymUrl } from "@/lib/slugify";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  if (req.method === "GET") {
    const q = String(req.query.q ?? "").toLowerCase().trim();
    const gyms = await ownerStore.getAll();
    const filtered = q
      ? gyms.filter(
          (g) =>
            g.name.toLowerCase().includes(q) ||
            g.id.toLowerCase().includes(q) ||
            g.ownerId.toLowerCase().includes(q) ||
            g.address.suburb.toLowerCase().includes(q) ||
            g.address.postcode.toLowerCase().includes(q)
        )
      : gyms;
    return res.status(200).json(filtered);
  }

  if (req.method === "POST") {
    const gym = req.body as Omit<Gym, "id">;
    if (!gym.name) {
      return res.status(400).json({ error: "Missing name" });
    }
    if (!gym.ownerId) gym.ownerId = "unclaimed";
    try {
      const created = await ownerStore.create(gym);
      try { await res.revalidate(gymUrl(created)); } catch { /* ignore */ }
      logAdminAction({ adminEmail, action: "gym.create", entityType: "gym", entityId: created.id, entityName: created.name });
      return res.status(201).json(created);
    } catch (err) {
      console.error("[admin/gyms POST]", err);
      return res.status(500).json({ error: String(err) });
    }
  }

  return res.status(405).end();
}
