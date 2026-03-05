import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, returnUrl } = req.body as { email: string; returnUrl: string };

  if (!email || !returnUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length === 0) {
    return res.status(404).json({ error: "No billing account found" });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: existing.data[0].id,
    return_url: returnUrl,
  });

  return res.status(200).json({ url: session.url });
}
