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
  const withSite = items.filter((g) => g.website && String(g.website).length > 5 && !g.adminEdited);
  const edited = items.filter((g) => g.adminEdited);
  const noSite = items.filter((g) => !g.website || String(g.website).length <= 5);
  console.log(`Total prod gyms: ${items.length}`);
  console.log(`With website + not admin-edited: ${withSite.length} (will enrich)`);
  console.log(`Admin-edited (will skip): ${edited.length}`);
  console.log(`No website (will skip): ${noSite.length}`);
}
main().catch(console.error);
