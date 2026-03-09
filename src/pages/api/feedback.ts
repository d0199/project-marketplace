import type { NextApiRequest, NextApiResponse } from "next";
import { sendAdminAlert } from "@/lib/emailNotify";
import { sendSlackNotification } from "@/lib/slackNotify";

const FEEDBACK_RECIPIENT = "admin@mynextgym.com.au";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { gymId, gymName, issueType, message } = req.body;
  if (!gymId || !issueType) return res.status(400).json({ error: "gymId and issueType are required" });

  const gymUrl = `https://www.mynextgym.com.au/gym/${gymId}`;
  const submittedAt = new Date().toISOString();

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

  await Promise.allSettled([
    sendAdminAlert(`Listing feedback: ${issueType}`, emailBody, FEEDBACK_RECIPIENT),
    sendSlackNotification("feedback", {
      gym_name: gymName || gymId,
      gym_id: gymId,
      gym_url: gymUrl,
      issue_type: issueType,
      message: message || "(no details provided)",
      submitted_at: submittedAt,
    }),
  ]);

  res.status(200).json({ ok: true });
}
