// Merge new gyms from gyms_new.csv into staging DynamoDB table.
//
// Filters: businessStatus=OPERATIONAL, classification=GYM
// Dedup: googlePlaceId first, then name+postcode fallback
//
// Usage:
//   npx tsx scripts/merge-new-gyms.ts              # dry-run (preview only)
//   npx tsx scripts/merge-new-gyms.ts --apply       # actually write to DynamoDB

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STAGING_TABLE = "Gym-qanzfeewlfeklctnhoskryahti-NONE";
const CSV_FILE = path.join(__dirname, "..", "data", "gyms_new.csv");
const apply = process.argv.includes("--apply");

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-southeast-2" }),
  { marshallOptions: { removeUndefinedValues: true } }
);

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes;
    } else if (line[i] === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += line[i];
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => (row[h] = fields[idx] ?? ""));
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Normalize for fuzzy matching
// ---------------------------------------------------------------------------
function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Scan all staging gyms
// ---------------------------------------------------------------------------
async function scanAllGyms(): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({ TableName: STAGING_TABLE, ExclusiveStartKey: lastKey })
    );
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

// ---------------------------------------------------------------------------
// Build dedup indexes from existing staging data
// ---------------------------------------------------------------------------
function buildIndexes(gyms: Record<string, unknown>[]) {
  const byPlaceId = new Map<string, string>();
  const byNamePostcode = new Map<string, string>();

  for (const g of gyms) {
    const id = g.id as string;
    if (g.googlePlaceId && typeof g.googlePlaceId === "string") {
      byPlaceId.set(g.googlePlaceId, id);
    }
    const name = normalize(String(g.name || ""));
    const postcode = String(g.addressPostcode || "").trim();
    if (name && postcode) {
      byNamePostcode.set(`${name}|${postcode}`, id);
    }
  }
  return { byPlaceId, byNamePostcode };
}

// ---------------------------------------------------------------------------
// Map CSV row to DynamoDB item
// ---------------------------------------------------------------------------
function csvToGymItem(row: Record<string, string>): Record<string, unknown> {
  const now = new Date().toISOString();
  const item: Record<string, unknown> = {
    id: `gym-${randomUUID().slice(0, 8)}`,
    ownerId: "unclaimed",
    name: row.name || "",
    isActive: true,
    lat: parseFloat(row.lat) || 0,
    lng: parseFloat(row.lng) || 0,
    addressStreet: row.addressStreet || undefined,
    addressSuburb: row.addressSuburb || undefined,
    addressState: row.addressState || undefined,
    addressPostcode: row.addressPostcode || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
    website: row.website || undefined,
    googlePlaceId: row.googlePlaceId || undefined,
    googleMapsUrl: row.googleMapsUrl || undefined,
    description: row.description || undefined,
    hoursMonday: row.hoursMonday || undefined,
    hoursTuesday: row.hoursTuesday || undefined,
    hoursWednesday: row.hoursWednesday || undefined,
    hoursThursday: row.hoursThursday || undefined,
    hoursFriday: row.hoursFriday || undefined,
    hoursSaturday: row.hoursSaturday || undefined,
    hoursSunday: row.hoursSunday || undefined,
    createdBy: "bulk-google",
    createdAt: now,
    updatedAt: now,
  };

  // Remove empty string values on GSI key fields
  if (!item.addressPostcode || String(item.addressPostcode).trim() === "") {
    delete item.addressPostcode;
  }
  if (!item.ownerId || String(item.ownerId).trim() === "") {
    delete item.ownerId;
  }

  // Remove undefined values
  for (const key of Object.keys(item)) {
    if (item[key] === undefined || item[key] === "") {
      delete item[key];
    }
  }

  return item;
}

// ---------------------------------------------------------------------------
// Batch write to DynamoDB (25 items per batch)
// ---------------------------------------------------------------------------
async function batchPut(items: Record<string, unknown>[]) {
  const BATCH_SIZE = 25;
  let written = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [STAGING_TABLE]: batch.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      })
    );
    written += batch.length;
    if (written % 500 === 0 || written === items.length) {
      console.log(`  Written ${written}/${items.length}`);
    }
  }
  return written;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log("");

  // 1. Read CSV
  console.log("Reading gyms_new.csv...");
  const allRows = parseCSV(CSV_FILE);
  console.log(`  Total rows: ${allRows.length}`);

  // 2. Filter: OPERATIONAL + GYM classification
  const filtered = allRows.filter(
    (r) => r.businessStatus === "OPERATIONAL" && r.classification === "GYM"
  );
  console.log(`  After filter (OPERATIONAL + GYM): ${filtered.length}`);

  // 3. Filter out rows without postcode (can't be searched)
  const withPostcode = filtered.filter(
    (r) => r.addressPostcode && r.addressPostcode.trim().length === 4
  );
  console.log(`  With valid postcode: ${withPostcode.length}`);
  console.log("");

  // 4. Scan staging DynamoDB for dedup
  console.log("Scanning staging DynamoDB for dedup...");
  const existingGyms = await scanAllGyms();
  console.log(`  Existing staging gyms: ${existingGyms.length}`);

  const { byPlaceId, byNamePostcode } = buildIndexes(existingGyms);
  console.log(`  PlaceId index: ${byPlaceId.size} entries`);
  console.log(`  Name+Postcode index: ${byNamePostcode.size} entries`);
  console.log("");

  // 5. Dedup
  let dupePlaceId = 0;
  let dupeNamePostcode = 0;
  const newGyms: Record<string, string>[] = [];

  for (const row of withPostcode) {
    // Check googlePlaceId first
    if (row.googlePlaceId && byPlaceId.has(row.googlePlaceId)) {
      dupePlaceId++;
      continue;
    }

    // Check name + postcode
    const key = `${normalize(row.name)}|${row.addressPostcode.trim()}`;
    if (byNamePostcode.has(key)) {
      dupeNamePostcode++;
      continue;
    }

    newGyms.push(row);

    // Add to indexes so we don't insert duplicates from within the CSV itself
    if (row.googlePlaceId) {
      byPlaceId.set(row.googlePlaceId, "new");
    }
    byNamePostcode.set(key, "new");
  }

  console.log(`Dedup results:`);
  console.log(`  Duplicates by googlePlaceId: ${dupePlaceId}`);
  console.log(`  Duplicates by name+postcode: ${dupeNamePostcode}`);
  console.log(`  New gyms to insert: ${newGyms.length}`);
  console.log("");

  if (!apply) {
    // Show sample of new gyms
    console.log("Sample new gyms (first 20):");
    for (const g of newGyms.slice(0, 20)) {
      console.log(
        `  ${g.name} | ${g.addressSuburb} ${g.addressState} ${g.addressPostcode}`
      );
    }
    console.log("");
    console.log("Run with --apply to insert into staging DynamoDB.");
    return;
  }

  // 6. Convert and batch write
  console.log("Converting and writing to DynamoDB...");
  const items = newGyms.map(csvToGymItem);
  const written = await batchPut(items);
  console.log("");
  console.log(`Done! Inserted ${written} new gyms into staging.`);
}

main().catch(console.error);
