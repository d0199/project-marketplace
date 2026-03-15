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

    // Detect non-production environment.
    // NEXT_PUBLIC_ vars are inlined at build time and may not exist in the
    // SSR Lambda's process.env at runtime, so we also check DEPLOYMENT_ENV
    // (a plain env var set per-branch in Amplify Console).
    const deployEnv = process.env.DEPLOYMENT_ENV ?? "";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const isProduction =
      deployEnv !== "staging" &&
      (!baseUrl || baseUrl.includes("www.mynextgym.com.au"));
    const branchPrefix = isProduction ? null : "STAGING";

    // Build SSM paths — base keys + STAGING_ keys if non-production
    const ssmKeys = [...STRIPE_KEYS];
    if (branchPrefix) {
      for (const key of STRIPE_KEYS) {
        ssmKeys.push(`${branchPrefix}_${key}` as typeof STRIPE_KEYS[number]);
      }
    }

    // SSM GetParameters has a 10-param limit per call — batch accordingly
    const paths = ssmKeys.map(k => `/amplify/shared/${appId}/${k}`);
    try {
      for (let i = 0; i < paths.length; i += 10) {
        const batch = paths.slice(i, i + 10);
        const result = await client.send(
          new GetParametersCommand({ Names: batch, WithDecryption: true })
        );
        for (const param of result.Parameters ?? []) {
          if (!param.Name || !param.Value) continue;
          const key = param.Name.split("/").pop()!;
          cache[key] = param.Value;
        }
      }
    } catch (err) {
      console.error("[amplifySecrets] SSM fetch failed:", err);
    }

    // Branch-specific SSM overrides: STAGING_STRIPE_X → STRIPE_X
    if (branchPrefix) {
      for (const key of STRIPE_KEYS) {
        const branchKey = `${branchPrefix}_${key}`;
        if (cache[branchKey]) {
          console.log(`[amplifySecrets] ${key}: overridden by SSM ${branchKey}`);
          cache[key] = cache[branchKey];
        }
      }
    }

    // Log which key is being used (first 8 chars only for security)
    const sk = cache["STRIPE_SECRET_KEY"] ?? "";
    console.log(`[amplifySecrets] STRIPE_SECRET_KEY prefix: ${sk.slice(0, 8)}..., isProduction=${isProduction}, baseUrl=${baseUrl}`);

    // Fallback: process.env for any keys still not found
    for (const key of STRIPE_KEYS) {
      if (!cache[key]) {
        const envVal = process.env[key];
        console.log(`[amplifySecrets] ${key}: SSM miss, env=${envVal ? "found" : "missing"}`);
        cache[key] = envVal ?? "";
      }
    }
  })();
  return loadPromise;
}

export function getSecret(key: string): string {
  return cache[key] ?? "";
}
