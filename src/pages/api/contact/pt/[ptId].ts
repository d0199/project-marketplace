import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { ptStore } from "@/lib/ptStore";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const SENDER = "noreply@mynextgym.com.au";
const REGION = "ap-southeast-2";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const ptId = req.query.ptId as string;
  const { name, email, phone, message, customData } = req.body ?? {};

  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }

  const pt = await ptStore.getById(ptId);
  if (!pt) return res.status(404).json({ error: "PT not found" });

  // Store lead in DynamoDB — reuse Lead model, gymId stores ptId
  if (isAmplifyConfigured()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (dataClient.models.Lead.create as any)({
      gymId: ptId,
      gymName: pt.name,
      name,
      email,
      phone: phone || undefined,
      message: message || undefined,
      customData: customData ? JSON.stringify(customData) : undefined,
      entityType: "pt",
      status: "new",
    });
  }

  // Send email to PT if they have one
  if (pt.email) {
    try {
      const client = new SESClient({ region: REGION });

      // Build custom fields section for email
      let customSection = "";
      if (customData && typeof customData === "object") {
        const entries = Object.entries(customData as Record<string, string>).filter(([, v]) => v);
        if (entries.length > 0) {
          customSection = "\n\nAdditional Info:\n" +
            entries.map(([k, v]) => `${k}: ${v}`).join("\n");
        }
      }

      const body = [
        `New enquiry from ${name} via mynextgym.com.au`,
        "",
        `Personal Trainer: ${pt.name}`,
        `Enquirer: ${name}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : null,
        message ? `\nMessage:\n${message}` : null,
        customSection || null,
        "",
        "---",
        "This enquiry was submitted via mynextgym.com.au",
      ]
        .filter((l) => l !== null)
        .join("\n");

      await client.send(
        new SendEmailCommand({
          Source: SENDER,
          Destination: { ToAddresses: [pt.email] },
          Message: {
            Subject: { Data: `Enquiry from ${name} — mynextgym.com.au`, Charset: "UTF-8" },
            Body: { Text: { Data: body, Charset: "UTF-8" } },
          },
        })
      );
    } catch (err) {
      console.error("[contact/pt] SES error:", err);
    }
  }

  return res.status(200).json({ ok: true });
}
