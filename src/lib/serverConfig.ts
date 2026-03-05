/**
 * Server-side config — reads from amplifySecrets cache (SSM) after
 * loadStripeSecrets() has been awaited in the API route handler.
 */
import { getSecret } from "./amplifySecrets";

export const serverConfig = {
  get STRIPE_SECRET_KEY()             { return getSecret("STRIPE_SECRET_KEY"); },
  get STRIPE_WEBHOOK_SECRET()         { return getSecret("STRIPE_WEBHOOK_SECRET"); },
  get STRIPE_PRICE_PAID_MONTHLY()     { return getSecret("STRIPE_PRICE_PAID_MONTHLY"); },
  get STRIPE_PRICE_PAID_ANNUAL()      { return getSecret("STRIPE_PRICE_PAID_ANNUAL"); },
  get STRIPE_PRICE_FEATURED_MONTHLY() { return getSecret("STRIPE_PRICE_FEATURED_MONTHLY"); },
  get STRIPE_PRICE_FEATURED_ANNUAL()  { return getSecret("STRIPE_PRICE_FEATURED_ANNUAL"); },
};
