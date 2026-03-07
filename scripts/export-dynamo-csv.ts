// Export all gyms from DynamoDB to data/gyms_dynamo.csv
// Run with: npx tsx scripts/export-dynamo-csv.ts

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { createRequire } from "module";
import fs from "fs";
import type { Schema } from "../amplify/data/resource.js";

const require = createRequire(import.meta.url);
const outputs = require("../amplify_outputs.json");

Amplify.configure(outputs);

const client = generateClient<Schema>({ authMode: "apiKey" });

function escape(v: unknown): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

async function exportGyms() {
  const allGyms: Schema["Gym"]["type"][] = [];
  let nextToken: string | null = null;

  do {
    const page = await client.models.Gym.list({
      limit: 1000,
      ...(nextToken ? { nextToken } : {}),
    });

    if (page.errors?.length) {
      console.error("Error fetching gyms:", page.errors);
      process.exit(1);
    }

    allGyms.push(...page.data);
    nextToken = page.nextToken ?? null;
    console.log(`Fetched ${allGyms.length} gyms so far…`);
  } while (nextToken);

  console.log(`Total: ${allGyms.length} gyms`);

  const headers = [
    "id", "googlePlaceId", "name", "ownerId", "createdBy",
    "addressStreet", "addressSuburb", "addressState", "addressPostcode",
    "phone", "email", "website", "instagram", "facebook", "bookingUrl",
    "lat", "lng", "pricePerWeek",
    "amenities",
    "isActive", "isFeatured", "isTest", "priceVerified", "isPaid",
    "stripePlan", "stripeSubscriptionId",
    "hoursMonday", "hoursTuesday", "hoursWednesday", "hoursThursday",
    "hoursFriday", "hoursSaturday", "hoursSunday", "hoursComment",
    "imageCount", "description",
  ];

  const rows = allGyms.map((g) => {
    const record: Record<string, unknown> = {
      ...g,
      amenities: (g.amenities ?? []).join("|"),
      imageCount: (g.images ?? []).length,
    };
    return headers.map((h) => escape(record[h])).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  fs.writeFileSync("./data/gyms_dynamo.csv", csv);
  console.log(`Written ${allGyms.length} rows to data/gyms_dynamo.csv`);
}

exportGyms().catch((err) => {
  console.error(err);
  process.exit(1);
});
