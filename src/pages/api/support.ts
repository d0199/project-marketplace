import type { NextApiRequest, NextApiResponse } from "next";
import { sendAdminAlert } from "@/lib/emailNotify";
import { sendSlackNotification, nowAWST } from "@/lib/slackNotify";
import { sendSupportConfirmationEmail } from "@/lib/customerEmail";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";

const SUPPORT_RECIPIENT = "admin@mynextgym.com.au";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, message, category, userEmail, entityType, entityId, entityName } = req.body;
  console.log("[support] incoming request body:", JSON.stringify({
    name, email, message: message?.slice?.(0, 200), category, userEmail, entityType, entityId, entityName,
    ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"]?.slice(0, 150),
  }));
  if (!name || !email || !message) {
    return res.status(400).json({ error: "name, email, and message are required" });
  }

  const submittedAt = nowAWST();
  const customerLoggedIn = userEmail ? `Yes (${userEmail})` : "No";
  const entityLabel = entityType && entityId
    ? `${entityType === "pt" ? "PT" : "Gym"} — ${entityName || entityId}`
    : "N/A";
  const entityIdLabel = entityId || "N/A";

  // Email body
  const emailBody = [
    `Support request received`,
    ``,
    `Name: ${name}`,
    `Email: ${email}`,
    `Category: ${category || "General"}`,
    `Customer Logged In: ${customerLoggedIn}`,
    entityType ? `${entityType === "pt" ? "PT" : "Gym"} ID: ${entityIdLabel}` : "",
    entityType ? `${entityType === "pt" ? "PT" : "Gym"} Name: ${entityName || "N/A"}` : "",
    ``,
    `Message:`,
    message,
    ``,
    `Submitted: ${submittedAt}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Store in DynamoDB
  const storePromise = (async () => {
    if (!isAmplifyConfigured() || !dataClient.models.SupportRequest) return;
    try {
      await dataClient.models.SupportRequest.create({
        name,
        email,
        message,
        category: category || "general",
        userEmail: userEmail || "",
        entityType: entityType || "",
        entityId: entityId || "",
        entityName: entityName || "",
        submittedAt,
        status: "new",
      });
    } catch (err) {
      console.error("[support] DynamoDB store error:", err);
    }
  })();

  await Promise.allSettled([
    sendSupportConfirmationEmail(email, name),
    sendAdminAlert(`Support: ${category || "General"} from ${name}`, emailBody, SUPPORT_RECIPIENT),
    sendSlackNotification("support", {
      customer_logged_in: customerLoggedIn,
      gym_pt_id: entityIdLabel,
      gym_pt_name: entityLabel,
      submitted_at: submittedAt,
      message,
    }),
    storePromise,
  ]);

  res.status(200).json({ ok: true });
}
