#!/usr/bin/env npx tsx
/**
 * Seed PersonalTrainer records from Google Places CSV into DynamoDB.
 *
 * Usage:
 *   npx tsx scripts/seed-pts.ts                     # all rows
 *   npx tsx scripts/seed-pts.ts --state WA          # WA only
 *   npx tsx scripts/seed-pts.ts --state WA --limit 50
 *   npx tsx scripts/seed-pts.ts --dry-run            # print without writing
 *
 * Safe to re-run: uses googlePlaceId-based deterministic IDs (pt-<hash>),
 * so duplicate creates will error harmlessly.
 */

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { createRequire } from "module";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Schema } from "../amplify/data/resource.js";

const require = createRequire(import.meta.url);
const outputs = require("../amplify_outputs.json");

Amplify.configure(outputs);
const client = generateClient<Schema>({ authMode: "apiKey" });

// ── Config ───────────────────────────────────────────────────────────────────
const INPUT_CSV = path.resolve("data/pts_google_2026-03-10.csv");

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

/** Clean phone: remove spaces, keep +61 prefix */
function cleanPhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/\s+/g, "").trim();
}

/** Format hours into the format used by the PT model */
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

  // Group consecutive days with same hours
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

/** Infer specialties from Google Places types */
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

  // Default if nothing matched
  if (!specs.length) specs.push("Personal Training");

  return specs;
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

  // Filter by state
  let rows = opts.state
    ? allRows.filter((r) => (r.addressState || "").toUpperCase() === opts.state)
    : allRows;
  if (opts.state)
    console.log(`Filtered to ${rows.length.toLocaleString()} rows in ${opts.state}`);

  // Filter out non-operational businesses
  rows = rows.filter((r) => !r.businessStatus || r.businessStatus === "OPERATIONAL");
  console.log(`Operational: ${rows.length.toLocaleString()}`);

  // Filter out rows without lat/lng
  rows = rows.filter((r) => r.lat && r.lng && parseFloat(r.lat) !== 0);
  console.log(`With coordinates: ${rows.length.toLocaleString()}`);

  // Limit
  if (opts.limit) {
    rows = rows.slice(0, opts.limit);
    console.log(`Limited to first ${rows.length}`);
  }

  if (!rows.length) {
    console.log("Nothing to seed.");
    return;
  }

  if (opts.dryRun) {
    console.log(`\n[DRY RUN] Would seed ${rows.length} PTs. First 5:`);
    for (const r of rows.slice(0, 5)) {
      console.log(
        `  ${placeIdToPtId(r.googlePlaceId)} | ${r.name} | ${r.addressSuburb} ${r.addressPostcode} | ${r.phone || "no phone"}`
      );
    }
    return;
  }

  console.log(`\nSeeding ${rows.length} PTs into DynamoDB…\n`);

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

    try {
      const { errors } = await (client.models as any).PersonalTrainer.create({
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
        email: "", // Google Places doesn't provide email
        website: r.website || "",
        gymIds: [],
        specialties,
        qualifications: [],
        availability: availability || undefined,
        languages: ["English"],
      });

      if (errors?.length) {
        // "ConditionalCheckFailed" = already exists → skip
        const isExists = errors.some((e: any) =>
          e.message?.includes("Conditional") || e.message?.includes("already exists")
        );
        if (isExists) {
          skipped++;
          process.stdout.write(`${label} SKIP ${r.name}\r`);
        } else {
          failed++;
          console.log(`${label} FAIL ${r.name}: ${errors.map((e: any) => e.message).join(", ")}`);
        }
      } else {
        ok++;
        process.stdout.write(`${label}  OK  ${r.name}\r`);
      }
    } catch (err: any) {
      failed++;
      console.log(`${label} ERR  ${r.name}: ${String(err).slice(0, 100)}`);
    }
  }

  console.log(`\n\n── Done ──`);
  console.log(`  Created : ${ok}`);
  console.log(`  Skipped : ${skipped} (already exist)`);
  console.log(`  Failed  : ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
