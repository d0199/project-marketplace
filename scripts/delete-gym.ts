import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-southeast-2" }));
const STAGING_TABLE = "Gym-qanzfeewlfeklctnhoskryahti-NONE";
const id = "gym-1046";

async function main() {
  const before = await ddb.send(new GetCommand({ TableName: STAGING_TABLE, Key: { id } }));
  console.log(`Before delete: ${before.Item ? "EXISTS" : "NOT FOUND"}`);

  if (before.Item) {
    await ddb.send(new DeleteCommand({ TableName: STAGING_TABLE, Key: { id } }));
    console.log("Delete command sent");

    const after = await ddb.send(new GetCommand({ TableName: STAGING_TABLE, Key: { id } }));
    console.log(`After delete: ${after.Item ? "STILL EXISTS" : "CONFIRMED DELETED"}`);
  }
}

main().catch(console.error);
