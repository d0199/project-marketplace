import type { NextApiRequest, NextApiResponse } from "next";
import { ptStore } from "@/lib/ptStore";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/auditLog";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  const ptId = req.query.ptId as string;

  if (req.method === "GET") {
    const pt = await ptStore.getById(ptId);
    if (!pt) return res.status(404).json({ error: "Not found" });
    return res.json(pt);
  }

  if (req.method === "PUT") {
    const pt = await ptStore.getById(ptId);
    if (!pt) return res.status(404).json({ error: "Not found" });
    const now = new Date().toISOString();
    const updated = {
      ...pt, ...req.body, id: ptId,
      adminEdited: true,
      adminEditedAt: now,
      adminEditedBy: adminEmail,
      adminEditHistory: [...(pt.adminEditHistory ?? []), { by: adminEmail, at: now }],
    };
    await ptStore.update(updated);
    try { await res.revalidate(`/pt/${updated.suburbSlug}/${updated.slug}`); } catch { /* ignore */ }
    logAdminAction({ adminEmail, action: "pt.update", entityType: "pt", entityId: ptId, entityName: updated.name });
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const pt = await ptStore.getById(ptId);
    await ptStore.delete(ptId);
    if (pt) { try { await res.revalidate(`/pt/${pt.suburbSlug}/${pt.slug}`); } catch { /* ignore */ } }
    logAdminAction({ adminEmail, action: "pt.delete", entityType: "pt", entityId: ptId, entityName: pt?.name ?? ptId });
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
