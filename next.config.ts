import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Explicitly expose server-side env vars to the SSR Lambda runtime.
  // These are read from the build environment (Amplify Console env vars)
  // and baked into the server bundle — they are NOT exposed to the browser.
  serverRuntimeConfig: {
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PAID_MONTHLY: process.env.STRIPE_PRICE_PAID_MONTHLY,
    STRIPE_PRICE_PAID_ANNUAL: process.env.STRIPE_PRICE_PAID_ANNUAL,
    STRIPE_PRICE_FEATURED_MONTHLY: process.env.STRIPE_PRICE_FEATURED_MONTHLY,
    STRIPE_PRICE_FEATURED_ANNUAL: process.env.STRIPE_PRICE_FEATURED_ANNUAL,
  },
};

export default nextConfig;
