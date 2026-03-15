import type { NextApiRequest, NextApiResponse } from "next";
import { getStripe } from "@/lib/stripe";
import { requireUser } from "@/lib/userAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await requireUser(req, res);
  if (!user) return; // 401 already sent

  const { returnUrl } = req.body as { returnUrl: string };
  if (!returnUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const stripe = await getStripe();
  const existing = await stripe.customers.list({ email: user.email, limit: 1 });
  if (existing.data.length === 0) {
    return res.status(404).json({ error: "No billing account found" });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: existing.data[0].id,
    return_url: returnUrl,
  });

  return res.status(200).json({ url: session.url });
}
