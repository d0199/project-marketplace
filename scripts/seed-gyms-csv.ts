#!/usr/bin/env npx tsx
/**
 * Seed Gym records from gyms_dynamo.csv into DynamoDB via AppSync GraphQL.
 *
 * Usage:
 *   npx tsx scripts/seed-gyms-csv.ts --state WA
 *   npx tsx scripts/seed-gyms-csv.ts --state WA --limit 10
 *   npx tsx scripts/seed-gyms-csv.ts --dry-run
 *
 * Safe to re-run: uses existing gym IDs, duplicates get ConditionalCheckFailed.
 */

import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Allow --config flag to point at a different amplify_outputs file (e.g. staging)
const configArg = process.argv.indexOf("--config");
const configPath = configArg !== -1 ? path.resolve(process.argv[configArg + 1]) : path.resolve("amplify_outputs.json");
const outputs = require(configPath);
console.log(`Using config: ${configPath}`);

const APPSYNC_URL: string = outputs.data?.url;
const API_KEY: string = outputs.data?.api_key;

if (!APPSYNC_URL || !API_KEY) {
  console.error("Missing data.url or data.api_key in config file");
  process.exit(1);
}

const INPUT_CSV = path.resolve("data/gyms_dynamo.csv");

const CREATE_MUTATION = `
  mutation CreateGym($input: CreateGymInput!) {
    createGym(input: $input) {
      id
    }
  }
`;

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    state: get("--state")?.toUpperCase(),
    limit: get("--limit") ? parseInt(get("--limit")!) : undefined,
    dryRun: args.includes("--dry-run"),
    config: get("--config"),
  };
}

async function gqlMutate(input: Record<string, any>): Promise<{ ok: boolean; error?: string }> {
  const resp = await fetch(APPSYNC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      query: CREATE_MUTATION,
      variables: { input },
    }),
  });

  const json = await resp.json();
  if (json.errors?.length) {
    return { ok: false, error: json.errors[0].message };
  }
  return { ok: true };
}

function parseAmenities(raw: string): string[] {
  if (!raw) return [];
  try {
    // Could be JSON array string like '["pool","sauna"]' or comma-separated
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const opts = parseArgs();

  const allRows: Record<string, string>[] = parse(
    fs.readFileSync(INPUT_CSV, "utf8"),
    { columns: true, skip_empty_lines: true }
  );
  console.log(`Loaded ${allRows.length.toLocaleString()} gyms from CSV`);

  let rows = opts.state
    ? allRows.filter((r) => (r.addressState || "").toUpperCase() === opts.state)
    : allRows;
  if (opts.state)
    console.log(`Filtered to ${rows.length.toLocaleString()} in ${opts.state}`);

  if (opts.limit) {
    rows = rows.slice(0, opts.limit);
    console.log(`Limited to first ${rows.length}`);
  }

  if (!rows.length) { console.log("Nothing to seed."); return; }

  if (opts.dryRun) {
    console.log(`\n[DRY RUN] Would seed ${rows.length} gyms. First 5:`);
    for (const r of rows.slice(0, 5)) {
      console.log(`  ${r.id} | ${r.name} | ${r.addressSuburb} ${r.addressPostcode}`);
    }
    return;
  }

  console.log(`\nSeeding ${rows.length} gyms via AppSync…\n`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const pad = rows.length.toString().length;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const label = `[${String(i + 1).padStart(pad)}/${rows.length}]`;

    const input: Record<string, any> = {
      id: r.id,
      googlePlaceId: r.googlePlaceId || undefined,
      ownerId: r.ownerId || "unclaimed",
      createdBy: r.createdBy || "csv-seed",
      name: r.name || "Unknown",
      description: r.description || "",
      images: [],
      amenities: parseAmenities(r.amenities),
      lat: parseFloat(r.lat) || 0,
      lng: parseFloat(r.lng) || 0,
      pricePerWeek: r.pricePerWeek ? parseFloat(r.pricePerWeek) : undefined,
      addressStreet: r.addressStreet || "",
      addressSuburb: r.addressSuburb || "",
      addressState: r.addressState || "",
      addressPostcode: r.addressPostcode || "",
      phone: r.phone || "",
      email: r.email || "",
      website: r.website || "",
      instagram: r.instagram || undefined,
      facebook: r.facebook || undefined,
      bookingUrl: r.bookingUrl || undefined,
      isActive: r.isActive === "true",
      isFeatured: r.isFeatured === "true",
      isTest: r.isTest === "true",
      priceVerified: r.priceVerified === "true",
      isPaid: r.isPaid === "true",
      hoursMonday: r.hoursMonday || undefined,
      hoursTuesday: r.hoursTuesday || undefined,
      hoursWednesday: r.hoursWednesday || undefined,
      hoursThursday: r.hoursThursday || undefined,
      hoursFriday: r.hoursFriday || undefined,
      hoursSaturday: r.hoursSaturday || undefined,
      hoursSunday: r.hoursSunday || undefined,
      hoursComment: r.hoursComment || undefined,
    };

    // Strip undefined values
    for (const key of Object.keys(input)) {
      if (input[key] === undefined) delete input[key];
    }

    const result = await gqlMutate(input);

    if (result.ok) {
      ok++;
      if (ok % 50 === 0 || i === rows.length - 1) {
        process.stdout.write(`${label}  OK  ${r.name} (${ok} created)\n`);
      }
    } else if (result.error?.includes("onditional") || result.error?.includes("already exists")) {
      skipped++;
    } else {
      failed++;
      if (failed <= 10) {
        console.log(`${label} FAIL ${r.name}: ${result.error?.slice(0, 120)}`);
      }
    }
  }

  console.log(`\n── Done ──`);
  console.log(`  Created : ${ok}`);
  console.log(`  Skipped : ${skipped} (already exist)`);
  console.log(`  Failed  : ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
