import type { NextApiRequest, NextApiResponse } from "next";
import { ptStore } from "@/lib/ptStore";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { sendAdminAlert } from "@/lib/emailNotify";
import { sendSlackNotification, nowAWST } from "@/lib/slackNotify";
import { BASE_URL } from "@/lib/siteUrl";
import { ptUrl } from "@/lib/slugify";
import { requireUser } from "@/lib/userAuth";
import type { PersonalTrainer } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PersonalTrainer | { error: string } | { queued: true }>
) {
  const id = req.query.ptId as string;

  if (req.method === "GET") {
    const pt = await ptStore.getById(id);
    if (!pt) return res.status(404).json({ error: "Not found" });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(pt);
  }

  if (req.method === "PUT") {
    // Authenticate — require valid Cognito token
    const user = await requireUser(req, res);
    if (!user) return;

    // Strip client-supplied ownerEmail; use verified email from token instead
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ownerEmail: _clientEmail, ...updated } = req.body as PersonalTrainer & { ownerEmail?: string };
    const ownerEmail = user.email;
    console.log("[owner/pt PUT]", id, "ownerEmail:", ownerEmail, "name:", updated?.name, "ip:", req.headers["x-forwarded-for"] || req.socket?.remoteAddress);
    if (!updated || updated.id !== id) {
      return res.status(400).json({ error: "Invalid body" });
    }

    // Verify ownership: user must own this PT or be admin
    if (!user.isAdmin) {
      const pt = await ptStore.getById(id);
      if (!pt || pt.ownerId !== user.ownerId) {
        return res.status(403).json({ error: "You do not own this PT profile" });
      }
    }

    const isInternal = user.isAdmin || ownerEmail.toLowerCase().endsWith("@mynextgym.com.au");

    // Internal staff or dev mode → apply immediately
    if (isInternal || !isAmplifyConfigured()) {
      await ptStore.update(updated);
      try { await res.revalidate(`/pt/${updated.suburbSlug}/${updated.slug}`); } catch { /* ignore */ }
      return res.status(200).json(updated);
    }

    // External owner → queue for moderation review
    const currentPT = await ptStore.getById(id);
    if (!currentPT) return res.status(404).json({ error: "Not found" });

    await dataClient.models.GymEdit.create({
      gymId: id,
      gymName: currentPT.name,
      ownerEmail: ownerEmail ?? "",
      currentSnapshot: JSON.stringify(currentPT),
      proposedChanges: JSON.stringify(updated),
      status: "pending",
      editType: "pt",
    });

    await Promise.allSettled([
      sendAdminAlert(
        "PT profile edit pending review",
        `A PT owner has submitted profile changes that require moderation.\n\nPT: ${currentPT.name} (${id})\nOwner: ${ownerEmail ?? "unknown"}\n\nReview at: ${BASE_URL}/admin`
      ),
      sendSlackNotification("moderation", {
        gym_name: currentPT.name,
        gym_id: id,
        gym_url: `${BASE_URL}${ptUrl(currentPT)}`,
        owner_email: ownerEmail ?? "unknown",
        submitted_at: nowAWST(),
      }),
    ]);

    return res.status(200).json({ queued: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
