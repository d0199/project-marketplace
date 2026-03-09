import type { NextApiRequest, NextApiResponse } from "next";
import { sendAdminAlert } from "@/lib/emailNotify";

const SLACK_WEBHOOK_URL =
  "https://hooks.slack.com/triggers/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";

const FEEDBACK_RECIPIENT = "admin@mynextgym.com.au";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { gymId, gymName, issueType, message } = req.body;
  if (!gymId || !issueType) return res.status(400).json({ error: "gymId and issueType are required" });

  const gymUrl = `https://www.mynextgym.com.au/gym/${gymId}`;
  const submittedAt = new Date().toISOString();

  // Send email
  const emailBody = [
    `Listing feedback received`,
    ``,
    `Gym: ${gymName || gymId}`,
    `ID: ${gymId}`,
    `URL: ${gymUrl}`,
    `Issue: ${issueType}`,
    message ? `Details: ${message}` : "",
    ``,
    `Submitted: ${submittedAt}`,
    `Admin: https://www.mynextgym.com.au/admin?gym=${gymId}`,
  ]
    .filter(Boolean)
    .join("\n");

  const emailPromise = sendAdminAlert(`Listing feedback: ${issueType}`, emailBody, FEEDBACK_RECIPIENT);

  // Send Slack webhook
  const slackPayload = {
    gym_name: gymName || gymId,
    gym_id: gymId,
    gym_url: gymUrl,
    issue_type: issueType,
    message: message || "(no details provided)",
    submitted_at: submittedAt,
  };

  const slackPromise = fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(slackPayload),
  }).catch((err) => console.error("[feedback] Slack webhook error:", err));

  await Promise.allSettled([emailPromise, slackPromise]);

  res.status(200).json({ ok: true });
}
