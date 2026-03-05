/**
 * Server-side config for Amplify SSR.
 *
 * Stripe keys must be set as Amplify Console Environment Variables
 * (Hosting → Environment variables), NOT as Gen 2 CLI secrets (`npx ampx
 * secret set`). Gen 2 secrets are SSM-based and only accessible via secret()
 * in backend.ts — they are never in process.env at build or Lambda runtime.
 *
 * Console env vars are in process.env at BUILD time → baked into
 * serverRuntimeConfig → accessible via getConfig() at Lambda runtime.
 * They are also in process.env at Lambda runtime directly.
 */
import getConfig from "next/config";

function cfg(key: string): string {
  return process.env[key] ?? getConfig()?.serverRuntimeConfig?.[key] ?? "";
}

export const serverConfig = {
  get STRIPE_SECRET_KEY()             { return cfg("STRIPE_SECRET_KEY"); },
  get STRIPE_WEBHOOK_SECRET()         { return cfg("STRIPE_WEBHOOK_SECRET"); },
  get STRIPE_PRICE_PAID_MONTHLY()     { return cfg("STRIPE_PRICE_PAID_MONTHLY"); },
  get STRIPE_PRICE_PAID_ANNUAL()      { return cfg("STRIPE_PRICE_PAID_ANNUAL"); },
  get STRIPE_PRICE_FEATURED_MONTHLY() { return cfg("STRIPE_PRICE_FEATURED_MONTHLY"); },
  get STRIPE_PRICE_FEATURED_ANNUAL()  { return cfg("STRIPE_PRICE_FEATURED_ANNUAL"); },
};
