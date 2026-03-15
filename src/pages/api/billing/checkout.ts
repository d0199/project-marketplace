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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // TEMP DEBUG — remove after confirming staging uses test keys
  if (req.query.debug === "stripe") {
    const { loadStripeSecrets, getSecret, getDebugInfo } = await import("@/lib/amplifySecrets");
    await loadStripeSecrets(req.headers.host);
    const sk = getSecret("STRIPE_SECRET_KEY");
    const debug = getDebugInfo();
    return res.status(200).json({
      host: req.headers.host ?? "(not set)",
      isProduction: !req.headers.host || req.headers.host.includes("www.mynextgym.com.au"),
      branchPrefix: debug?.branchPrefix ?? null,
      keyPrefix: sk.slice(0, 8),
      webhookPrefix: getSecret("STRIPE_WEBHOOK_SECRET").slice(0, 8),
      ssmFound: debug?.ssmFound ?? [],
      ssmMissing: debug?.ssmMissing ?? [],
    });
  }

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

  if (isPT) {
    // PT checkout flow
    const pt = await ptStore.getById(gymId);
    if (!pt || pt.ownerId !== ownerId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (pt.stripeSubscriptionId) {
      return res.status(200).json({ redirect: "portal" });
    }

    const stripe = await getStripe(req.headers.host);
    const existing = await stripe.customers.list({ email, limit: 1 });
    const customer = existing.data.length > 0
      ? existing.data[0]
      : await stripe.customers.create({ email });

    const ptPrices = getPTPriceMap();
    const priceId = ptPrices[plan]?.[interval];
    if (!priceId) {
      console.error("[billing/checkout] PT price missing:", { plan, interval, ptPrices });
      return res.status(400).json({ error: "Invalid plan or interval" });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.mynextgym.com.au";

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

  if (gym.stripeSubscriptionId) {
    return res.status(200).json({ redirect: "portal" });
  }

  const stripe = await getStripe(req.headers.host);

  const existing = await stripe.customers.list({ email, limit: 1 });
  const customer = existing.data.length > 0
    ? existing.data[0]
    : await stripe.customers.create({ email });

  const priceId = getGymPriceMap()[plan]?.[interval];
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

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[billing/checkout]", msg);
    return res.status(500).json({ error: msg });
  }
}
