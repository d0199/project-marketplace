/**
 * Backfill DynamoDB from gyms_enriched CSV.
 *
 * For each row with status=success:
 *   - Writes amenities array (mapped from boolean flags)
 *   - Writes memberOffers array (mapped from boolean flags)
 *   - Sets pricePerWeek if min_weekly_price_aud is present
 *   - Sets priceVerified = true and pricingNotes = "Verified using AI" if confidence = "high"
 *
 * Usage:
 *   npx tsx scripts/backfill-dynamo.ts --input data/gyms_enriched_2026-03-07_claude-sonnet-4-6.csv
 *   npx tsx scripts/backfill-dynamo.ts --input data/gyms_enriched_2026-03-07_claude-haiku-4-5.csv --dry-run
 */

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import type { Schema } from "../amplify/data/resource.js";

const require = createRequire(import.meta.url);
const outputs = require("../amplify_outputs.json");
Amplify.configure(outputs);
const client = generateClient<Schema>({ authMode: "apiKey" });

// ── Amenity mapping: CSV boolean key → amenities string array value ───────────
const AMENITY_MAP: Record<string, string> = {
  pool:              "pool",
  spa:               "spa",
  sauna:             "sauna",
  free_weights:      "free weights",
  cardio:            "cardio",
  group_classes:     "group classes",
  boxing_mma:        "boxing/mma",
  yoga_pilates:      "yoga/pilates",
  parking:           "parking",
  showers:           "showers",
  lockers:           "lockers",
  childcare:         "childcare",
  cafe:              "café",
  access_247:        "24/7 access",
  personal_training: "personal training",
};

// ── Member offer mapping ──────────────────────────────────────────────────────
const OFFER_MAP: Record<string, string> = {
  no_contract:           "no contract",
  contract:              "contract",
  new_member_trial:      "new member trial",
  referral_scheme:       "referral scheme",
  multi_location_access: "multiple location access",
  app:                   "gym or community app",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    input:  get("--input"),
    dryRun: args.includes("--dry-run"),
  };
}

async function main() {
  const opts = parseArgs();

  if (!opts.input) {
    console.error("Usage: npx tsx scripts/backfill-dynamo.ts --input <csv-file> [--dry-run]");
    process.exit(1);
  }

  const csvPath = path.resolve(opts.input);
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const rows: Record<string, string>[] = parse(
    fs.readFileSync(csvPath, "utf8"),
    { columns: true, skip_empty_lines: true }
  );

  const success = rows.filter((r) => r.status === "success");
  console.log(`Total rows: ${rows.length}  |  status=success: ${success.length}`);
  if (opts.dryRun) console.log("── DRY RUN — no writes ──");

  const counts = { updated: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < success.length; i++) {
    const row = success[i];
    const label = `[${i + 1}/${success.length}] ${row.name?.slice(0, 50)}`;
    process.stdout.write(`${label} ... `);

    let amenities: string[] | undefined;
    let memberOffers: string[] | undefined;

    try {
      const rawAmenities = JSON.parse(row.amenities || "{}");
      amenities = Object.entries(rawAmenities)
        .filter(([, v]) => v === true)
        .map(([k]) => AMENITY_MAP[k])
        .filter(Boolean) as string[];

      const rawOffers = JSON.parse(row.member_offers || "{}");
      memberOffers = Object.entries(rawOffers)
        .filter(([, v]) => v === true)
        .map(([k]) => OFFER_MAP[k])
        .filter(Boolean) as string[];
    } catch {
      console.log("SKIP (JSON parse error)");
      counts.skipped++;
      continue;
    }

    const price = row.min_weekly_price_aud ? parseFloat(row.min_weekly_price_aud) : null;
    const isHighConfidence = row.confidence === "high";

    const update: Record<string, unknown> = {
      id: row.id,
      amenities,
      memberOffers,
    };

    if (price !== null && !isNaN(price)) {
      update.pricePerWeek = price;
    }

    if (isHighConfidence) {
      update.priceVerified = true;
      update.pricingNotes  = "Verified using AI";
    }

    if (opts.dryRun) {
      console.log(`DRY  amenities=[${amenities.join(", ")}]  price=${price ?? "?"}  verified=${isHighConfidence}`);
      counts.updated++;
      continue;
    }

    try {
      const { errors } = await client.models.Gym.update(update as Parameters<typeof client.models.Gym.update>[0]);
      if (errors?.length) {
        console.log(`FAIL ${errors.map((e) => e.message).join(", ")}`);
        counts.failed++;
      } else {
        const priceStr = price !== null ? `$${Math.round(price)}/wk` : "price=?";
        console.log(`OK  ${priceStr}  verified=${isHighConfidence}  amenities=${amenities.length}`);
        counts.updated++;
      }
    } catch (e: any) {
      console.log(`FAIL ${String(e).slice(0, 80)}`);
      counts.failed++;
    }

    // Small delay to avoid throttling
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log("\n── Summary ──");
  console.log(`  updated : ${counts.updated}`);
  console.log(`  skipped : ${counts.skipped}`);
  console.log(`  failed  : ${counts.failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
