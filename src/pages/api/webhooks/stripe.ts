import type { NextApiRequest, NextApiResponse } from "next";
import { getStripe } from "@/lib/stripe";
import { loadStripeSecrets } from "@/lib/amplifySecrets";
import { serverConfig } from "@/lib/serverConfig";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";
import type Stripe from "stripe";
import { logSubscriptionEvent } from "@/lib/subscriptionLog";

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
  const entries: [string, "paid" | "featured"][] = [
    // Gym prices
    [serverConfig.STRIPE_PRICE_PAID_MONTHLY, "paid"],
    [serverConfig.STRIPE_PRICE_PAID_ANNUAL, "paid"],
    [serverConfig.STRIPE_PRICE_FEATURED_MONTHLY, "featured"],
    [serverConfig.STRIPE_PRICE_FEATURED_ANNUAL, "featured"],
    // PT prices
    [serverConfig.STRIPE_PRICE_PAID_MONTHLY_PT, "paid"],
    [serverConfig.STRIPE_PRICE_PAID_ANNUAL_PT, "paid"],
    [serverConfig.STRIPE_PRICE_FEATURED_MONTHLY_PT, "featured"],
    [serverConfig.STRIPE_PRICE_FEATURED_ANNUAL_PT, "featured"],
  ];
  // Filter out empty keys so a missing SSM value doesn't cause false matches
  return Object.fromEntries(entries.filter(([key]) => key));
}

/** Update billing flags on the correct entity (gym or PT) */
async function updateEntityBilling(
  entityId: string,
  entityType: string | undefined,
  billing: {
    isPaid: boolean;
    isFeatured: boolean;
    stripeSubscriptionId?: string | null;
    stripePlan?: string | null;
  }
) {
  if (entityType === "pt") {
    const pt = await ptStore.getById(entityId);
    if (!pt) return;
    await ptStore.update({
      ...pt,
      isPaid: billing.isPaid,
      isFeatured: billing.isFeatured,
      ...(billing.stripeSubscriptionId !== undefined && { stripeSubscriptionId: billing.stripeSubscriptionId ?? undefined }),
      ...(billing.stripePlan !== undefined && { stripePlan: billing.stripePlan as "paid" | "featured" | undefined }),
    });
  } else {
    await ownerStore.updateBilling(entityId, billing);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  await loadStripeSecrets();

  const sig = req.headers["stripe-signature"] as string;
  const rawBody = await getRawBody(req);

  let event: Stripe.Event;
  try {
    const stripe = await getStripe();
    event = stripe.webhooks.constructEvent(rawBody, sig, serverConfig.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: "Invalid signature" });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { gymId, plan, entityType } = session.metadata ?? {};
      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id ?? null;
      if (!gymId || !plan || !subscriptionId) break;

      await updateEntityBilling(gymId, entityType, {
        isPaid: true,
        isFeatured: plan === "featured",
        stripeSubscriptionId: subscriptionId,
        stripePlan: plan as "paid" | "featured",
      });
      logSubscriptionEvent({
        entityId: gymId,
        entityType: (entityType as "gym" | "pt") ?? "gym",
        eventType: "subscription_created",
        source: "stripe",
        after: { isPaid: true, isFeatured: plan === "featured", stripePlan: plan as string, stripeSubscriptionId: subscriptionId },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const sessions = await (await getStripe()).checkout.sessions.list({
        subscription: sub.id,
        limit: 1,
      });
      const meta = sessions.data[0]?.metadata;
      const gymId = meta?.gymId;
      if (!gymId) break;

      await updateEntityBilling(gymId, meta?.entityType, {
        isPaid: false,
        isFeatured: false,
        stripeSubscriptionId: null,
        stripePlan: null,
      });
      logSubscriptionEvent({
        entityId: gymId,
        entityType: (meta?.entityType as "gym" | "pt") ?? "gym",
        eventType: "subscription_cancelled",
        source: "stripe",
        before: { isPaid: true, stripeSubscriptionId: sub.id },
        after: { isPaid: false, isFeatured: false },
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.cancel_at_period_end) break;

      const sessions = await (await getStripe()).checkout.sessions.list({ subscription: sub.id, limit: 1 });
      const meta = sessions.data[0]?.metadata;
      const gymId = meta?.gymId;
      if (!gymId) break;

      const priceId = sub.items.data[0]?.price.id ?? "";
      const newPlan = getPriceToPlan()[priceId];
      if (!newPlan) break;

      await updateEntityBilling(gymId, meta?.entityType, {
        isPaid: true,
        isFeatured: newPlan === "featured",
        stripePlan: newPlan,
      });
      logSubscriptionEvent({
        entityId: gymId,
        entityType: (meta?.entityType as "gym" | "pt") ?? "gym",
        eventType: "plan_changed",
        source: "stripe",
        after: { isPaid: true, isFeatured: newPlan === "featured", stripePlan: newPlan },
      });
      break;
    }
  }

  return res.status(200).json({ received: true });
}
