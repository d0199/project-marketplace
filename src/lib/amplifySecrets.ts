/**
 * Fetch Amplify Gen 2 secrets from SSM Parameter Store at Lambda runtime.
 *
 * Amplify stores secrets at: /amplify/shared/{appId}/{name}
 * The appId comes from AMPLIFY_APP_ID env var (set in Amplify Console →
 * Hosting → Environment variables).
 *
 * Results are cached for the lifetime of the Lambda instance.
 * IAM requirement: ssm:GetParameters on arn:aws:ssm:*:*:parameter/amplify/*
 */
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

const STRIPE_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PAID_MONTHLY",
  "STRIPE_PRICE_PAID_ANNUAL",
  "STRIPE_PRICE_FEATURED_MONTHLY",
  "STRIPE_PRICE_FEATURED_ANNUAL",
  "STRIPE_PRICE_PAID_MONTHLY_PT",
  "STRIPE_PRICE_PAID_ANNUAL_PT",
  "STRIPE_PRICE_FEATURED_MONTHLY_PT",
  "STRIPE_PRICE_FEATURED_ANNUAL_PT",
] as const;

const cache: Record<string, string> = {};
let loadPromise: Promise<void> | null = null;

export async function loadStripeSecrets(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const appId  = process.env.AMPLIFY_APP_ID ?? "d36uz2q25gygnh";
    const region = process.env.AWS_REGION ?? "ap-southeast-2";

    const client = new SSMClient({ region });
    const paths  = STRIPE_KEYS.map(k => `/amplify/shared/${appId}/${k}`);

    try {
      const result = await client.send(
        new GetParametersCommand({ Names: paths, WithDecryption: true })
      );
      for (const param of result.Parameters ?? []) {
        if (!param.Name || !param.Value) continue;
        const key = param.Name.split("/").pop()!;
        cache[key] = param.Value;
      }
    } catch (err) {
      console.error("[amplifySecrets] SSM fetch failed:", err);
    }

    // Fallback: process.env for any keys not found in SSM
    for (const key of STRIPE_KEYS) {
      if (!cache[key]) {
        const envVal = process.env[key];
        console.log(`[amplifySecrets] ${key}: SSM miss, env=${envVal ? "found" : "missing"}`);
        cache[key] = envVal ?? "";
      }
    }

    // Branch-specific overrides (e.g. STAGING_STRIPE_WEBHOOK_SECRET)
    const branch = process.env.AWS_BRANCH;
    if (branch && branch !== "master") {
      const prefix = branch.toUpperCase().replace(/-/g, "_");
      for (const key of STRIPE_KEYS) {
        const branchKey = `${prefix}_${key}`;
        const branchVal = process.env[branchKey];
        if (branchVal) {
          cache[key] = branchVal;
          console.log(`[amplifySecrets] ${key}: overridden by ${branchKey}`);
        }
      }
    }
  })();
  return loadPromise;
}

export function getSecret(key: string): string {
  return cache[key] ?? "";
}
