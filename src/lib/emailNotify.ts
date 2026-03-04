/**
 * Server-side only — never imported by client-side code.
 * Sends admin alert emails via AWS SES using the Amplify compute role credentials.
 *
 * Required env vars (Amplify Console → Environment variables):
 *   ADMIN_ALERT_EMAIL  — recipient address (never exposed to the client)
 *
 * Required IAM on amplify-ssr-compute-role:
 *   ses:SendEmail on arn:aws:ses:ap-southeast-2:603366204689:identity/mynextgym.com.au
 *
 * noreply@mynextgym.com.au must be verified in SES (domain identity covers it).
 */
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const SENDER = "noreply@mynextgym.com.au";
const REGION = "ap-southeast-2";

export async function sendAdminAlert(subject: string, body: string): Promise<void> {
  const recipient = process.env.ADMIN_ALERT_EMAIL;

  console.log("[emailNotify] called — recipient env var set:", !!recipient);

  if (!recipient) {
    console.warn("[emailNotify] ADMIN_ALERT_EMAIL not set — skipping");
    return;
  }

  try {
    const client = new SESClient({ region: REGION });
    await client.send(
      new SendEmailCommand({
        Source: SENDER,
        Destination: { ToAddresses: [recipient] },
        Message: {
          Subject: { Data: `[mynextgym] ${subject}`, Charset: "UTF-8" },
          Body: { Text: { Data: body, Charset: "UTF-8" } },
        },
      })
    );
    console.log("[emailNotify] sent ok — subject:", subject);
  } catch (err) {
    console.error("[emailNotify] SES error:", err);
  }
}
