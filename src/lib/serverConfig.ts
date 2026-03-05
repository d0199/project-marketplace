/**
 * Server-side config — reads from process.env at request time.
 *
 * Amplify Gen 2 Secrets (set via `npx ampx secret set`) are injected into
 * the SSR Lambda runtime's process.env via the compute role, but are NOT
 * available during the frontend build phase. Reading at request time (not at
 * module load / build time) ensures the values are always present.
 */
export const serverConfig = {
  get STRIPE_SECRET_KEY()         { return process.env.STRIPE_SECRET_KEY         ?? ""; },
  get STRIPE_WEBHOOK_SECRET()     { return process.env.STRIPE_WEBHOOK_SECRET     ?? ""; },
  get STRIPE_PRICE_PAID_MONTHLY() { return process.env.STRIPE_PRICE_PAID_MONTHLY ?? ""; },
  get STRIPE_PRICE_PAID_ANNUAL()  { return process.env.STRIPE_PRICE_PAID_ANNUAL  ?? ""; },
  get STRIPE_PRICE_FEATURED_MONTHLY() { return process.env.STRIPE_PRICE_FEATURED_MONTHLY ?? ""; },
  get STRIPE_PRICE_FEATURED_ANNUAL()  { return process.env.STRIPE_PRICE_FEATURED_ANNUAL  ?? ""; },
};
