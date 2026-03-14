// Audit: check all gym/PT postcodes have matching entries in the Postcode table
//   npx tsx scripts/audit-postcodes.ts

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const REGION = "ap-southeast-2";
const POSTCODE_TABLE = "Postcode-qanzfeewlfeklctnhoskryahti-NONE";
const GYM_TABLE = "Gym-qanzfeewlfeklctnhoskryahti-NONE";
const PT_TABLE = "PersonalTrainer-qanzfeewlfeklctnhoskryahti-NONE";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

async function scanAll(table: string, projection: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: table,
      ProjectionExpression: projection,
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(res.Items ?? []) as Record<string, unknown>[]);
    lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);
  return items;
}

async function postcodeExists(postcode: string): Promise<boolean> {
  const res = await ddb.send(new QueryCommand({
    TableName: POSTCODE_TABLE,
    KeyConditionExpression: "postcode = :pc",
    ExpressionAttributeValues: { ":pc": postcode },
    Limit: 1,
  }));
  return (res.Items?.length ?? 0) > 0;
}

async function getPostcodeSuburbs(postcode: string): Promise<string[]> {
  const res = await ddb.send(new QueryCommand({
    TableName: POSTCODE_TABLE,
    KeyConditionExpression: "postcode = :pc",
    ExpressionAttributeValues: { ":pc": postcode },
  }));
  return (res.Items ?? []).map((i) => i.suburb as string);
}

async function audit() {
  // 1. Check specific failing postcodes
  console.log("=== Checking specific failing postcodes ===");
  const testPostcodes = ["6069", "6108", "6109", "6000", "6027", "6155"];
  for (const pc of testPostcodes) {
    const suburbs = await getPostcodeSuburbs(pc);
    console.log(`  ${pc}: ${suburbs.length > 0 ? suburbs.join(", ") : "NOT FOUND"}`);
  }

  // 2. Load all postcodes into a set for fast lookup
  console.log("\n=== Loading Postcode table ===");
  const allPostcodes = await scanAll(POSTCODE_TABLE, "postcode, suburb");
  const postcodeSet = new Set<string>();
  for (const item of allPostcodes) postcodeSet.add(item.postcode as string);
  console.log(`  ${postcodeSet.size} unique postcodes in Postcode table`);

  // 3. Check all gyms
  console.log("\n=== Checking Gyms ===");
  const gyms2 = await scanAll(GYM_TABLE, "id, addressPostcode, addressSuburb, isActive, isTest");
  console.log(`  ${gyms2.length} total gyms`);

  const gymMissing: { id: string; postcode: string; suburb: string }[] = [];
  for (const g of gyms2) {
    const pc = g.addressPostcode as string;
    if (pc && !postcodeSet.has(pc)) {
      gymMissing.push({ id: g.id as string, postcode: pc, suburb: g.addressSuburb as string });
    }
  }
  if (gymMissing.length === 0) {
    console.log("  All gym postcodes have matching entries in Postcode table");
  } else {
    console.log(`  ${gymMissing.length} gyms with unmatched postcodes:`);
    for (const g of gymMissing) {
      console.log(`    ${g.postcode} — ${g.suburb} (gym ${g.id})`);
    }
  }

  // 4. Check all PTs
  console.log("\n=== Checking PTs ===");
  const pts = await scanAll(PT_TABLE, "id, addressPostcode, addressSuburb, isActive, isTest");
  console.log(`  ${pts.length} total PTs`);

  const ptMissing: { id: string; postcode: string; suburb: string }[] = [];
  for (const p of pts) {
    const pc = p.addressPostcode as string;
    if (pc && !postcodeSet.has(pc)) {
      ptMissing.push({ id: p.id as string, postcode: pc, suburb: p.addressSuburb as string });
    }
  }
  if (ptMissing.length === 0) {
    console.log("  All PT postcodes have matching entries in Postcode table");
  } else {
    console.log(`  ${ptMissing.length} PTs with unmatched postcodes:`);
    for (const p of ptMissing) {
      console.log(`    ${p.postcode} — ${p.suburb} (PT ${p.id})`);
    }
  }

  // 5. Check PT service areas
  console.log("\n=== Checking PT Service Areas ===");
  const ptsWithAreas = await scanAll(PT_TABLE, "id, addressSuburb, serviceAreas");
  let saTotal = 0;
  const saMissing: { ptId: string; postcode: string }[] = [];
  for (const p of ptsWithAreas) {
    const areas = p.serviceAreas as string[] | undefined;
    if (!areas) continue;
    for (const pc of areas) {
      saTotal++;
      if (!postcodeSet.has(pc)) {
        saMissing.push({ ptId: p.id as string, postcode: pc });
      }
    }
  }
  console.log(`  ${saTotal} service area entries across all PTs`);
  if (saMissing.length === 0) {
    console.log("  All service area postcodes have matching entries in Postcode table");
  } else {
    console.log(`  ${saMissing.length} unmatched service area postcodes:`);
    for (const s of saMissing) {
      console.log(`    ${s.postcode} (PT ${s.ptId})`);
    }
  }

  // 6. Summary
  console.log("\n=== Summary ===");
  console.log(`  Postcode table: ${postcodeSet.size} unique postcodes`);
  console.log(`  Gyms: ${gyms2.length} total, ${gymMissing.length} with unmatched postcodes`);
  console.log(`  PTs: ${pts.length} total, ${ptMissing.length} with unmatched postcodes`);
  console.log(`  Service areas: ${saTotal} entries, ${saMissing.length} unmatched`);
}

audit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
