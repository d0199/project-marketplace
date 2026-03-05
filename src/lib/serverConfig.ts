/**
 * Server-side config.
 * Sensitive keys (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) are fetched from
 * SSM via loadStripeSecrets() — call that before reading them.
 * Price IDs are non-sensitive and read directly from process.env (Amplify
 * Console → Hosting → Environment variables).
 */
import { getSecret } from "./amplifySecrets";

export const serverConfig = {
  get STRIPE_SECRET_KEY()             { return getSecret("STRIPE_SECRET_KEY"); },
  get STRIPE_WEBHOOK_SECRET()         { return getSecret("STRIPE_WEBHOOK_SECRET"); },
  get STRIPE_PRICE_PAID_MONTHLY()     { return process.env.STRIPE_PRICE_PAID_MONTHLY     ?? ""; },
  get STRIPE_PRICE_PAID_ANNUAL()      { return process.env.STRIPE_PRICE_PAID_ANNUAL      ?? ""; },
  get STRIPE_PRICE_FEATURED_MONTHLY() { return process.env.STRIPE_PRICE_FEATURED_MONTHLY ?? ""; },
  get STRIPE_PRICE_FEATURED_ANNUAL()  { return process.env.STRIPE_PRICE_FEATURED_ANNUAL  ?? ""; },
};
