import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.json({
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    keyPrefix: process.env.STRIPE_SECRET_KEY?.slice(0, 8) ?? "missing",
    hasPaidMonthly: !!process.env.STRIPE_PRICE_PAID_MONTHLY,
    paidMonthlyPrefix: process.env.STRIPE_PRICE_PAID_MONTHLY?.slice(0, 8) ?? "missing",
    hasPaidAnnual: !!process.env.STRIPE_PRICE_PAID_ANNUAL,
    hasFeaturedMonthly: !!process.env.STRIPE_PRICE_FEATURED_MONTHLY,
    hasFeaturedAnnual: !!process.env.STRIPE_PRICE_FEATURED_ANNUAL,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
  });
}
