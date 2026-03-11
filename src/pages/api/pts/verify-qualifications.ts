import type { NextApiRequest, NextApiResponse } from "next";
import { ptStore } from "@/lib/ptStore";
import { sendAdminAlert } from "@/lib/emailNotify";
import { sendSlackNotification, nowAWST } from "@/lib/slackNotify";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { BASE_URL } from "@/lib/siteUrl";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const { ptId, ptName, name, email, evidence, qualifications, fileKeys } = req.body;
  if (!ptId || !email || !evidence) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const pt = await ptStore.getById(ptId);
  if (!pt) return res.status(404).json({ error: "PT not found" });

  // Build the proposed changes — store which specific quals are being verified
  const proposed = {
    ...pt,
    qualificationEvidence: evidence,
    // Store which specific quals this request is for (ephemeral — only in GymEdit proposedChanges)
    _verificationRequestQuals: qualifications as string[],
    // Store file keys as comma-separated string if provided
    ...(fileKeys?.length && { qualificationEvidenceFiles: (fileKeys as string[]).join(",") }),
  };

  // Create a GymEdit moderation record (editType: "pt-verification")
  if (isAmplifyConfigured()) {
    try {
      await dataClient.models.GymEdit.create({
        gymId: ptId,
        gymName: ptName,
        ownerEmail: email,
        currentSnapshot: JSON.stringify(pt),
        proposedChanges: JSON.stringify(proposed),
        status: "pending",
        editType: "pt-verification",
        notes: `Qualification verification request from ${name} <${email}>`,
      });
    } catch (err) {
      console.error("[verify-qualifications] Failed to create moderation record:", err);
    }
  } else {
    // Local dev fallback — write evidence directly to PT record
    await ptStore.update(proposed);
  }

  // Notify admin via email
  const fileInfo = fileKeys?.length
    ? `\nFiles uploaded: ${(fileKeys as string[]).length} document(s)`
    : "\nNo files uploaded";

  await Promise.allSettled([
    sendAdminAlert(
      "PT qualification verification request",
      [
        `A personal trainer has submitted evidence for qualification verification.`,
        ``,
        `PT: ${ptName} (${ptId})`,
        `Submitted by: ${name} <${email}>`,
        ``,
        `Qualifications:`,
        ...(qualifications as string[]).map((q: string) => `  - ${q}`),
        ``,
        `Evidence provided:`,
        evidence,
        fileInfo,
        ``,
        `Review at: ${BASE_URL}/admin (Moderation Review tab)`,
      ].join("\n")
    ),
    sendSlackNotification("moderation", {
      type: "PT Qualification Verification",
      gym_name: ptName,
      gym_id: ptId,
      owner_email: email,
      submitted_by: `${name} <${email}>`,
      qualifications: (qualifications as string[]).join(", "),
      files_uploaded: fileKeys?.length ? `${(fileKeys as string[]).length} document(s)` : "None",
      submitted_at: nowAWST(),
    }),
  ]);

  return res.status(200).json({ ok: true });
}
