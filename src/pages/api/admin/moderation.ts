import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";
import { requireAdmin } from "@/lib/adminAuth";
import type { Gym, PersonalTrainer } from "@/types";

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
  if (!(await requireAdmin(req, res))) return;

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

    if (action === "reject") {
      try {
        await dataClient.models.GymEdit.update({ id, status: "rejected", notes: notes ?? "" });
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
        if (editType === "pt-verification") {
          // Qualification verification approval — set verified flag on PT
          const proposed = JSON.parse(edit.proposedChanges as string) as PersonalTrainer;
          await ptStore.update({
            ...proposed,
            qualificationsVerified: true,
            qualificationsNotes: notes ?? "Verified by admin",
          });
        } else if (editType === "pt") {
          const proposed = JSON.parse(edit.proposedChanges as string) as PersonalTrainer;
          await ptStore.update(proposed);
        } else {
          const proposed = JSON.parse(edit.proposedChanges as string) as Gym;
          await ownerStore.update(proposed);
        }

        await dataClient.models.GymEdit.update({
          id,
          status: "approved",
          notes: notes ?? `Approved by admin`,
        });

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
