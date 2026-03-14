import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-southeast-2" }));
const TABLE = "Gym-xofowsmrxvebxmdjijmijtz5bq-NONE";

async function main() {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey: lastKey }));
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  const noPostcode = items.filter(
    (g) => !g.addressPostcode || String(g.addressPostcode).trim() === ""
  );

  console.log(`Total gyms: ${items.length}`);
  console.log(`Without postcode: ${noPostcode.length}`);
  console.log("");

  for (const g of noPostcode) {
    console.log(
      [g.id, g.name || "(no name)", g.addressState || "", g.addressSuburb || "", g.addressStreet || ""].join(" | ")
    );
  }
}

main().catch(console.error);
