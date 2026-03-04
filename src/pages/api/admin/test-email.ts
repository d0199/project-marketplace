/**
 * Diagnostic endpoint — POST /api/admin/test-email
 * Returns full result in response body so CloudWatch is not needed.
 * Delete once email is confirmed working.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const recipient = process.env.ADMIN_ALERT_EMAIL;
  const region = "ap-southeast-2";
  const sender = "noreply@mynextgym.com.au";

  const diag: Record<string, unknown> = {
    recipientEnvSet: !!recipient,
    region,
    sender,
    nodeEnv: process.env.NODE_ENV,
    sesResult: null,
    sesError: null,
  };

  if (!recipient) {
    return res.status(200).json({ ...diag, verdict: "ADMIN_ALERT_EMAIL not set — email skipped" });
  }

  try {
    const client = new SESClient({ region });
    await client.send(
      new SendEmailCommand({
        Source: sender,
        Destination: { ToAddresses: [recipient] },
        Message: {
          Subject: { Data: "[mynextgym] Test alert", Charset: "UTF-8" },
          Body: { Text: { Data: "This is a test email from the mynextgym diagnostic endpoint.", Charset: "UTF-8" } },
        },
      })
    );
    diag.sesResult = "sent";
    diag.verdict = "SUCCESS — check inbox";
  } catch (err) {
    diag.sesError = String(err);
    diag.verdict = "SES call failed — see sesError";
  }

  return res.status(200).json(diag);
}
