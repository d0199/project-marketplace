/**
 * scripts/importGyms.ts
 * Bulk-imports gyms from a JSON file into DynamoDB, skipping any that already exist.
 *
 * Deduplication logic (in order):
 *   1. googlePlaceId match — reliable, works for any gym fetched via Google Places
 *   2. Normalised name + state match — fallback for older records without a Place ID
 *
 * Usage:
 *   npx tsx scripts/importGyms.ts                          # imports data/gyms_eastern.json
 *   npx tsx scripts/importGyms.ts data/gyms.json           # re-import WA data safely
 *   npx tsx scripts/importGyms.ts data/gyms_eastern.json
 *
 * Safe to re-run — duplicates are skipped, not overwritten.
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

async function fetchAllExisting() {
  const placeIds = new Set<string>();
  const nameKeys = new Set<string>();
  let nextToken: string | null | undefined;

  process.stdout.write("Fetching existing gyms from DynamoDB");
  do {
    const res = await client.models.Gym.list({ limit: 1000, nextToken });
    for (const g of res.data ?? []) {
      if (g.googlePlaceId) placeIds.add(g.googlePlaceId);
      if (g.name && g.addressState) nameKeys.add(normalise(g.name, g.addressState));
    }
    nextToken = res.nextToken;
    process.stdout.write(".");
  } while (nextToken);

  console.log(` done. Found ${placeIds.size} place IDs, ${nameKeys.size} name keys.`);
  return { placeIds, nameKeys };
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
  const filePath = process.argv[2] ?? "data/gyms_eastern.json";

  let gyms: GymJson[];
  try {
    gyms = require(`../${filePath}`);
  } catch {
    console.error(`Could not load ${filePath}`);
    process.exit(1);
  }

  console.log(`\nImporting from ${filePath} (${gyms.length} records)\n`);

  const { placeIds, nameKeys } = await fetchAllExisting();

  let skipped = 0;
  let created = 0;
  let errors = 0;

  for (const gym of gyms) {
    // --- Dedup check ---
    const byPlaceId = gym.googlePlaceId && placeIds.has(gym.googlePlaceId);
    const byName    = nameKeys.has(normalise(gym.name, gym.address.state));

    if (byPlaceId || byName) {
      const reason = byPlaceId ? "place ID" : "name+state";
      console.log(`  ⟳  SKIP  ${gym.name} (${gym.address.state}) — matched by ${reason}`);
      skipped++;
      continue;
    }

    // --- Insert ---
    const { errors: errs } = await client.models.Gym.create({
      id: gym.id,
      // googlePlaceId omitted until Amplify backend redeploys with new schema field
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
      console.error(`  ✗  ERROR  ${gym.name}:`, errs.map((e) => e.message).join(", "));
      errors++;
    } else {
      console.log(`  ✓  NEW    ${gym.name} (${gym.address.suburb}, ${gym.address.state})`);
      // Add to seen sets so later records in the same file don't re-insert
      if (gym.googlePlaceId) placeIds.add(gym.googlePlaceId);
      nameKeys.add(normalise(gym.name, gym.address.state));
      created++;
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped}`);
  console.log(`  Errors  : ${errors}`);
  console.log(`  Total   : ${gyms.length}`);
  console.log(`─────────────────────────────\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
