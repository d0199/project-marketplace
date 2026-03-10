import type { NextApiRequest, NextApiResponse } from "next";
import { ptStore } from "@/lib/ptStore";
import { sendAdminAlert } from "@/lib/emailNotify";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const { ptId, ptName, name, email, evidence, qualifications } = req.body;
  if (!ptId || !email || !evidence) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Store the evidence on the PT record for admin review
  const pt = await ptStore.getById(ptId);
  if (!pt) return res.status(404).json({ error: "PT not found" });

  // Save evidence text (admin will review and toggle qualificationsVerified)
  await ptStore.update({
    ...pt,
    qualificationEvidence: evidence,
  });

  // Notify admin
  await sendAdminAlert(
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
      ``,
      `Review at: https://www.mynextgym.com.au/admin`,
    ].join("\n")
  ).catch(() => {});

  return res.status(200).json({ ok: true });
}
