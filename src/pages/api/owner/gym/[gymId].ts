import type { NextApiRequest, NextApiResponse } from "next";
import { ownerStore } from "@/lib/ownerStore";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { sendAdminAlert } from "@/lib/emailNotify";
import { sendSlackNotification, nowAWST } from "@/lib/slackNotify";
import { BASE_URL } from "@/lib/siteUrl";
import { gymUrl } from "@/lib/slugify";
import { requireUser } from "@/lib/userAuth";
import type { Gym } from "@/types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Gym | { error: string } | { queued: true }>
) {
  const id = req.query.gymId as string;

  if (req.method === "GET") {
    const gym = await ownerStore.getById(id);
    if (!gym) return res.status(404).json({ error: "Not found" });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(gym);
  }

  if (req.method === "PUT") {
    // Authenticate — require valid Cognito token
    const user = await requireUser(req, res);
    if (!user) return;

    // Strip client-supplied ownerEmail; use verified email from token instead
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ownerEmail: _clientEmail, ...updated } = req.body as Gym & { ownerEmail?: string };
    const ownerEmail = user.email;
    console.log("[owner/gym PUT]", id, "ownerEmail:", ownerEmail, "name:", updated?.name, "ip:", req.headers["x-forwarded-for"] || req.socket?.remoteAddress);
    if (!updated || updated.id !== id) {
      return res.status(400).json({ error: "Invalid body" });
    }

    // Verify ownership: user must own this gym or be admin
    if (!user.isAdmin) {
      const gym = await ownerStore.getById(id);
      if (!gym || gym.ownerId !== user.ownerId) {
        return res.status(403).json({ error: "You do not own this gym" });
      }
    }

    const isInternal = user.isAdmin || ownerEmail.toLowerCase().endsWith("@mynextgym.com.au");

    // Internal staff or dev mode (no backend) → apply immediately
    if (isInternal || !isAmplifyConfigured()) {
      await ownerStore.update(updated);
      // Revalidate the ISR-cached gym profile page
      try { await res.revalidate(`/gym/${updated.suburbSlug}/${updated.slug}`); } catch { /* ignore */ }
      return res.status(200).json(updated);
    }

    // External owner → queue for moderation review
    const currentGym = await ownerStore.getById(id);
    if (!currentGym) return res.status(404).json({ error: "Not found" });

    await dataClient.models.GymEdit.create({
      gymId: id,
      gymName: currentGym.name,
      ownerEmail: ownerEmail ?? "",
      currentSnapshot: JSON.stringify(currentGym),
      proposedChanges: JSON.stringify(updated),
      status: "pending",
    });

    await Promise.allSettled([
      sendAdminAlert(
        "Gym profile edit pending review",
        `A gym owner has submitted profile changes that require moderation.\n\nGym: ${currentGym.name} (${id})\nOwner: ${ownerEmail ?? "unknown"}\n\nReview at: ${BASE_URL}/admin`
      ),
      sendSlackNotification("moderation", {
        gym_name: currentGym.name,
        gym_id: id,
        gym_url: `${BASE_URL}${gymUrl(currentGym)}`,
        owner_email: ownerEmail ?? "unknown",
        submitted_at: nowAWST(),
      }),
    ]);

    return res.status(200).json({ queued: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
