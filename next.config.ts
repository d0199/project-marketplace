import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Amplify Hosting Secrets are in process.env at BUILD time but are NOT
  // injected into the Lambda runtime environment. Baking them into
  // serverRuntimeConfig at build time makes them available at runtime via
  // getConfig() in serverConfig.ts.
  serverRuntimeConfig: {
    STRIPE_SECRET_KEY:             process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET:         process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PAID_MONTHLY:     process.env.STRIPE_PRICE_PAID_MONTHLY,
    STRIPE_PRICE_PAID_ANNUAL:      process.env.STRIPE_PRICE_PAID_ANNUAL,
    STRIPE_PRICE_FEATURED_MONTHLY: process.env.STRIPE_PRICE_FEATURED_MONTHLY,
    STRIPE_PRICE_FEATURED_ANNUAL:  process.env.STRIPE_PRICE_FEATURED_ANNUAL,
  },
};

export default nextConfig;
