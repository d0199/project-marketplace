/**
 * Seed the "specialties" dataset into DynamoDB.
 * Run: npx tsx scripts/seed-datasets.ts
 */
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import outputs from "../amplify_outputs.json";
import { ALL_SPECIALTIES } from "../src/lib/utils";

Amplify.configure(outputs as Parameters<typeof Amplify.configure>[0], { ssr: true });
const client = generateClient<Schema>({ authMode: "apiKey" });

async function main() {
  // Check if "specialties" already exists
  const { data: existing } = await client.models.Dataset.list({
    filter: { name: { eq: "specialties" } },
    limit: 1,
  });

  if (existing && existing.length > 0) {
    console.log(`"specialties" dataset already exists (${existing[0].entries?.length ?? 0} entries). Updating...`);
    await client.models.Dataset.update({
      id: existing[0].id,
      entries: [...ALL_SPECIALTIES],
    });
    console.log(`Updated with ${ALL_SPECIALTIES.length} entries.`);
  } else {
    await client.models.Dataset.create({
      name: "specialties",
      entries: [...ALL_SPECIALTIES],
    });
    console.log(`Created "specialties" dataset with ${ALL_SPECIALTIES.length} entries.`);
  }
}

main().catch(console.error);
