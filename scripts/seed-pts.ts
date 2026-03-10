#!/usr/bin/env npx tsx
/**
 * Seed PersonalTrainer records from Google Places CSV into DynamoDB
 * via direct AppSync GraphQL mutations.
 *
 * Usage:
 *   npx tsx scripts/seed-pts.ts --state WA
 *   npx tsx scripts/seed-pts.ts --state WA --limit 50
 *   npx tsx scripts/seed-pts.ts --dry-run
 *
 * Safe to re-run: uses googlePlaceId-based deterministic IDs (pt-<hash>),
 * so duplicate creates will error harmlessly (ConditionalCheckFailed).
 */

import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import crypto from "crypto";
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

// ── Config ───────────────────────────────────────────────────────────────────
const INPUT_CSV = path.resolve("data/pts_google_2026-03-10.csv");

const CREATE_MUTATION = `
  mutation CreatePT($input: CreatePersonalTrainerInput!) {
    createPersonalTrainer(input: $input) {
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
  };
}

/** Deterministic PT ID from Google Place ID — ensures idempotent seeding */
function placeIdToPtId(googlePlaceId: string): string {
  const hash = crypto.createHash("sha256").update(googlePlaceId).digest("hex").slice(0, 12);
  return `pt-${hash}`;
}

function cleanPhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/\s+/g, "").trim();
}

function formatAvailability(row: Record<string, string>): string {
  const days = [
    ["Mon", row.hoursMonday],
    ["Tue", row.hoursTuesday],
    ["Wed", row.hoursWednesday],
    ["Thu", row.hoursThursday],
    ["Fri", row.hoursFriday],
    ["Sat", row.hoursSaturday],
    ["Sun", row.hoursSunday],
  ].filter(([, v]) => v) as [string, string][];

  if (!days.length) return "";

  const groups: { days: string[]; hours: string }[] = [];
  for (const [day, hours] of days) {
    const last = groups[groups.length - 1];
    if (last && last.hours === hours) {
      last.days.push(day);
    } else {
      groups.push({ days: [day], hours });
    }
  }

  return groups
    .map((g) => {
      const dayRange =
        g.days.length > 2
          ? `${g.days[0]}-${g.days[g.days.length - 1]}`
          : g.days.join(", ");
      return `${dayRange} ${g.hours}`;
    })
    .join(", ");
}

function inferSpecialties(types: string, primaryType: string, name: string): string[] {
  const specs: string[] = [];
  const lower = `${types} ${primaryType} ${name}`.toLowerCase();

  if (lower.includes("yoga")) specs.push("Yoga");
  if (lower.includes("pilates")) specs.push("Pilates");
  if (lower.includes("boxing") || lower.includes("mma") || lower.includes("martial"))
    specs.push("Boxing / MMA");
  if (lower.includes("crossfit")) specs.push("CrossFit");
  if (lower.includes("strength") || lower.includes("powerlifting"))
    specs.push("Strength Training");
  if (lower.includes("rehab") || lower.includes("physio"))
    specs.push("Rehabilitation");
  if (lower.includes("weight loss") || lower.includes("transformation"))
    specs.push("Weight Loss");
  if (lower.includes("sport") || lower.includes("athletic"))
    specs.push("Sports Performance");

  if (!specs.length) specs.push("Personal Training");
  return specs;
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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`Input CSV not found: ${INPUT_CSV}`);
    process.exit(1);
  }

  const allRows: Record<string, string>[] = parse(
    fs.readFileSync(INPUT_CSV, "utf8"),
    { columns: true, skip_empty_lines: true }
  );
  console.log(`Loaded ${allRows.length.toLocaleString()} rows from CSV`);

  let rows = opts.state
    ? allRows.filter((r) => (r.addressState || "").toUpperCase() === opts.state)
    : allRows;
  if (opts.state)
    console.log(`Filtered to ${rows.length.toLocaleString()} rows in ${opts.state}`);

  rows = rows.filter((r) => !r.businessStatus || r.businessStatus === "OPERATIONAL");
  console.log(`Operational: ${rows.length.toLocaleString()}`);

  rows = rows.filter((r) => r.lat && r.lng && parseFloat(r.lat) !== 0);
  console.log(`With coordinates: ${rows.length.toLocaleString()}`);

  if (opts.limit) {
    rows = rows.slice(0, opts.limit);
    console.log(`Limited to first ${rows.length}`);
  }

  if (!rows.length) { console.log("Nothing to seed."); return; }

  if (opts.dryRun) {
    console.log(`\n[DRY RUN] Would seed ${rows.length} PTs. First 5:`);
    for (const r of rows.slice(0, 5)) {
      console.log(
        `  ${placeIdToPtId(r.googlePlaceId)} | ${r.name} | ${r.addressSuburb} ${r.addressPostcode} | ${r.phone || "no phone"}`
      );
    }
    return;
  }

  console.log(`\nSeeding ${rows.length} PTs via AppSync…\n`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const pad = rows.length.toString().length;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const ptId = placeIdToPtId(r.googlePlaceId);
    const label = `[${String(i + 1).padStart(pad)}/${rows.length}]`;

    const availability = formatAvailability(r);
    const specialties = inferSpecialties(r.types || "", r.primaryType || "", r.name || "");

    const input: Record<string, any> = {
      id: ptId,
      ownerId: "unclaimed",
      name: r.name || "Unknown",
      isActive: true,
      isTest: false,
      isFeatured: false,
      isPaid: false,
      createdBy: "google-places-seed",
      description: r.description || `${r.name} in ${r.addressSuburb || r.addressState || "Australia"}.`,
      images: [],
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lng),
      addressStreet: r.addressStreet || "",
      addressSuburb: r.addressSuburb || "",
      addressState: r.addressState || "",
      addressPostcode: r.addressPostcode || "",
      phone: cleanPhone(r.phone || r.internationalPhone || ""),
      email: "",
      website: r.website || "",
      gymIds: [],
      specialties,
      qualifications: [],
      languages: ["English"],
    };
    if (availability) input.availability = availability;

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
