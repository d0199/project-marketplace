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

export async function sendAdminAlert(subject: string, body: string, recipientOverride?: string): Promise<void> {
  // Env var preferred; falls back to hardcoded since Amplify Gen 2 SSR Lambda
  // does not receive Console env vars at runtime.
  const recipient = recipientOverride ?? process.env.ADMIN_ALERT_EMAIL ?? "davidlewis1909@gmail.com";

  console.log("[emailNotify] called — recipient resolved:", !!recipient);

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

/** Send a branded HTML email via SES. Plain-text fallback is optional. */
export async function sendBrandedEmail(
  recipient: string,
  subject: string,
  html: string,
  textFallback?: string
): Promise<void> {
  console.log("[emailNotify] branded email — to:", recipient, "subject:", subject);

  try {
    const client = new SESClient({ region: REGION });
    await client.send(
      new SendEmailCommand({
        Source: SENDER,
        Destination: { ToAddresses: [recipient] },
        Message: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            ...(textFallback ? { Text: { Data: textFallback, Charset: "UTF-8" } } : {}),
          },
        },
      })
    );
    console.log("[emailNotify] branded email sent ok — subject:", subject);
  } catch (err) {
    console.error("[emailNotify] SES error:", err);
  }
}
