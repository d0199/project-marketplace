import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";
import { requireAdmin } from "@/lib/adminAuth";
import { logAdminAction } from "@/lib/auditLog";
import type { Gym, PersonalTrainer } from "@/types";
import { gymUrl, ptUrl } from "@/lib/slugify";
import { geocodeAddressServer } from "@/lib/geocodeServer";
import { sendEditApprovedEmail, sendEditRejectedEmail, sendVerificationApprovedEmail, sendVerificationRejectedEmail } from "@/lib/customerEmail";

async function listAllEdits() {
  const results: Record<string, unknown>[] = [];
  let nextToken: string | null | undefined;
  do {
    const res = await dataClient.models.GymEdit.list({ limit: 1000, nextToken });
    results.push(...(res.data ?? []));
    nextToken = res.nextToken;
  } while (nextToken);
  return results;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  if (!isAmplifyConfigured()) {
    return res.status(503).json({ error: "Backend not configured" });
  }

  if (req.method === "GET") {
    try {
      const edits = await listAllEdits();
      edits.sort((a, b) =>
        String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))
      );
      return res.status(200).json(edits);
    } catch (err) {
      console.error("[admin/moderation GET]", err);
      return res.status(500).json({ error: String(err) });
    }
  }

  if (req.method === "PATCH") {
    const { action, id } = req.query as { action: string; id: string };
    const { notes } = req.body as { notes?: string };

    if (!id) return res.status(400).json({ error: "Missing id" });

    const reviewedAt = new Date().toISOString();

    if (action === "reject") {
      try {
        const { data: edit } = await dataClient.models.GymEdit.get({ id });
        await dataClient.models.GymEdit.update({
          id,
          status: "rejected",
          notes: notes ?? "",
          reviewedBy: adminEmail,
          reviewedAt,
        });
        logAdminAction({ adminEmail, action: "moderation.reject", entityType: String(edit?.editType ?? "gym"), entityId: String(edit?.gymId ?? id), entityName: String(edit?.gymName ?? id), details: notes });
        // Email the owner
        if (edit?.ownerEmail) {
          const editType = String(edit.editType ?? "gym");
          const listingName = String(edit.gymName ?? edit.gymId);
          if (editType === "pt-verification") {
            sendVerificationRejectedEmail(edit.ownerEmail as string, listingName, notes ?? "").catch(() => {});
          } else {
            const eType = editType === "pt" ? "pt" : "gym";
            sendEditRejectedEmail(edit.ownerEmail as string, listingName, eType, notes ?? "").catch(() => {});
          }
        }
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("[admin/moderation reject]", err);
        return res.status(500).json({ error: String(err) });
      }
    }

    if (action === "approve") {
      try {
        const { data: edit } = await dataClient.models.GymEdit.get({ id });
        if (!edit) return res.status(404).json({ error: "Edit not found" });
        if (!edit.proposedChanges) return res.status(400).json({ error: "No proposed changes stored" });

        const editType = edit.editType as string;
        if (editType === "bulk") {
          // Bulk edit: apply single field change to multiple gyms
          const proposed = JSON.parse(edit.proposedChanges as string) as {
            field: string;
            value: unknown;
            gymIds: string[];
          };
          let applied = 0;
          for (const gymId of proposed.gymIds) {
            const gym = await ownerStore.getById(gymId);
            if (!gym) continue;
            // Apply field change
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let updated: Gym = { ...gym };
            if (proposed.field.startsWith("address.")) {
              const sub = proposed.field.split(".")[1];
              updated = { ...gym, address: { ...gym.address, [sub]: proposed.value } };
            } else if (proposed.field === "hours") {
              updated = { ...gym, hours: proposed.value as Gym["hours"] };
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (updated as any)[proposed.field] = proposed.value;
            }
            await ownerStore.update(updated);
            try { await res.revalidate(gymUrl(updated)); } catch { /* ignore */ }
            applied++;
          }
          console.log(`[moderation] Bulk edit approved: ${applied}/${proposed.gymIds.length} gyms updated`);
        } else if (editType === "pt-verification") {
          // Qualification verification approval — merge verified quals per-qualification
          const proposed = JSON.parse(edit.proposedChanges as string) as PersonalTrainer & { _verificationRequestQuals?: string[] };
          const currentPT = await ptStore.getById(String(edit.gymId));
          if (!currentPT) return res.status(404).json({ error: "PT not found" });

          // Merge: add newly approved quals to existing verified list
          const requestedQuals = proposed._verificationRequestQuals ?? proposed.qualifications ?? [];
          const existingVerified = new Set(currentPT.qualificationsVerifiedList ?? []);
          for (const q of requestedQuals) existingVerified.add(q);
          const newVerifiedList = [...existingVerified];

          const updatedPT = {
            ...currentPT,
            qualificationsVerifiedList: newVerifiedList,
            qualificationsVerified: newVerifiedList.length >= currentPT.qualifications.length,
            qualificationsNotes: notes ?? "Verified by admin",
            qualificationEvidence: proposed.qualificationEvidence,
          };
          await ptStore.update(updatedPT);
          try { await res.revalidate(ptUrl(updatedPT)); } catch { /* ignore */ }
        } else if (editType === "pt") {
          const proposed = JSON.parse(edit.proposedChanges as string) as PersonalTrainer;
          // Geocode if address present but lat/lng missing or default
          if (proposed.address?.street && (!proposed.lat || proposed.lat === -31.9505)) {
            const geo = await geocodeAddressServer(proposed.address);
            if (geo) { proposed.lat = geo.lat; proposed.lng = geo.lng; }
          }
          await ptStore.update(proposed);
          try { await res.revalidate(ptUrl(proposed)); } catch { /* ignore */ }
        } else {
          const proposed = JSON.parse(edit.proposedChanges as string) as Gym;
          // Geocode if address present but lat/lng missing or default
          if (proposed.address?.street && (!proposed.lat || proposed.lat === -31.9505)) {
            const geo = await geocodeAddressServer(proposed.address);
            if (geo) { proposed.lat = geo.lat; proposed.lng = geo.lng; }
          }
          await ownerStore.update(proposed);
          try { await res.revalidate(gymUrl(proposed)); } catch { /* ignore */ }
        }

        await dataClient.models.GymEdit.update({
          id,
          status: "approved",
          notes: notes ?? "Approved by admin",
          reviewedBy: adminEmail,
          reviewedAt,
        });

        // Email the owner
        if (edit.ownerEmail) {
          const listingName = String(edit.gymName ?? edit.gymId);
          if (editType === "pt-verification") {
            const proposed = JSON.parse(edit.proposedChanges as string) as { _verificationRequestQuals?: string[] };
            sendVerificationApprovedEmail(edit.ownerEmail as string, listingName, proposed._verificationRequestQuals ?? []).catch(() => {});
          } else {
            const eType = editType === "pt" ? "pt" as const : "gym" as const;
            sendEditApprovedEmail(edit.ownerEmail as string, listingName, eType).catch(() => {});
          }
        }

        logAdminAction({ adminEmail, action: "moderation.approve", entityType: editType === "pt" || editType === "pt-verification" ? "pt" : "gym", entityId: String(edit.gymId), entityName: String(edit.gymName ?? edit.gymId), details: editType === "bulk" ? `Bulk edit: ${editType}` : undefined });
        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("[admin/moderation approve]", err);
        return res.status(500).json({ error: String(err) });
      }
    }

    return res.status(400).json({ error: "Unknown action" });
  }

  return res.status(405).end();
}
