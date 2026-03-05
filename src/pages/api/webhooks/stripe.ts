import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { serverConfig } from "@/lib/serverConfig";
import { ownerStore } from "@/lib/ownerStore";
import type Stripe from "stripe";

export const config = { api: { bodyParser: false } };

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function getPriceToPlan(): Record<string, "paid" | "featured"> {
  return {
    [serverConfig.STRIPE_PRICE_PAID_MONTHLY]: "paid",
    [serverConfig.STRIPE_PRICE_PAID_ANNUAL]: "paid",
    [serverConfig.STRIPE_PRICE_FEATURED_MONTHLY]: "featured",
    [serverConfig.STRIPE_PRICE_FEATURED_ANNUAL]: "featured",
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"] as string;
  const rawBody = await getRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, serverConfig.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: "Invalid signature" });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { gymId, plan } = session.metadata ?? {};
      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id ?? null;
      if (!gymId || !plan || !subscriptionId) break;

      const gym = await ownerStore.getById(gymId);
      if (!gym) break;

      await ownerStore.updateBilling(gymId, {
        isPaid: true,
        isFeatured: plan === "featured",
      });
      break;
    }

    case "customer.subscription.deleted": {
      // Find gym by looking up the customer's metadata via Stripe
      const sub = event.data.object as Stripe.Subscription;
      const sessions = await stripe.checkout.sessions.list({
        subscription: sub.id,
        limit: 1,
      });
      const gymId = sessions.data[0]?.metadata?.gymId;
      if (!gymId) break;

      await ownerStore.updateBilling(gymId, { isPaid: false, isFeatured: false });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      // If cancelling at period end, keep flags active until subscription actually deletes
      if (sub.cancel_at_period_end) break;

      const sessions = await stripe.checkout.sessions.list({ subscription: sub.id, limit: 1 });
      const gymId = sessions.data[0]?.metadata?.gymId;
      if (!gymId) break;

      const priceId = sub.items.data[0]?.price.id ?? "";
      const newPlan = getPriceToPlan()[priceId];
      if (!newPlan) break;

      await ownerStore.updateBilling(gymId, {
        isPaid: true,
        isFeatured: newPlan === "featured",
      });
      break;
    }
  }

  return res.status(200).json({ received: true });
}
