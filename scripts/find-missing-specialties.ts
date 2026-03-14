import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-southeast-2" }));

async function scanAll(table: string) {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function main() {
  // Get dataset specialties
  const datasets = await scanAll("Dataset-xofowsmrxvebxmdjijmijtz5bq-NONE");
  const specDataset = datasets.find((d) => d.name === "specialties");
  const datasetSpecialties = new Set<string>((specDataset?.entries as string[]) ?? []);
  console.log(`Dataset specialties: ${datasetSpecialties.size}`);

  // Get all unique specialties from gyms
  const gyms = await scanAll("Gym-xofowsmrxvebxmdjijmijtz5bq-NONE");
  const gymSpecialties = new Map<string, number>();
  for (const g of gyms) {
    for (const s of (g.specialties as string[]) ?? []) {
      gymSpecialties.set(s, (gymSpecialties.get(s) || 0) + 1);
    }
  }
  console.log(`Unique specialties in gyms: ${gymSpecialties.size}\n`);

  // Find ones not in dataset
  const missing: [string, number][] = [];
  for (const [spec, count] of gymSpecialties) {
    if (!datasetSpecialties.has(spec)) {
      missing.push([spec, count]);
    }
  }
  missing.sort((a, b) => b[1] - a[1]);

  console.log(`Missing from dataset: ${missing.length}\n`);
  console.log("Count | Specialty");
  console.log("------|----------");
  for (const [spec, count] of missing) {
    console.log(`${String(count).padStart(5)} | ${spec}`);
  }
}

main().catch(console.error);
