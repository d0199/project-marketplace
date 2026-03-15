import type { NextApiRequest, NextApiResponse } from "next";
import { affiliationStore } from "@/lib/affiliationStore";
import { ptStore } from "@/lib/ptStore";
import { ownerStore } from "@/lib/ownerStore";
import { sendAffiliationRequestEmail, sendAffiliationApprovedEmail, sendAffiliationRejectedEmail } from "@/lib/customerEmail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET — list affiliations for a PT or gym
  if (req.method === "GET") {
    const { ptId, gymId } = req.query;
    if (ptId) {
      const affs = await affiliationStore.getByPtId(ptId as string);
      return res.json(affs);
    }
    if (gymId) {
      const affs = await affiliationStore.getByGymId(gymId as string);
      return res.json(affs);
    }
    return res.status(400).json({ error: "ptId or gymId required" });
  }

  // POST — create a new affiliation request
  if (req.method === "POST") {
    const { ptId, gymId, requestedBy } = req.body;
    if (!ptId || !gymId || !requestedBy) {
      return res.status(400).json({ error: "ptId, gymId, and requestedBy required" });
    }

    // Check for existing affiliation (pending or approved)
    const existing = await affiliationStore.getByPtId(ptId);
    const dup = existing.find((a) => a.gymId === gymId && (a.status === "pending" || a.status === "approved"));
    if (dup) {
      return res.status(409).json({ error: "Affiliation already exists", existing: dup });
    }

    // Resolve names for display
    const pt = await ptStore.getById(ptId);
    const gym = await ownerStore.getById(gymId);

    const aff = await affiliationStore.create({
      ptId,
      ptName: pt?.name,
      gymId,
      gymName: gym?.name,
      requestedBy,
      status: "pending",
    });

    // Notify the gym/profile owner about the affiliation request
    if (gym?.email) {
      sendAffiliationRequestEmail(gym.email, pt?.name ?? "A personal trainer", gym.name).catch(() => {});
    }

    return res.status(201).json(aff);
  }

  // PUT — approve/reject an affiliation
  if (req.method === "PUT") {
    const { id, status, notes } = req.body;
    if (!id || !status) {
      return res.status(400).json({ error: "id and status required" });
    }

    const aff = await affiliationStore.getById(id);
    if (!aff) return res.status(404).json({ error: "Not found" });

    await affiliationStore.updateStatus(id, status, notes);

    // If approved, add gymId to PT's gymIds array
    if (status === "approved") {
      const pt = await ptStore.getById(aff.ptId);
      if (pt && !pt.gymIds.includes(aff.gymId)) {
        await ptStore.update({ ...pt, gymIds: [...pt.gymIds, aff.gymId] });
      }
      // Notify the PT that their affiliation was approved
      const ptForEmail = pt ?? await ptStore.getById(aff.ptId);
      if (ptForEmail?.email) {
        sendAffiliationApprovedEmail(ptForEmail.email, ptForEmail.name, aff.gymName ?? "the profile").catch(() => {});
      }
    }

    // If rejected/removed after being approved, remove gymId from PT's gymIds
    if (status === "rejected" || status === "removed") {
      const pt = await ptStore.getById(aff.ptId);
      if (pt && pt.gymIds.includes(aff.gymId)) {
        await ptStore.update({ ...pt, gymIds: pt.gymIds.filter((g) => g !== aff.gymId) });
      }
      // Notify the PT that their affiliation was declined
      if (status === "rejected") {
        const ptForEmail = pt ?? await ptStore.getById(aff.ptId);
        if (ptForEmail?.email) {
          sendAffiliationRejectedEmail(ptForEmail.email, ptForEmail.name, aff.gymName ?? "the profile").catch(() => {});
        }
      }
    }

    return res.json({ ok: true });
  }

  return res.status(405).end();
}
