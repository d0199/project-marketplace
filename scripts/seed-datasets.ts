/**
 * Seed datasets (specialties, amenities, member-offers) into DynamoDB.
 * Run: npx tsx scripts/seed-datasets.ts
 */
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import outputs from "../amplify_outputs.json";
import { ALL_SPECIALTIES, ALL_AMENITIES, ALL_MEMBER_OFFERS, REPORT_ISSUE_TYPES } from "../src/lib/utils";

Amplify.configure(outputs as Parameters<typeof Amplify.configure>[0], { ssr: true });
const client = generateClient<Schema>({ authMode: "apiKey" });

const DATASETS: Record<string, string[]> = {
  specialties: [...ALL_SPECIALTIES],
  amenities: [...ALL_AMENITIES],
  "member-offers": [...ALL_MEMBER_OFFERS],
  "report-issues": [...REPORT_ISSUE_TYPES],
};

async function upsert(name: string, entries: string[]) {
  const { data: existing } = await client.models.Dataset.list({
    filter: { name: { eq: name } },
    limit: 1,
  });

  if (existing && existing.length > 0) {
    console.log(`"${name}" exists (${existing[0].entries?.length ?? 0} entries). Updating...`);
    await client.models.Dataset.update({ id: existing[0].id, entries });
    console.log(`  Updated with ${entries.length} entries.`);
  } else {
    await client.models.Dataset.create({ name, entries });
    console.log(`  Created "${name}" with ${entries.length} entries.`);
  }
}

async function main() {
  for (const [name, entries] of Object.entries(DATASETS)) {
    await upsert(name, entries);
  }
  console.log("Done.");
}

main().catch(console.error);
