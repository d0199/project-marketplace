import Stripe from "stripe";
import { serverConfig } from "./serverConfig";

export const stripe = new Stripe(serverConfig.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});
