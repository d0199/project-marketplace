/**
 * scripts/findDuplicates.ts
 * Scans all gyms in DynamoDB and flags potential duplicates based on:
 *   1. Same googlePlaceId                      → EXACT match
 *   2. Same lat/lng (within 50m)               → LOCATION match
 *   3. Similar name + same suburb/postcode     → FUZZY match (≥80% name similarity)
 *
 * Usage:
 *   npx tsx scripts/findDuplicates.ts
 *   npx tsx scripts/findDuplicates.ts --threshold 0.7   # lower similarity bar
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
// Levenshtein distance
// ---------------------------------------------------------------------------
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Haversine distance in metres
function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
interface GymRow {
  id: string;
  name: string;
  normName: string;
  suburb: string;
  postcode: string;
  state: string;
  lat: number;
  lng: number;
  googlePlaceId?: string | null;
  ownerId: string;
}

interface DuplicatePair {
  reason: string;
  score?: number;
  a: GymRow;
  b: GymRow;
}

async function run() {
  const thresholdArg = process.argv.find((a) => a.startsWith("--threshold"));
  const THRESHOLD = thresholdArg ? parseFloat(thresholdArg.split("=")[1] ?? "0.8") : 0.8;

  // Fetch all gyms
  process.stdout.write("Fetching gyms from DynamoDB");
  const records: GymRow[] = [];
  let nextToken: string | null | undefined;

  do {
    const res = await client.models.Gym.list({ limit: 1000, nextToken });
    for (const g of res.data ?? []) {
      records.push({
        id: g.id,
        name: g.name ?? "",
        normName: normalise(g.name ?? ""),
        suburb: (g.addressSuburb ?? "").toLowerCase(),
        postcode: g.addressPostcode ?? "",
        state: g.addressState ?? "",
        lat: g.lat ?? 0,
        lng: g.lng ?? 0,
        googlePlaceId: g.googlePlaceId,
        ownerId: g.ownerId ?? "",
      });
    }
    nextToken = res.nextToken;
    process.stdout.write(".");
  } while (nextToken);

  console.log(` done. ${records.length} gyms loaded.\n`);

  const duplicates: DuplicatePair[] = [];
  const seen = new Set<string>();

  function pairKey(a: GymRow, b: GymRow) {
    return [a.id, b.id].sort().join("|");
  }

  function addPair(pair: DuplicatePair) {
    const key = pairKey(pair.a, pair.b);
    if (!seen.has(key)) {
      seen.add(key);
      duplicates.push(pair);
    }
  }

  // 1. Same googlePlaceId
  const byPlaceId = new Map<string, GymRow[]>();
  for (const g of records) {
    if (g.googlePlaceId) {
      const bucket = byPlaceId.get(g.googlePlaceId) ?? [];
      bucket.push(g);
      byPlaceId.set(g.googlePlaceId, bucket);
    }
  }
  for (const [, bucket] of byPlaceId) {
    if (bucket.length > 1) {
      for (let i = 0; i < bucket.length - 1; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          addPair({ reason: "EXACT — same googlePlaceId", a: bucket[i], b: bucket[j] });
        }
      }
    }
  }

  // 2. Same lat/lng within 50m
  for (let i = 0; i < records.length - 1; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i], b = records[j];
      if (a.lat === 0 || b.lat === 0) continue;
      const dist = distanceMetres(a.lat, a.lng, b.lat, b.lng);
      if (dist <= 50) {
        addPair({ reason: `LOCATION — ${Math.round(dist)}m apart`, a, b });
      }
    }
  }

  // 3. Fuzzy name match within same suburb+state or postcode
  // Group by postcode (primary) and suburb+state (secondary) for efficiency
  const byPostcode = new Map<string, GymRow[]>();
  for (const g of records) {
    const key = g.postcode || `${g.suburb}|${g.state}`;
    const bucket = byPostcode.get(key) ?? [];
    bucket.push(g);
    byPostcode.set(key, bucket);
  }

  for (const [, bucket] of byPostcode) {
    for (let i = 0; i < bucket.length - 1; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i], b = bucket[j];
        if (!a.normName || !b.normName) continue;
        const score = similarity(a.normName, b.normName);
        if (score >= THRESHOLD) {
          addPair({ reason: `FUZZY — ${Math.round(score * 100)}% name match`, score, a, b });
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------
  if (duplicates.length === 0) {
    console.log("✓ No potential duplicates found.");
    return;
  }

  // Sort: EXACT first, then LOCATION, then FUZZY by score desc
  duplicates.sort((a, b) => {
    const rank = (r: string) => r.startsWith("EXACT") ? 0 : r.startsWith("LOCATION") ? 1 : 2;
    if (rank(a.reason) !== rank(b.reason)) return rank(a.reason) - rank(b.reason);
    return (b.score ?? 1) - (a.score ?? 1);
  });

  console.log(`Found ${duplicates.length} potential duplicate pair${duplicates.length !== 1 ? "s" : ""}:\n`);
  console.log("─".repeat(90));

  for (const dup of duplicates) {
    console.log(`\n⚠  ${dup.reason}`);
    console.log(`   A: [${dup.a.id}]  ${dup.a.name}  (${dup.a.suburb}, ${dup.a.state} ${dup.a.postcode})  owner: ${dup.a.ownerId}`);
    console.log(`   B: [${dup.b.id}]  ${dup.b.name}  (${dup.b.suburb}, ${dup.b.state} ${dup.b.postcode})  owner: ${dup.b.ownerId}`);
  }

  console.log("\n" + "─".repeat(90));
  const exact = duplicates.filter((d) => d.reason.startsWith("EXACT")).length;
  const location = duplicates.filter((d) => d.reason.startsWith("LOCATION")).length;
  const fuzzy = duplicates.filter((d) => d.reason.startsWith("FUZZY")).length;
  console.log(`\n  EXACT (same Place ID) : ${exact}`);
  console.log(`  LOCATION (≤50m apart) : ${location}`);
  console.log(`  FUZZY (≥${Math.round(THRESHOLD * 100)}% name)    : ${fuzzy}`);
  console.log(`  Total pairs           : ${duplicates.length}\n`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
