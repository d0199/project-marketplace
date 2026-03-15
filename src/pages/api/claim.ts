import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { sendAdminAlert } from "@/lib/emailNotify";
import { sendSlackNotification, nowAWST } from "@/lib/slackNotify";
import { sendClaimSubmittedEmail } from "@/lib/customerEmail";
import { BASE_URL } from "@/lib/siteUrl";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  const {
    gymId, gymName, gymAddress, gymWebsite, name, email, phone, message,
    isNewListing, gymPhone, gymEmail, gymSuburb, gymPostcode, claimType,
    ptListingRole, ptDescription,
  } = req.body as Record<string, string> & { isNewListing?: boolean; claimType?: string };

  if (!gymId || !name || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!isAmplifyConfigured()) {
    console.log("[claim-request] backend not configured — logging only", {
      gymId, gymName, name, email, isNewListing, claimType,
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
    isNewListing: isNewListing === true || (isNewListing as unknown) === "true" || false,
    gymPhone: gymPhone ?? "",
    gymEmail: gymEmail ?? "",
    gymSuburb: gymSuburb ?? "",
    gymPostcode: gymPostcode ?? "",
    claimType: claimType ?? "gym",
    ptListingRole: ptListingRole ?? "",
    ptDescription: ptDescription ?? "",
  });

  const isPT = claimType === "pt";
  const entityLabel = isPT ? "PT profile" : "gym";
  const dateStr = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric", timeZone: "Australia/Perth" });
  const alertSubject = isNewListing
    ? `New listing: ${gymName || "Unknown"} — ${dateStr}`
    : `Claim: ${gymName || gymId} — ${dateStr}`;
  const alertBody = isNewListing
    ? `A new gym listing has been submitted and is awaiting review.\n\nGym: ${gymName}\nSuburb: ${gymSuburb} ${gymPostcode}\nWebsite: ${gymWebsite || "—"}\n\nContact: ${name} <${email}>${phone ? `\nPhone: ${phone}` : ""}${message ? `\nDescription: ${message}` : ""}\n\nReview at: ${BASE_URL}/admin`
    : `A new ${entityLabel} claim has been submitted and is awaiting review.\n\n${isPT ? "PT" : "Gym"}: ${gymName || gymId}\nClaimant: ${name} <${email}>${phone ? `\nPhone: ${phone}` : ""}${message ? `\nMessage: ${message}` : ""}\n\nReview at: ${BASE_URL}/admin`;

  await Promise.allSettled([
    sendClaimSubmittedEmail(email, name, gymName || gymId, isNewListing === true || (isNewListing as unknown) === "true"),
    sendAdminAlert(alertSubject, alertBody),
    sendSlackNotification("claim", {
      type: isNewListing ? "New Listing" : "Claim",
      gym_name: gymName || gymId,
      gym_id: gymId,
      claimant_name: name,
      claimant_email: email,
      claimant_phone: phone || "",
      message: message || "",
      submitted_at: nowAWST(),
    }),
  ]);

  return res.status(200).json({ ok: true });
}
