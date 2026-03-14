// Seed Australian postcodes from CSV into DynamoDB
//   npx tsx scripts/seed-postcodes.ts
//
// CSV format: Postcode,Suburb,State,Lat,Lon

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { readFileSync } from "fs";

const TABLE = "Postcode-2u3r4h7htvbn3i4iqj4dismzeu-NONE";
const REGION = "ap-southeast-2";
const CSV_PATH = "c:/Users/david/Downloads/australian-postcodes - australian-postcodes.csv.csv";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

function parseCSV(path: string) {
  const raw = readFileSync(path, "utf-8");
  const lines = raw.split("\n").filter(Boolean);
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += char;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

async function seed() {
  const rows = parseCSV(CSV_PATH);
  console.log(`Parsed ${rows.length} rows from CSV`);

  const now = new Date().toISOString();
  const items = rows.map((r) => {
    // Pad postcode to 4 digits
    const postcode = r.Postcode.padStart(4, "0");
    return {
      postcode,
      suburb: r.Suburb,
      state: r.State,
      lat: parseFloat(r.Lat),
      lng: parseFloat(r.Lon),
      createdAt: now,
      updatedAt: now,
      __typename: "Postcode",
    };
  });

  // Deduplicate by postcode+suburb (same combo = same DynamoDB item)
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = `${item.postcode}#${item.suburb}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  console.log(`${unique.length} unique postcode+suburb combos (${items.length - unique.length} dupes removed)`);

  // BatchWrite in groups of 25
  const BATCH = 25;
  let written = 0;
  let retries = 0;

  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const params = {
      RequestItems: {
        [TABLE]: batch.map((item) => ({
          PutRequest: { Item: item },
        })),
      },
    };

    let unprocessed = params.RequestItems;
    let attempt = 0;
    while (unprocessed && Object.values(unprocessed).some((v) => v.length > 0)) {
      const result = await ddb.send(new BatchWriteCommand({ RequestItems: unprocessed }));
      const remaining = result.UnprocessedItems?.[TABLE]?.length ?? 0;
      written += batch.length - remaining;
      if (remaining > 0) {
        retries++;
        attempt++;
        // Exponential backoff
        await new Promise((r) => setTimeout(r, Math.min(100 * 2 ** attempt, 5000)));
        unprocessed = result.UnprocessedItems as typeof unprocessed;
      } else {
        break;
      }
    }

    if ((written % 500 < BATCH) || i + BATCH >= unique.length) {
      console.log(`  ${written} / ${unique.length} written...`);
    }
  }

  console.log(`\nDone! ${written} items written to ${TABLE} (${retries} retries)`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
