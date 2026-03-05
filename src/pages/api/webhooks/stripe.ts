import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
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

const PRICE_TO_PLAN: Record<string, "paid" | "featured"> = {
  [process.env.STRIPE_PRICE_PAID_MONTHLY ?? ""]: "paid",
  [process.env.STRIPE_PRICE_PAID_ANNUAL ?? ""]: "paid",
  [process.env.STRIPE_PRICE_FEATURED_MONTHLY ?? ""]: "featured",
  [process.env.STRIPE_PRICE_FEATURED_ANNUAL ?? ""]: "featured",
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"] as string;
  const rawBody = await getRawBody(req);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return res.status(400).json({ error: "Invalid signature" });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { gymId, plan } = session.metadata ?? {};
      const subscriptionId = session.subscription as string;
      if (!gymId || !plan || !subscriptionId) break;

      const gym = await ownerStore.getById(gymId);
      if (!gym) break;

      await ownerStore.update({
        ...gym,
        isPaid: true,
        isFeatured: plan === "featured",
        stripeSubscriptionId: subscriptionId,
        stripePlan: plan as "paid" | "featured",
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const all = await ownerStore.getAll();
      const gym = all.find((g) => g.stripeSubscriptionId === sub.id);
      if (!gym) break;

      await ownerStore.update({
        ...gym,
        isPaid: false,
        isFeatured: false,
        stripeSubscriptionId: undefined,
        stripePlan: undefined,
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const all = await ownerStore.getAll();
      const gym = all.find((g) => g.stripeSubscriptionId === sub.id);
      if (!gym) break;

      const priceId = sub.items.data[0]?.price.id ?? "";
      const newPlan = PRICE_TO_PLAN[priceId];
      if (!newPlan) break;

      await ownerStore.update({
        ...gym,
        isPaid: true,
        isFeatured: newPlan === "featured",
        stripePlan: newPlan,
      });
      break;
    }
  }

  return res.status(200).json({ received: true });
}
