#!/usr/bin/env npx tsx
/**
 * Gym amenities enrichment script.
 *
 * Reads data/gyms_dynamo.csv, calls Claude + web tools per gym,
 * extracts amenities / pricing / member offers, writes to data/gyms_enriched.csv.
 *
 * Usage:
 *   npx tsx scripts/enrich-gyms.ts
 *   npx tsx scripts/enrich-gyms.ts --state WA --limit 20
 *   npx tsx scripts/enrich-gyms.ts --delay 1.5
 *
 * Resume: re-running skips already-processed gym IDs automatically.
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

// ── Load .env.local ───────────────────────────────────────────────────────────
const envFile = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const val = rest.join("=").replace(/^['"]|['"]$/g, "");
    if (!process.env[key.trim()]) process.env[key.trim()] = val;
  }
}

// ── Config ────────────────────────────────────────────────────────────────────
const INPUT_CSV  = path.resolve("data/gyms_dynamo.csv");
const MODEL      = "claude-haiku-4-5";
const DEFAULT_OUTPUT = `data/gyms_enriched_${new Date().toISOString().slice(0,10)}_${MODEL.replace(/[^a-z0-9]/g,"-")}.csv`;
const MAX_RETRIES        = 3;
const MAX_CONTINUATIONS  = 6;
const DEFAULT_DELAY_S    = 2.0;

const OUTPUT_FIELDS = [
  "id", "name", "addressState", "website",
  "status",
  "min_weekly_price_aud",
  "amenities",
  "member_offers",
  "confidence",
  "error",
];

const SYSTEM_PROMPT = `\
You are a gym data enrichment assistant. Research gym websites and extract structured membership info.

Use web_fetch on the provided URL (follow links to pricing/membership pages if needed).
Use web_search only if web_fetch fails or yields no useful content.

Your FINAL response must be ONLY valid JSON — no preamble, no explanation, no markdown fences.
Use exactly this schema (all fields required, use null if unknown):

{
  "min_weekly_price_aud": <number or null>,
  "confidence": "high" | "medium" | "low" | "no_data",
  "amenities": {
    "pool": bool, "spa": bool, "sauna": bool, "free_weights": bool,
    "cardio": bool, "group_classes": bool, "boxing_mma": bool,
    "yoga_pilates": bool, "parking": bool, "showers": bool,
    "lockers": bool, "childcare": bool, "cafe": bool,
    "access_247": bool, "personal_training": bool
  },
  "member_offers": {
    "no_contract": bool, "contract": bool, "new_member_trial": bool,
    "referral_scheme": bool, "multi_location_access": bool, "app": bool
  }
}

confidence levels:
- "high"    = price and most amenities found clearly on the website
- "medium"  = some data found but pricing missing or ambiguous
- "low"     = very little data, mostly inferred from gym type
- "no_data" = website unreachable or no relevant content found`;

// web_search_20250305 is the version compatible with Haiku 4.5
// web_fetch (direct URL fetch) requires Sonnet/Opus — use web_search only for Haiku
const TOOLS = [
  { type: "web_search_20250305", name: "web_search" },
] as any[];

const DEFAULT_AMENITIES = {
  pool: false, spa: false, sauna: false, free_weights: false,
  cardio: false, group_classes: false, boxing_mma: false,
  yoga_pilates: false, parking: false, showers: false,
  lockers: false, childcare: false, cafe: false,
  access_247: false, personal_training: false,
};

const DEFAULT_OFFERS = {
  no_contract: false, contract: false, new_member_trial: false,
  referral_scheme: false, multi_location_access: false, app: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    state: get("--state")?.toUpperCase(),
    limit: get("--limit") ? parseInt(get("--limit")!) : undefined,
    delay: get("--delay") ? parseFloat(get("--delay")!) : DEFAULT_DELAY_S,
    output: get("--output"),
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadProcessedIds(outputCsv: string): Set<string> {
  if (!fs.existsSync(outputCsv)) return new Set();
  const rows = parse(fs.readFileSync(outputCsv, "utf8"), { columns: true });
  return new Set(rows.map((r: any) => r.id));
}

function appendRow(outputCsv: string, row: Record<string, string>) {
  const isNew = !fs.existsSync(outputCsv);
  const line = stringify([row], { header: isNew, columns: OUTPUT_FIELDS });
  fs.appendFileSync(outputCsv, line, "utf8");
}

function buildPrompt(gym: Record<string, string>): string {
  const parts = [`Gym name: ${gym.name}`];
  if (gym.website)       parts.push(`Website: ${gym.website}`);
  if (gym.addressSuburb) parts.push(`Location: ${gym.addressSuburb}, ${gym.addressState || ""}`);
  if (gym.description)   parts.push(`Description: ${gym.description.slice(0, 400)}`);
  return parts.join("\n");
}

function extractJson(text: string): Record<string, any> | null {
  let t = text.trim();
  // Strip markdown fences
  if (t.startsWith("```")) {
    const lines = t.split("\n");
    t = lines.slice(1, lines.at(-1)?.trim() === "```" ? -1 : undefined).join("\n");
  }
  try { return JSON.parse(t); } catch {}
  // Try to find embedded JSON object
  const start = t.indexOf("{");
  const end   = t.lastIndexOf("}") + 1;
  if (start !== -1 && end > start) {
    try { return JSON.parse(t.slice(start, end)); } catch {}
  }
  return null;
}

async function callClaude(
  client: Anthropic,
  gym: Record<string, string>,
): Promise<{ status: "success" | "parse_error"; result: any; error?: string }> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: buildPrompt(gym) },
  ];

  let lastText = "";

  for (let i = 0; i < MAX_CONTINUATIONS; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOLS as any,
      messages,
    });

    for (const block of response.content) {
      if (block.type === "text") lastText = block.text;
    }

    if (response.stop_reason === "end_turn") break;

    if (response.stop_reason === "pause_turn") {
      messages.splice(0, messages.length,
        { role: "user",      content: buildPrompt(gym) },
        { role: "assistant", content: response.content },
      );
      continue;
    }

    break;
  }

  if (!lastText) {
    return { status: "parse_error", result: null, error: "No text in response" };
  }

  const parsed = extractJson(lastText);
  if (!parsed) {
    return { status: "parse_error", result: null, error: `JSON parse failed: ${lastText.slice(0, 150)}` };
  }

  const result = {
    min_weekly_price_aud: parsed.min_weekly_price_aud ?? null,
    confidence: parsed.confidence ?? "no_data",
    amenities:    { ...DEFAULT_AMENITIES,  ...(parsed.amenities    ?? {}) },
    member_offers: { ...DEFAULT_OFFERS,    ...(parsed.member_offers ?? {}) },
  };

  return { status: "success", result };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const OUTPUT_CSV = path.resolve(opts.output ?? DEFAULT_OUTPUT);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY not found in environment or .env.local");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // Load input
  const allGyms: Record<string, string>[] = parse(
    fs.readFileSync(INPUT_CSV, "utf8"),
    { columns: true, skip_empty_lines: true },
  );
  console.log(`Loaded ${allGyms.length.toLocaleString()} gyms from ${INPUT_CSV}`);

  // Filter
  let gyms = opts.state
    ? allGyms.filter(g => (g.addressState || "").toUpperCase() === opts.state)
    : allGyms;
  if (opts.state) console.log(`Filtered to ${gyms.length.toLocaleString()} gyms in ${opts.state}`);

  // Skip processed
  const processed = loadProcessedIds(OUTPUT_CSV);
  gyms = gyms.filter(g => !processed.has(g.id));
  console.log(`Already processed: ${processed.size.toLocaleString()}  |  Remaining: ${gyms.length.toLocaleString()}`);

  // Limit
  if (opts.limit) {
    gyms = gyms.slice(0, opts.limit);
    console.log(`Processing first ${gyms.length} (--limit ${opts.limit})`);
  }

  if (!gyms.length) { console.log("Nothing to do."); return; }

  const counts = { success: 0, parse_error: 0, no_website: 0, failed: 0 };
  const pad = gyms.length.toString().length;

  for (let i = 0; i < gyms.length; i++) {
    const gym   = gyms[i];
    const label = `[${String(i + 1).padStart(pad)}/${gyms.length}] ${gym.name.slice(0, 55).padEnd(55)} (${gym.addressState || "?"})`;
    process.stdout.write(`${label} ... `);

    const SOCIAL_DOMAINS = ["facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com", "youtube.com", "linkedin.com", "yelp.com", "tripadvisor.com", "yellowpages.com.au", "truelocal.com.au", "localsearch.com.au"];
    const isSocial = (url: string) => SOCIAL_DOMAINS.some(d => url.toLowerCase().includes(d));

    // No website or social/directory link
    if (!gym.website?.trim() || isSocial(gym.website)) {
      const reason = !gym.website?.trim() ? "no_website" : "social_link";
      appendRow(OUTPUT_CSV, { id: gym.id, name: gym.name, addressState: gym.addressState || "",
        website: gym.website || "", status: reason, min_weekly_price_aud: "",
        amenities: "", member_offers: "", confidence: "", error: "" });
      counts.no_website++;
      console.log(`SKIP (${reason})`);
      continue;
    }

    // Retry loop
    let status = "failed";
    let result: any = null;
    let error: string | undefined;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        ({ status, result, error } = await callClaude(client, gym));
        break;
      } catch (e: any) {
        if (e instanceof Anthropic.RateLimitError) {
          const wait = 30 * attempt;
          process.stdout.write(`rate-limited, waiting ${wait}s ... `);
          await sleep(wait * 1000);
          error = "rate_limit";
        } else {
          error = String(e).slice(0, 120);
          if (attempt < MAX_RETRIES) await sleep(5000 * attempt);
        }
      }
    }

    if (status === "success" || status === "parse_error") {
      counts[status as keyof typeof counts]++;
    } else {
      counts.failed++;
    }

    appendRow(OUTPUT_CSV, {
      id:                   gym.id,
      name:                 gym.name,
      addressState:         gym.addressState || "",
      website:              gym.website || "",
      status,
      min_weekly_price_aud: result?.min_weekly_price_aud != null ? String(result.min_weekly_price_aud) : "",
      amenities:            result ? JSON.stringify(result.amenities) : "",
      member_offers:        result ? JSON.stringify(result.member_offers) : "",
      confidence:           result?.confidence || "",
      error:                error || "",
    });

    const price = result?.min_weekly_price_aud != null ? `$${result.min_weekly_price_aud}/wk` : "price=?";
    const conf  = result?.confidence || "?";
    const tag   = status === "success" ? "OK" : status.toUpperCase();
    console.log(`${tag}  ${price}  conf=${conf}`);

    if (i < gyms.length - 1) await sleep(opts.delay * 1000);
  }

  // Summary
  console.log(`\n── Done ──`);
  console.log(`  success    : ${counts.success}`);
  console.log(`  parse_error: ${counts.parse_error}`);
  console.log(`  no_website : ${counts.no_website}`);
  console.log(`  failed     : ${counts.failed}`);
  console.log(`\nOutput: ${OUTPUT_CSV}`);
}

main().catch(err => { console.error(err); process.exit(1); });
