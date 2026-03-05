import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { ownerStore } from "@/lib/ownerStore";

const PRICE_MAP: Record<string, Record<string, string>> = {
  paid: {
    month: process.env.STRIPE_PRICE_PAID_MONTHLY!,
    year: process.env.STRIPE_PRICE_PAID_ANNUAL!,
  },
  featured: {
    month: process.env.STRIPE_PRICE_FEATURED_MONTHLY!,
    year: process.env.STRIPE_PRICE_FEATURED_ANNUAL!,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { gymId, ownerId, email, plan, interval } = req.body as {
    gymId: string;
    ownerId: string;
    email: string;
    plan: "paid" | "featured";
    interval: "month" | "year";
  };

  if (!gymId || !ownerId || !email || !plan || !interval) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const gym = await ownerStore.getById(gymId);
  if (!gym || gym.ownerId !== ownerId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Featured slot check (max 3 per postcode)
  if (plan === "featured") {
    const all = await ownerStore.getAll();
    const featuredCount = all.filter(
      (g) => g.isFeatured && g.address.postcode === gym.address.postcode && g.id !== gymId
    ).length;
    if (featuredCount >= 3) {
      return res.status(409).json({ error: "Featured slots full for this postcode" });
    }
  }

  // If gym already has an active subscription, redirect to portal
  if (gym.stripeSubscriptionId) {
    return res.status(200).json({ redirect: "portal" });
  }

  // Find or create Stripe Customer
  const existing = await stripe.customers.list({ email, limit: 1 });
  const customer = existing.data.length > 0
    ? existing.data[0]
    : await stripe.customers.create({ email });

  const priceId = PRICE_MAP[plan]?.[interval];
  if (!priceId) {
    return res.status(400).json({ error: "Invalid plan or interval" });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.mynextgym.com.au";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { gymId, plan },
    success_url: `${baseUrl}/owner/${gymId}?billing=success`,
    cancel_url: `${baseUrl}/owner/${gymId}`,
  });

  return res.status(200).json({ url: session.url });
}
