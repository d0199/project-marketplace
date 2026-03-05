/**
 * Fetch Amplify Gen 2 secrets from SSM Parameter Store at Lambda runtime.
 *
 * Gen 2 secrets set via the Amplify console Secret management are stored in
 * SSM and are NOT automatically injected into the SSR hosting Lambda's
 * process.env. We fetch them explicitly using the compute role's IAM credentials.
 *
 * SSM paths tried (in order):
 *   /amplify/{appId}/{branch}/{name}   — branch-specific
 *   /amplify/{appId}/shared/{name}     — shared across branches
 *
 * Results are cached in Lambda memory for the lifetime of the instance.
 *
 * IAM requirement on amplify-ssr-compute-role:
 *   ssm:GetParameters on arn:aws:ssm:*:*:parameter/amplify/*
 */
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

const STRIPE_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PAID_MONTHLY",
  "STRIPE_PRICE_PAID_ANNUAL",
  "STRIPE_PRICE_FEATURED_MONTHLY",
  "STRIPE_PRICE_FEATURED_ANNUAL",
] as const;

const cache: Record<string, string> = {};
let loadPromise: Promise<void> | null = null;

export async function loadStripeSecrets(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const appId  = process.env.AWS_APP_ID;
    const branch = process.env.AWS_BRANCH;
    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-southeast-2";

    // Local dev: no AWS_APP_ID, fall back to process.env
    if (!appId || !branch) {
      for (const key of STRIPE_KEYS) cache[key] = process.env[key] ?? "";
      return;
    }

    const client = new SSMClient({ region });

    // Try branch-specific paths then shared paths in one batch call
    const branchPaths = STRIPE_KEYS.map(k => `/amplify/${appId}/${branch}/${k}`);
    const sharedPaths = STRIPE_KEYS.map(k => `/amplify/${appId}/shared/${k}`);

    const allPaths = [...branchPaths, ...sharedPaths];
    try {
      const result = await client.send(
        new GetParametersCommand({ Names: allPaths, WithDecryption: true })
      );
      for (const param of result.Parameters ?? []) {
        if (!param.Name || !param.Value) continue;
        const key = param.Name.split("/").pop()!;
        if (!cache[key]) cache[key] = param.Value; // branch wins over shared
      }
    } catch (err) {
      console.error("[amplifySecrets] SSM fetch failed:", err);
    }

    // Final fallback: process.env (works in local dev / older Amplify setups)
    for (const key of STRIPE_KEYS) {
      if (!cache[key]) cache[key] = process.env[key] ?? "";
    }
  })();
  return loadPromise;
}

export function getSecret(key: string): string {
  return cache[key] ?? "";
}
