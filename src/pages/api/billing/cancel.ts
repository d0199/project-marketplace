import type { NextApiRequest, NextApiResponse } from "next";
import { getStripe } from "@/lib/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { gymId, email } = req.body as { gymId: string; email: string };
  if (!gymId || !email) return res.status(400).json({ error: "Missing required fields" });

  const stripe = await getStripe();

  // Find Stripe customer
  const customers = await stripe.customers.list({ email, limit: 1 });
  if (!customers.data.length) return res.status(404).json({ error: "No billing account found" });
  const customerId = customers.data[0].id;

  // Find the checkout session for this gym to get the subscription ID
  const sessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 100 });
  const session = sessions.data.find((s) => s.metadata?.gymId === gymId && s.subscription);
  if (!session?.subscription) return res.status(404).json({ error: "No active subscription found for this gym" });

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription.id;

  // Cancel at period end — features remain active until the billing period ends
  const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = updated as any;
  const periodEndTs: number | undefined = raw.current_period_end ?? raw.cancel_at;
  const periodEnd = periodEndTs
    ? new Date(periodEndTs * 1000).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })
    : "the end of your billing period";

  return res.status(200).json({ ok: true, periodEnd });
}
