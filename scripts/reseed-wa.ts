/**
 * Clear ALL Gym records from DynamoDB and re-seed with WA-only gyms.
 *
 * Usage:
 *   npx tsx scripts/reseed-wa.ts              # full run
 *   npx tsx scripts/reseed-wa.ts --dry-run    # preview only
 *   npx tsx scripts/reseed-wa.ts --clear-only # delete all, don't re-seed
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

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    clearOnly: args.includes("--clear-only"),
  };
}

// ── Step 1: Delete all Gym records ──────────────────────────────────────────

async function clearAllGyms(dryRun: boolean) {
  console.log("\n── Clearing ALL Gym records ──");

  let deleted = 0;
  let nextToken: string | null | undefined = undefined;

  do {
    const listArgs: { limit: number; nextToken?: string } = { limit: 500 };
    if (nextToken) listArgs.nextToken = nextToken;

    const { data: gyms, nextToken: nt } = await client.models.Gym.list(listArgs);
    nextToken = nt;

    if (!gyms || gyms.length === 0) break;

    console.log(`  Fetched ${gyms.length} gyms (total deleted so far: ${deleted})…`);

    for (const gym of gyms) {
      if (dryRun) {
        deleted++;
        continue;
      }

      try {
        const { errors } = await client.models.Gym.delete({ id: gym.id });
        if (errors?.length) {
          console.error(`  ✗ Delete ${gym.id}: ${errors.map((e) => e.message).join(", ")}`);
        } else {
          deleted++;
        }
      } catch (e: any) {
        console.error(`  ✗ Delete ${gym.id}: ${String(e).slice(0, 80)}`);
      }

      // Throttle to avoid DynamoDB rate limits
      if (deleted % 50 === 0) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  } while (nextToken);

  console.log(`  ${dryRun ? "Would delete" : "Deleted"} ${deleted} gym records.`);
  return deleted;
}

// ── Step 2: Seed WA gyms from gyms_dynamo.csv ──────────────────────────────

async function seedWAGyms(dryRun: boolean) {
  console.log("\n── Seeding WA gyms from gyms_dynamo.csv ──");

  const csvPath = path.resolve("data/gyms_dynamo.csv");
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  const rows: Record<string, string>[] = parse(
    fs.readFileSync(csvPath, "utf8"),
    { columns: true, skip_empty_lines: true }
  );

  const waGyms = rows.filter((r) => r.addressState === "WA");
  console.log(`  Total rows: ${rows.length}  |  WA gyms: ${waGyms.length}`);

  const counts = { created: 0, failed: 0 };

  for (let i = 0; i < waGyms.length; i++) {
    const row = waGyms[i];
    const label = `[${i + 1}/${waGyms.length}] ${(row.name || "").slice(0, 50)}`;

    if (dryRun) {
      if (i < 5) console.log(`  DRY ${label}`);
      counts.created++;
      continue;
    }

    process.stdout.write(`  ${label} … `);

    // Parse amenities array (stored as JSON string in CSV)
    let amenities: string[] = [];
    if (row.amenities) {
      try {
        const parsed = JSON.parse(row.amenities);
        amenities = Array.isArray(parsed) ? parsed : [];
      } catch {
        amenities = row.amenities.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    }

    const gymData: Record<string, unknown> = {
      id: row.id,
      googlePlaceId: row.googlePlaceId || undefined,
      ownerId: row.ownerId || "unclaimed",
      createdBy: row.createdBy || "bulk",
      name: row.name,
      description: row.description || undefined,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
      addressStreet: row.addressStreet || undefined,
      addressSuburb: row.addressSuburb || undefined,
      addressState: row.addressState || undefined,
      addressPostcode: row.addressPostcode || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      website: row.website || undefined,
      instagram: row.instagram || undefined,
      facebook: row.facebook || undefined,
      bookingUrl: row.bookingUrl || undefined,
      amenities: amenities.length > 0 ? amenities : undefined,
      pricePerWeek: row.pricePerWeek ? parseFloat(row.pricePerWeek) : undefined,
      isActive: row.isActive === "true" ? true : row.isActive === "false" ? false : true,
      isFeatured: row.isFeatured === "true",
      isTest: row.isTest === "true",
      priceVerified: row.priceVerified === "true",
      isPaid: row.isPaid === "true",
      stripePlan: row.stripePlan || undefined,
      stripeSubscriptionId: row.stripeSubscriptionId || undefined,
      hoursMonday: row.hoursMonday || undefined,
      hoursTuesday: row.hoursTuesday || undefined,
      hoursWednesday: row.hoursWednesday || undefined,
      hoursThursday: row.hoursThursday || undefined,
      hoursFriday: row.hoursFriday || undefined,
      hoursSaturday: row.hoursSaturday || undefined,
      hoursSunday: row.hoursSunday || undefined,
      hoursComment: row.hoursComment || undefined,
    };

    try {
      const { errors } = await client.models.Gym.create(
        gymData as Parameters<typeof client.models.Gym.create>[0]
      );
      if (errors?.length) {
        console.log(`FAIL ${errors.map((e) => e.message).join(", ")}`);
        counts.failed++;
      } else {
        console.log("OK");
        counts.created++;
      }
    } catch (e: any) {
      console.log(`FAIL ${String(e).slice(0, 80)}`);
      counts.failed++;
    }

    // Throttle
    if (i % 50 === 0 && i > 0) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (dryRun) console.log(`  … and ${waGyms.length - 5} more`);

  console.log(`\n── Seed Summary ──`);
  console.log(`  created : ${counts.created}`);
  console.log(`  failed  : ${counts.failed}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (opts.dryRun) console.log("══ DRY RUN — no writes ══\n");

  await clearAllGyms(opts.dryRun);

  if (!opts.clearOnly) {
    await seedWAGyms(opts.dryRun);
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
