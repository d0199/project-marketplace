import Stripe from "stripe";
import { loadStripeSecrets } from "./amplifySecrets";
import { serverConfig } from "./serverConfig";

let _stripe: Stripe | undefined;

export async function getStripe(host?: string): Promise<Stripe> {
  if (!_stripe) {
    await loadStripeSecrets(host);
    const key = serverConfig.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { apiVersion: "2026-02-25.clover" });
  }
  return _stripe;
}
