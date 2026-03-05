import type { NextApiRequest, NextApiResponse } from "next";
import { serverConfig } from "@/lib/serverConfig";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.json({
    hasStripeKey: !!serverConfig.STRIPE_SECRET_KEY,
    keyPrefix: serverConfig.STRIPE_SECRET_KEY?.slice(0, 8) ?? "missing",
    hasPaidMonthly: !!serverConfig.STRIPE_PRICE_PAID_MONTHLY,
    paidMonthlyPrefix: serverConfig.STRIPE_PRICE_PAID_MONTHLY?.slice(0, 8) ?? "missing",
    hasPaidAnnual: !!serverConfig.STRIPE_PRICE_PAID_ANNUAL,
    hasFeaturedMonthly: !!serverConfig.STRIPE_PRICE_FEATURED_MONTHLY,
    hasFeaturedAnnual: !!serverConfig.STRIPE_PRICE_FEATURED_ANNUAL,
    hasWebhookSecret: !!serverConfig.STRIPE_WEBHOOK_SECRET,
  });
}
