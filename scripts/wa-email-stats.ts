import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-southeast-2" }));

async function main() {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: "Gym-xofowsmrxvebxmdjijmijtz5bq-NONE", ExclusiveStartKey: lastKey }));
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  const wa = items.filter((g) => String(g.addressState || "").toUpperCase() === "WA");
  const waEmail = wa.filter((g) => g.email && String(g.email).includes("@"));
  const waNoEmail = wa.filter((g) => !g.email || !String(g.email).includes("@"));
  const waNoEmailHasWebsite = waNoEmail.filter((g) => g.website && String(g.website).length > 5);
  const waNoEmailNoWebsite = waNoEmail.filter((g) => !g.website || String(g.website).length <= 5);

  console.log(`Total WA gyms: ${wa.length}`);
  console.log(`With email: ${waEmail.length}`);
  console.log(`Without email: ${waNoEmail.length}`);
  console.log(`  - has website (could scrape deeper): ${waNoEmailHasWebsite.length}`);
  console.log(`  - no website either: ${waNoEmailNoWebsite.length}`);
}
main().catch(console.error);
