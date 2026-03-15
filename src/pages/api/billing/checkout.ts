import type { NextApiRequest, NextApiResponse } from "next";
import { getStripe } from "@/lib/stripe";
import { serverConfig } from "@/lib/serverConfig";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";
import { requireUser } from "@/lib/userAuth";

function getGymPriceMap() {
  return {
    paid: {
      month: serverConfig.STRIPE_PRICE_PAID_MONTHLY,
      year: serverConfig.STRIPE_PRICE_PAID_ANNUAL,
    },
    featured: {
      month: serverConfig.STRIPE_PRICE_FEATURED_MONTHLY,
      year: serverConfig.STRIPE_PRICE_FEATURED_ANNUAL,
    },
  };
}

function getPTPriceMap() {
  return {
    paid: {
      month: serverConfig.STRIPE_PRICE_PAID_MONTHLY_PT,
      year: serverConfig.STRIPE_PRICE_PAID_ANNUAL_PT,
    },
    featured: {
      month: serverConfig.STRIPE_PRICE_FEATURED_MONTHLY_PT,
      year: serverConfig.STRIPE_PRICE_FEATURED_ANNUAL_PT,
    },
  };
}

/** Open the Stripe billing portal directly on the "update subscription" screen */
async function portalPlanChange(
  stripe: import("stripe").default,
  email: string,
  subscriptionId: string,
  priceId: string,
  returnUrl: string,
  res: NextApiResponse
) {
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data.length === 0) {
    return res.status(404).json({ error: "No billing account found" });
  }

  // Get the current subscription item ID for the plan swap
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = sub.items.data[0]?.id;
  if (!itemId) {
    return res.status(400).json({ error: "No subscription item found" });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: existing.data[0].id,
    return_url: returnUrl,
    flow_data: {
      type: "subscription_update_confirm",
      subscription_update_confirm: {
        subscription: subscriptionId,
        items: [{ id: itemId, price: priceId, quantity: 1 }],
      },
    },
  });

  return res.status(200).json({ url: session.url });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  try {

  const user = await requireUser(req, res);
  if (!user) return; // 401 already sent

  const { gymId, plan, interval, entityType } = req.body as {
    gymId: string;
    plan: "paid" | "featured";
    interval: "month" | "year";
    entityType?: "gym" | "pt";
  };

  const ownerId = user.ownerId;
  const email = user.email;

  if (!gymId || !plan || !interval) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const isPT = entityType === "pt";

  const stripe = await getStripe(req.headers.host);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.mynextgym.com.au";

  if (isPT) {
    // PT checkout flow
    const pt = await ptStore.getById(gymId);
    if (!pt || pt.ownerId !== ownerId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const ptPrices = getPTPriceMap();
    const priceId = ptPrices[plan]?.[interval];
    if (!priceId) {
      console.error("[billing/checkout] PT price missing:", { plan, interval, ptPrices });
      return res.status(400).json({ error: "Invalid plan or interval" });
    }

    // Existing subscription → open portal pre-set to plan change
    if (pt.stripeSubscriptionId) {
      return await portalPlanChange(stripe, email, pt.stripeSubscriptionId, priceId, `${baseUrl}/billing`, res);
    }

    const existing = await stripe.customers.list({ email, limit: 1 });
    const customer = existing.data.length > 0
      ? existing.data[0]
      : await stripe.customers.create({ email });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { gymId, plan, entityType: "pt" },
      success_url: `${baseUrl}/billing?billing=success`,
      cancel_url: `${baseUrl}/billing`,
    });

    return res.status(200).json({ url: session.url });
  }

  // Gym checkout flow
  const gym = await ownerStore.getById(gymId);
  if (!gym || gym.ownerId !== ownerId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Featured slot check (max 3 per postcode)
  // Note: small race window exists — two concurrent checkouts for the same postcode
  // could both pass this check. Would need DynamoDB transactions to fully prevent.
  if (plan === "featured") {
    const all = await ownerStore.getAll();
    const featuredCount = all.filter(
      (g) => g.isFeatured && g.address.postcode === gym.address.postcode && g.id !== gymId
    ).length;
    if (featuredCount >= 3) {
      return res.status(409).json({ error: "Featured slots full for this postcode" });
    }
  }

  const gymPriceId = getGymPriceMap()[plan]?.[interval];
  if (!gymPriceId) {
    return res.status(400).json({ error: "Invalid plan or interval" });
  }

  // Existing subscription → open portal pre-set to plan change
  if (gym.stripeSubscriptionId) {
    return await portalPlanChange(stripe, email, gym.stripeSubscriptionId, gymPriceId, `${baseUrl}/billing`, res);
  }

  const existing = await stripe.customers.list({ email, limit: 1 });
  const customer = existing.data.length > 0
    ? existing.data[0]
    : await stripe.customers.create({ email });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer.id,
    line_items: [{ price: gymPriceId, quantity: 1 }],
    metadata: { gymId, plan },
    success_url: `${baseUrl}/owner/${gymId}?billing=success`,
    cancel_url: `${baseUrl}/owner/${gymId}`,
  });

  return res.status(200).json({ url: session.url });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[billing/checkout]", msg);
    return res.status(500).json({ error: msg });
  }
}
