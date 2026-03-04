/**
 * Admin-only test endpoint — POST /api/admin/test-email
 * Sends a test alert to ADMIN_ALERT_EMAIL so you can verify SES is working
 * without needing to submit a real claim or moderation request.
 * Delete this file once email is confirmed working.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { sendAdminAlert } from "@/lib/emailNotify";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const recipient = process.env.ADMIN_ALERT_EMAIL;

  console.log("[test-email] ADMIN_ALERT_EMAIL set:", !!recipient);
  console.log("[test-email] NODE_ENV:", process.env.NODE_ENV);

  await sendAdminAlert(
    "Test alert",
    "This is a test email from mynextgym.com.au to confirm SES is working correctly."
  );

  return res.status(200).json({
    ok: true,
    recipientConfigured: !!recipient,
  });
}
