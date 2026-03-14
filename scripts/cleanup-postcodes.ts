// Remove postcodes outside valid Australian ranges from DynamoDB
//   npx tsx scripts/cleanup-postcodes.ts

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = "Postcode-qanzfeewlfeklctnhoskryahti-NONE";
const REGION = "ap-southeast-2";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

function isValidPostcode(postcode: string): boolean {
  const n = parseInt(postcode, 10);
  if (isNaN(n)) return false;

  // NT: 0800–0899
  if (n >= 800 && n <= 899) return true;
  // NSW: 2000–2599, 2619–2899, 2921–2999
  if (n >= 2000 && n <= 2599) return true;
  if (n >= 2619 && n <= 2899) return true;
  if (n >= 2921 && n <= 2999) return true;
  // ACT: 2600–2618, 2900–2920
  if (n >= 2600 && n <= 2618) return true;
  if (n >= 2900 && n <= 2920) return true;
  // VIC: 3000–3996
  if (n >= 3000 && n <= 3996) return true;
  // QLD: 4000–4999
  if (n >= 4000 && n <= 4999) return true;
  // SA: 5000–5799
  if (n >= 5000 && n <= 5799) return true;
  // WA: 6000–6797
  if (n >= 6000 && n <= 6797) return true;
  // TAS: 7000–7799
  if (n >= 7000 && n <= 7799) return true;

  return false;
}

async function cleanup() {
  // Scan all items
  const toDelete: { postcode: string; suburb: string }[] = [];
  let scanned = 0;
  let lastKey: Record<string, unknown> | undefined;

  do {
    const res = await ddb.send(new ScanCommand({
      TableName: TABLE,
      ProjectionExpression: "postcode, suburb",
      ExclusiveStartKey: lastKey,
    }));
    for (const item of res.Items ?? []) {
      scanned++;
      if (!isValidPostcode(item.postcode as string)) {
        toDelete.push({ postcode: item.postcode as string, suburb: item.suburb as string });
      }
    }
    lastKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  console.log(`Scanned ${scanned} items, ${toDelete.length} outside valid ranges`);

  if (toDelete.length === 0) {
    console.log("Nothing to delete.");
    return;
  }

  // Show sample of what will be deleted
  const sample = toDelete.slice(0, 10);
  console.log(`\nSample deletions:`);
  for (const d of sample) console.log(`  ${d.postcode} — ${d.suburb}`);
  if (toDelete.length > 10) console.log(`  ... and ${toDelete.length - 10} more\n`);

  // BatchWrite deletes in groups of 25
  const BATCH = 25;
  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    const params = {
      RequestItems: {
        [TABLE]: batch.map((item) => ({
          DeleteRequest: { Key: { postcode: item.postcode, suburb: item.suburb } },
        })),
      },
    };

    let unprocessed = params.RequestItems;
    let attempt = 0;
    while (unprocessed && Object.values(unprocessed).some((v) => v.length > 0)) {
      const result = await ddb.send(new BatchWriteCommand({ RequestItems: unprocessed }));
      const remaining = result.UnprocessedItems?.[TABLE]?.length ?? 0;
      deleted += batch.length - remaining;
      if (remaining > 0) {
        attempt++;
        await new Promise((r) => setTimeout(r, Math.min(100 * 2 ** attempt, 5000)));
        unprocessed = result.UnprocessedItems as typeof unprocessed;
      } else {
        break;
      }
    }

    if ((deleted % 500 < BATCH) || i + BATCH >= toDelete.length) {
      console.log(`  ${deleted} / ${toDelete.length} deleted...`);
    }
  }

  console.log(`\nDone! Deleted ${deleted} invalid postcodes. ${scanned - deleted} remain.`);
}

cleanup().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
