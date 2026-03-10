import type { NextApiRequest, NextApiResponse } from "next";
import { sendAdminAlert } from "@/lib/emailNotify";
import { sendSlackNotification, nowAWST } from "@/lib/slackNotify";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";

const FEEDBACK_RECIPIENT = "admin@mynextgym.com.au";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { gymId, gymName, issueType, message, listingType = "gym" } = req.body;
  if (!gymId || !issueType) return res.status(400).json({ error: "gymId and issueType are required" });

  const prefix = listingType === "pt" ? "pt" : "gym";
  const listingUrl = `https://www.mynextgym.com.au/${prefix}/${gymId}`;
  const submittedAt = nowAWST();
  const typeLabel = listingType === "pt" ? "PT" : "Gym";

  const emailBody = [
    `Listing feedback received`,
    ``,
    `${typeLabel}: ${gymName || gymId}`,
    `ID: ${gymId}`,
    `URL: ${listingUrl}`,
    `Issue: ${issueType}`,
    message ? `Details: ${message}` : "",
    ``,
    `Submitted: ${submittedAt}`,
    listingType === "pt"
      ? `Admin: https://www.mynextgym.com.au/admin?pt=${gymId}`
      : `Admin: https://www.mynextgym.com.au/admin?gym=${gymId}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Store in DynamoDB for audit
  const storePromise = (async () => {
    if (!isAmplifyConfigured() || !dataClient.models.FeedbackReport) return;
    try {
      await dataClient.models.FeedbackReport.create({
        listingId: gymId,
        listingName: gymName || gymId,
        listingType,
        issueType,
        message: message || "",
        submittedAt,
      });
    } catch (err) {
      console.error("[feedback] DynamoDB store error:", err);
    }
  })();

  await Promise.allSettled([
    sendAdminAlert(`${typeLabel} feedback: ${issueType}`, emailBody, FEEDBACK_RECIPIENT),
    sendSlackNotification("feedback", {
      listing_type: typeLabel,
      listing_name: gymName || gymId,
      listing_id: gymId,
      listing_url: listingUrl,
      issue_type: issueType,
      message: message || "(no details provided)",
      submitted_at: submittedAt,
    }),
    storePromise,
  ]);

  res.status(200).json({ ok: true });
}
