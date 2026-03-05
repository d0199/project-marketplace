/**
 * scripts/importGyms.ts
 * Bulk-imports gyms from a JSON file into DynamoDB with three outcomes per record:
 *   CREATE  — no match found, insert as new
 *   BACKFILL — name+state match found but existing record has no googlePlaceId → update it
 *   SKIP    — already exists with a googlePlaceId (or no new place ID to add)
 *
 * Usage:
 *   npx tsx scripts/importGyms.ts                        # imports data/gyms_all.json
 *   npx tsx scripts/importGyms.ts data/gyms_all.json
 *   npx tsx scripts/importGyms.ts data/gyms_eastern.json
 *
 * Safe to re-run — creates/updates only what's needed.
 */

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { createRequire } from "module";
import type { Schema } from "../amplify/data/resource.js";

const require = createRequire(import.meta.url);
const outputs = require("../amplify_outputs.json");

Amplify.configure(outputs);

const client = generateClient<Schema>({ authMode: "apiKey" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalise(name: string, state: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}|${state.toUpperCase()}`;
}

interface ExistingGym {
  id: string;
  googlePlaceId?: string | null;
}

async function fetchAllExisting() {
  // placeId → true (quick dedup)
  const placeIdSet = new Set<string>();
  // normalised name+state → existing gym record (for backfill)
  const nameMap = new Map<string, ExistingGym>();

  let nextToken: string | null | undefined;
  process.stdout.write("Fetching existing gyms from DynamoDB");

  do {
    const res = await client.models.Gym.list({ limit: 1000, nextToken });
    for (const g of res.data ?? []) {
      if (g.googlePlaceId) placeIdSet.add(g.googlePlaceId);
      if (g.name && g.addressState) {
        nameMap.set(normalise(g.name, g.addressState), {
          id: g.id,
          googlePlaceId: g.googlePlaceId,
        });
      }
    }
    nextToken = res.nextToken;
    process.stdout.write(".");
  } while (nextToken);

  console.log(` done. ${nameMap.size} gyms loaded.`);
  return { placeIdSet, nameMap };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface GymJson {
  id: string;
  googlePlaceId?: string;
  ownerId: string;
  isActive?: boolean;
  isTest?: boolean;
  isFeatured?: boolean;
  priceVerified?: boolean;
  isPaid?: boolean;
  name: string;
  description: string;
  address: { street: string; suburb: string; state: string; postcode: string };
  phone: string;
  email: string;
  website: string;
  lat: number;
  lng: number;
  amenities: string[];
  hours: Record<string, string | undefined>;
  memberOffers?: string[];
  memberOffersScroll?: boolean;
  pricePerWeek: number;
  images: string[];
}

async function run() {
  const filePath = process.argv[2] ?? "data/gyms_all.json";

  let gyms: GymJson[];
  try {
    gyms = require(`../${filePath}`);
  } catch {
    console.error(`Could not load ${filePath}`);
    process.exit(1);
  }

  console.log(`\nImporting from ${filePath} (${gyms.length} records)\n`);

  const { placeIdSet, nameMap } = await fetchAllExisting();

  let created = 0;
  let backfilled = 0;
  let skipped = 0;
  let errors = 0;

  for (const gym of gyms) {
    const key = normalise(gym.name, gym.address.state);

    // 1. Exact place ID match → already fully imported
    if (gym.googlePlaceId && placeIdSet.has(gym.googlePlaceId)) {
      console.log(`  ⟳  SKIP      ${gym.name} (${gym.address.state}) — place ID match`);
      skipped++;
      continue;
    }

    // 2. Name+state match
    const existing = nameMap.get(key);
    if (existing) {
      // Backfill googlePlaceId if the existing record doesn't have one
      if (gym.googlePlaceId && !existing.googlePlaceId) {
        const { errors: errs } = await client.models.Gym.update({
          id: existing.id,
          googlePlaceId: gym.googlePlaceId,
        });
        if (errs?.length) {
          console.error(`  ✗  BACKFILL  ${gym.name}: ${errs.map((e) => e.message).join(", ")}`);
          errors++;
        } else {
          console.log(`  ↑  BACKFILL  ${gym.name} (${gym.address.state}) — place ID added`);
          placeIdSet.add(gym.googlePlaceId);
          backfilled++;
        }
      } else {
        console.log(`  ⟳  SKIP      ${gym.name} (${gym.address.state}) — name+state match`);
        skipped++;
      }
      continue;
    }

    // 3. No match → create (omit id — let Amplify auto-generate a UUID to avoid conflicts)
    const { errors: errs } = await client.models.Gym.create({
      // googlePlaceId included — works once Amplify backend redeploys new schema
      googlePlaceId: gym.googlePlaceId,
      ownerId: gym.ownerId,
      isActive: gym.isActive ?? true,
      isTest: gym.isTest ?? false,
      isFeatured: gym.isFeatured ?? false,
      priceVerified: gym.priceVerified ?? false,
      isPaid: gym.isPaid ?? false,
      name: gym.name,
      description: gym.description,
      images: gym.images ?? [],
      amenities: gym.amenities ?? [],
      lat: gym.lat,
      lng: gym.lng,
      pricePerWeek: gym.pricePerWeek,
      addressStreet: gym.address.street,
      addressSuburb: gym.address.suburb,
      addressState: gym.address.state,
      addressPostcode: gym.address.postcode,
      phone: gym.phone ?? "",
      email: gym.email ?? "",
      website: gym.website ?? "",
      hoursMonday: gym.hours?.monday,
      hoursTuesday: gym.hours?.tuesday,
      hoursWednesday: gym.hours?.wednesday,
      hoursThursday: gym.hours?.thursday,
      hoursFriday: gym.hours?.friday,
      hoursSaturday: gym.hours?.saturday,
      hoursSunday: gym.hours?.sunday,
      memberOffers: gym.memberOffers ?? [],
      memberOffersScroll: gym.memberOffersScroll ?? false,
    });

    if (errs?.length) {
      // If googlePlaceId field not yet in schema, retry without it
      if (errs.some((e) => e.message.includes("not defined for input"))) {
        const { errors: errs2 } = await client.models.Gym.create({
          ownerId: gym.ownerId,
          isActive: gym.isActive ?? true,
          isTest: gym.isTest ?? false,
          isFeatured: gym.isFeatured ?? false,
          priceVerified: gym.priceVerified ?? false,
          isPaid: gym.isPaid ?? false,
          name: gym.name,
          description: gym.description,
          images: gym.images ?? [],
          amenities: gym.amenities ?? [],
          lat: gym.lat,
          lng: gym.lng,
          pricePerWeek: gym.pricePerWeek,
          addressStreet: gym.address.street,
          addressSuburb: gym.address.suburb,
          addressState: gym.address.state,
          addressPostcode: gym.address.postcode,
          phone: gym.phone ?? "",
          email: gym.email ?? "",
          website: gym.website ?? "",
          hoursMonday: gym.hours?.monday,
          hoursTuesday: gym.hours?.tuesday,
          hoursWednesday: gym.hours?.wednesday,
          hoursThursday: gym.hours?.thursday,
          hoursFriday: gym.hours?.friday,
          hoursSaturday: gym.hours?.saturday,
          hoursSunday: gym.hours?.sunday,
          memberOffers: gym.memberOffers ?? [],
          memberOffersScroll: gym.memberOffersScroll ?? false,
        });
        if (errs2?.length) {
          console.error(`  ✗  ERROR     ${gym.name}:`, errs2.map((e) => e.message).join(", "));
          errors++;
        } else {
          console.log(`  ✓  NEW       ${gym.name} (${gym.address.suburb}, ${gym.address.state})`);
          if (gym.googlePlaceId) placeIdSet.add(gym.googlePlaceId);
          nameMap.set(key, { id: gym.id, googlePlaceId: gym.googlePlaceId });
          created++;
        }
      } else {
        console.error(`  ✗  ERROR     ${gym.name}:`, errs.map((e) => e.message).join(", "));
        errors++;
      }
    } else {
      console.log(`  ✓  NEW       ${gym.name} (${gym.address.suburb}, ${gym.address.state})`);
      if (gym.googlePlaceId) placeIdSet.add(gym.googlePlaceId);
      nameMap.set(key, { id: gym.id, googlePlaceId: gym.googlePlaceId });
      created++;
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`  Created   : ${created}`);
  console.log(`  Backfilled: ${backfilled}`);
  console.log(`  Skipped   : ${skipped}`);
  console.log(`  Errors    : ${errors}`);
  console.log(`  Total     : ${gyms.length}`);
  console.log(`─────────────────────────────\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
