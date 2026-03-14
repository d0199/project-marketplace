import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-southeast-2" }));

async function main() {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: "Dataset-xofowsmrxvebxmdjijmijtz5bq-NONE", ExclusiveStartKey: lastKey }));
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  const rec = items.find((d) => d.name === "specialties");
  const entries = ((rec?.entries as string[]) ?? []).sort();
  console.log(`Approved specialties (${entries.length}):\n`);
  for (const e of entries) console.log(`  ${e}`);
}
main().catch(console.error);
