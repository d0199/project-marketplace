// Copy all gyms from staging to prod DynamoDB table.
// Deletes all prod gyms first, then copies staging data.
//
// Usage:
//   npx tsx scripts/copy-staging-to-prod.ts              # dry-run
//   npx tsx scripts/copy-staging-to-prod.ts --apply       # actually write

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb";

const STAGING_TABLE = "Gym-qanzfeewlfeklctnhoskryahti-NONE";
const PROD_TABLE = "Gym-xofowsmrxvebxmdjijmijtz5bq-NONE";
const REGION = "ap-southeast-2";
const APPLY = process.argv.includes("--apply");

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

async function scanAll(table: string): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey })
    );
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function batchDelete(table: string, ids: string[]) {
  const BATCH = 25;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [table]: batch.map((id) => ({
            DeleteRequest: { Key: { id } },
          })),
        },
      })
    );
    const done = Math.min(i + BATCH, ids.length);
    if (done % 500 === 0 || done === ids.length) {
      console.log(`  Deleted ${done}/${ids.length}`);
    }
  }
}

async function batchPut(table: string, items: Record<string, unknown>[]) {
  const BATCH = 25;
  let fixed = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map((item) => {
      const copy = { ...item };
      // DynamoDB rejects empty strings on GSI key attributes
      if (copy.addressPostcode === "") { delete copy.addressPostcode; fixed++; }
      if (copy.ownerId === "") { delete copy.ownerId; fixed++; }
      return copy;
    });
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [table]: batch.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      })
    );
    const done = Math.min(i + BATCH, items.length);
    if (done % 500 === 0 || done === items.length) {
      console.log(`  Written ${done}/${items.length}`);
    }
  }
  if (fixed > 0) console.log(`  Fixed ${fixed} empty GSI key(s)`);
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  // 1. Scan staging
  console.log("Scanning staging table...");
  const stagingGyms = await scanAll(STAGING_TABLE);
  console.log(`  Staging gyms: ${stagingGyms.length}`);

  // 2. Scan prod
  console.log("Scanning prod table...");
  const prodGyms = await scanAll(PROD_TABLE);
  console.log(`  Prod gyms: ${prodGyms.length}`);

  console.log(`\nPlan: Delete ${prodGyms.length} prod gyms, copy ${stagingGyms.length} from staging\n`);

  if (!APPLY) {
    console.log("DRY-RUN — no changes made. Run with --apply to execute.");
    return;
  }

  // 3. Delete all prod gyms
  console.log("Deleting all prod gyms...");
  await batchDelete(PROD_TABLE, prodGyms.map((g) => g.id as string));
  console.log("  Done.\n");

  // 4. Copy staging to prod
  console.log("Copying staging to prod...");
  await batchPut(PROD_TABLE, stagingGyms);
  console.log("  Done.\n");

  // 5. Verify
  const newProd = await scanAll(PROD_TABLE);
  console.log(`Verification: Prod now has ${newProd.length} gyms (was ${prodGyms.length})`);
}

main().catch(console.error);
