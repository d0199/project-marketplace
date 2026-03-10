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
  get STRIPE_PRICE_PAID_MONTHLY()     { return getSecret("STRIPE_PRICE_PAID_MONTHLY");     },
  get STRIPE_PRICE_PAID_ANNUAL()      { return getSecret("STRIPE_PRICE_PAID_ANNUAL");      },
  get STRIPE_PRICE_FEATURED_MONTHLY() { return getSecret("STRIPE_PRICE_FEATURED_MONTHLY"); },
  get STRIPE_PRICE_FEATURED_ANNUAL()  { return getSecret("STRIPE_PRICE_FEATURED_ANNUAL");  },
  // PT-specific price IDs
  get STRIPE_PRICE_PAID_MONTHLY_PT()     { return getSecret("STRIPE_PRICE_PAID_MONTHLY_PT");     },
  get STRIPE_PRICE_PAID_ANNUAL_PT()      { return getSecret("STRIPE_PRICE_PAID_ANNUAL_PT");      },
  get STRIPE_PRICE_FEATURED_MONTHLY_PT() { return getSecret("STRIPE_PRICE_FEATURED_MONTHLY_PT"); },
  get STRIPE_PRICE_FEATURED_ANNUAL_PT()  { return getSecret("STRIPE_PRICE_FEATURED_ANNUAL_PT");  },
};
