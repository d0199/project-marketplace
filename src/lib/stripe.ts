import Stripe from "stripe";
import { serverConfig } from "./serverConfig";

// Lazy singleton — created on first request so getConfig() is guaranteed
// to be available (module-level init runs before Next.js serverRuntimeConfig
// is populated on Amplify SSR Lambda cold starts).
let _stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = serverConfig.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe;
}
