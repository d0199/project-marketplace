/**
 * Server-side config that works on Amplify SSR.
 *
 * Amplify Console env vars are available at build time (npm run build) but may
 * not be injected into the Lambda runtime environment. Reading from
 * next/config serverRuntimeConfig (populated in next.config.ts at build time)
 * ensures the values are always available server-side.
 */
import getConfig from "next/config";

function cfg(key: string): string {
  return process.env[key] ?? getConfig()?.serverRuntimeConfig?.[key] ?? "";
}

export const serverConfig = {
  get STRIPE_SECRET_KEY() { return cfg("STRIPE_SECRET_KEY"); },
  get STRIPE_WEBHOOK_SECRET() { return cfg("STRIPE_WEBHOOK_SECRET"); },
  get STRIPE_PRICE_PAID_MONTHLY() { return cfg("STRIPE_PRICE_PAID_MONTHLY"); },
  get STRIPE_PRICE_PAID_ANNUAL() { return cfg("STRIPE_PRICE_PAID_ANNUAL"); },
  get STRIPE_PRICE_FEATURED_MONTHLY() { return cfg("STRIPE_PRICE_FEATURED_MONTHLY"); },
  get STRIPE_PRICE_FEATURED_ANNUAL() { return cfg("STRIPE_PRICE_FEATURED_ANNUAL"); },
};
