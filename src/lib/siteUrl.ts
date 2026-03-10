/**
 * Centralised base URL for the site.
 *
 * Uses NEXT_PUBLIC_BASE_URL (set per-branch in Amplify Console env vars).
 * Falls back to production URL so existing deploys keep working.
 */
export const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.mynextgym.com.au";
