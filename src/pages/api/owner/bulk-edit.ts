import type { NextApiRequest, NextApiResponse } from "next";
import { ownerStore } from "@/lib/ownerStore";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { sendAdminAlert } from "@/lib/emailNotify";
import { sendSlackNotification, nowAWST } from "@/lib/slackNotify";
import { BASE_URL } from "@/lib/siteUrl";
import type { Gym, OpeningHours } from "@/types";

/** Apply a single field change to a gym object */
function applyField(gym: Gym, field: string, value: unknown): Gym {
  const updated = { ...gym };

  // Address sub-fields
  if (field.startsWith("address.")) {
    const sub = field.split(".")[1] as keyof Gym["address"];
    updated.address = { ...gym.address, [sub]: value };
    return updated;
  }

  // Hours — replace entire object
  if (field === "hours") {
    updated.hours = value as OpeningHours;
    return updated;
  }

  // Direct top-level field
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (updated as any)[field] = value;
  return updated;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { gymIds, field, value, ownerEmail, ownerId } = req.body as {
    gymIds: string[];
    field: string;
    value: unknown;
    ownerEmail: string;
    ownerId: string;
  };

  if (!gymIds?.length || !field || !ownerId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Validate all gyms belong to this owner
  const ownerGyms = await ownerStore.getByOwner(ownerId);
  const ownerGymIds = new Set(ownerGyms.map((g) => g.id));
  const invalidIds = gymIds.filter((id) => !ownerGymIds.has(id));
  if (invalidIds.length > 0) {
    return res.status(403).json({ error: "Some gyms do not belong to this owner" });
  }

  const affectedGyms = ownerGyms.filter((g) => gymIds.includes(g.id));

  const isInternal =
    typeof ownerEmail === "string" &&
    ownerEmail.toLowerCase().endsWith("@mynextgym.com.au");

  // Internal staff or dev mode → apply immediately
  if (isInternal || !isAmplifyConfigured()) {
    for (const gym of affectedGyms) {
      const updated = applyField(gym, field, value);
      await ownerStore.update(updated);
    }
    return res.status(200).json({ ok: true, applied: affectedGyms.length });
  }

  // External owner → create single bulk moderation record
  const currentSnapshots = affectedGyms.map((g) => ({
    gymId: g.id,
    gymName: g.name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    currentValue: field === "hours" ? g.hours : field.startsWith("address.") ? (g.address as any)[field.split(".")[1]] : (g as any)[field],
  }));

  await dataClient.models.GymEdit.create({
    gymId: affectedGyms[0].id,
    gymName: `Bulk edit (${affectedGyms.length} gyms)`,
    ownerEmail: ownerEmail ?? "",
    currentSnapshot: JSON.stringify(currentSnapshots),
    proposedChanges: JSON.stringify({ field, value, gymIds }),
    status: "pending",
    editType: "bulk",
  });

  const gymNames = affectedGyms.map((g) => g.name).join(", ");

  await Promise.allSettled([
    sendAdminAlert(
      `Bulk edit pending review (${affectedGyms.length} gyms)`,
      `A gym owner has submitted a bulk edit that requires moderation.\n\nField: ${field}\nGyms (${affectedGyms.length}): ${gymNames}\nOwner: ${ownerEmail ?? "unknown"}\n\nReview at: ${BASE_URL}/admin`
    ),
    sendSlackNotification("moderation", {
      gym_name: `Bulk edit (${affectedGyms.length} gyms)`,
      gym_id: affectedGyms[0].id,
      gym_url: `${BASE_URL}/admin`,
      owner_email: ownerEmail ?? "unknown",
      submitted_at: nowAWST(),
    }),
  ]);

  return res.status(200).json({ queued: true });
}
