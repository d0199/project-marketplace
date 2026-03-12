import type { NextApiRequest, NextApiResponse } from "next";
import { ptStore } from "@/lib/ptStore";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/auditLog";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  if (req.method === "GET") {
    const pts = await ptStore.getAll();
    return res.json(pts);
  }

  if (req.method === "POST") {
    try {
      const pt = await ptStore.create(req.body);
      try { await res.revalidate(`/pt/${pt.suburbSlug}/${pt.slug}`); } catch { /* ignore */ }
      logAdminAction({ adminEmail, action: "pt.create", entityType: "pt", entityId: pt.id, entityName: pt.name });
      return res.json(pt);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Create failed";
      return res.status(500).json({ error: message });
    }
  }

  return res.status(405).end();
}
