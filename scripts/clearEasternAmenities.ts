/**
 * scripts/clearEasternAmenities.ts
 * Clears amenities (sets to []) for all non-WA gyms in DynamoDB.
 * Safe to re-run — WA gyms are untouched.
 *
 * Usage:
 *   npx tsx scripts/clearEasternAmenities.ts
 */

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { createRequire } from "module";
import type { Schema } from "../amplify/data/resource.js";

const require = createRequire(import.meta.url);
const outputs = require("../amplify_outputs.json");

Amplify.configure(outputs);

const client = generateClient<Schema>({ authMode: "apiKey" });

async function run() {
  let nextToken: string | null | undefined;
  let cleared = 0;
  let skipped = 0;
  let errors = 0;
  let total = 0;

  process.stdout.write("Fetching gyms from DynamoDB");

  const records: { id: string; addressState?: string | null; name?: string | null }[] = [];

  do {
    const res = await client.models.Gym.list({ limit: 1000, nextToken });
    records.push(...(res.data ?? []).map((g) => ({ id: g.id, addressState: g.addressState, name: g.name })));
    nextToken = res.nextToken;
    process.stdout.write(".");
  } while (nextToken);

  console.log(` done. ${records.length} gyms loaded.\n`);
  total = records.length;

  for (const gym of records) {
    const state = gym.addressState ?? "";

    if (state === "WA") {
      skipped++;
      continue;
    }

    const { errors: errs } = await client.models.Gym.update({
      id: gym.id,
      amenities: [],
    });

    if (errs?.length) {
      console.error(`  ✗  ERROR  ${gym.name} (${state}): ${errs.map((e) => e.message).join(", ")}`);
      errors++;
    } else {
      console.log(`  ✓  CLEARED  ${gym.name} (${state})`);
      cleared++;
    }
  }

  console.log(`\n─────────────────────────────`);
  console.log(`  Cleared (non-WA): ${cleared}`);
  console.log(`  Skipped (WA)    : ${skipped}`);
  console.log(`  Errors          : ${errors}`);
  console.log(`  Total           : ${total}`);
  console.log(`─────────────────────────────\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
