import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { sendAdminAlert } from "@/lib/emailNotify";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  const { gymId, gymName, gymAddress, gymWebsite, name, email, phone, message } =
    req.body as Record<string, string>;

  if (!gymId || !name || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!isAmplifyConfigured()) {
    console.log("[claim-request] backend not configured — logging only", {
      gymId, gymName, name, email,
    });
    return res.status(200).json({ ok: true });
  }

  await dataClient.models.Claim.create({
    gymId,
    gymName: gymName ?? "",
    gymAddress: gymAddress ?? "",
    gymWebsite: gymWebsite ?? "",
    claimantName: name,
    claimantEmail: email,
    claimantPhone: phone ?? "",
    message: message ?? "",
    status: "pending",
  });

  void sendAdminAlert(
    "New gym claim submitted",
    `A new claim has been submitted and is awaiting review.\n\nGym: ${gymName || gymId}\nClaimant: ${name} <${email}>${phone ? `\nPhone: ${phone}` : ""}${message ? `\nMessage: ${message}` : ""}\n\nReview at: https://www.mynextgym.com.au/admin`
  );

  return res.status(200).json({ ok: true });
}
