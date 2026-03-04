/**
 * Server-side only — never imported by client-side code.
 * Sends admin alert emails via AWS SES using the Amplify compute role credentials.
 *
 * Required env vars (set in Amplify Console → Environment variables):
 *   ADMIN_ALERT_EMAIL  — recipient address (never exposed to the client)
 *
 * Required IAM permission on amplify-ssr-compute-role:
 *   ses:SendEmail  on arn:aws:ses:<region>:<account>:identity/mynextgym.com.au
 *
 * The sender (noreply@mynextgym.com.au) must be verified in AWS SES.
 */
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const SENDER = "noreply@mynextgym.com.au";

export async function sendAdminAlert(subject: string, body: string): Promise<void> {
  const recipient = process.env.ADMIN_ALERT_EMAIL;
  if (!recipient) return; // env var not set — silently skip

  // Read region at call time so we always get the live value, not a build-time snapshot
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const outputs = require("../../amplify_outputs.json");
  const region: string = outputs.auth?.aws_region ?? "ap-southeast-2";

  try {
    const client = new SESClient({ region });
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
  } catch (err) {
    // Log but never fail the parent request because of a notification error
    console.error("[emailNotify] failed to send alert:", err);
  }
}
