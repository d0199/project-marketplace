import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { ownerStore } from "@/lib/ownerStore";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const SENDER = "noreply@mynextgym.com.au";
const REGION = "ap-southeast-2";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const gymId = req.query.gymId as string;
  const { name, email, phone, message } = req.body ?? {};

  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }

  const gym = await ownerStore.getById(gymId);
  if (!gym) return res.status(404).json({ error: "Gym not found" });

  // Store lead in DynamoDB if backend is available
  if (isAmplifyConfigured()) {
    await dataClient.models.Lead.create({
      gymId,
      gymName: gym.name,
      name,
      email,
      phone: phone || undefined,
      message: message || undefined,
      status: "new",
    });
  }

  // Send email to gym if they have one
  if (gym.email) {
    try {
      const client = new SESClient({ region: REGION });
      const body = [
        `New enquiry from ${name} via mynextgym.com.au`,
        "",
        `Gym: ${gym.name}`,
        `Enquirer: ${name}`,
        `Email: ${email}`,
        phone ? `Phone: ${phone}` : null,
        message ? `\nMessage:\n${message}` : null,
        "",
        "---",
        "This enquiry was submitted via mynextgym.com.au",
      ]
        .filter((l) => l !== null)
        .join("\n");

      await client.send(
        new SendEmailCommand({
          Source: SENDER,
          Destination: { ToAddresses: [gym.email] },
          Message: {
            Subject: { Data: `Enquiry from ${name} — mynextgym.com.au`, Charset: "UTF-8" },
            Body: { Text: { Data: body, Charset: "UTF-8" } },
          },
        })
      );
    } catch (err) {
      // Log but don't fail the request — lead is already stored
      console.error("[contact] SES error:", err);
    }
  }

  return res.status(200).json({ ok: true });
}
