// Add curated specialties to the Dataset DynamoDB table (prod + staging)

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-southeast-2" }),
  { marshallOptions: { removeUndefinedValues: true } }
);

const PROD_DATASET = "Dataset-xofowsmrxvebxmdjijmijtz5bq-NONE";
const STAGING_DATASET = "Dataset-qanzfeewlfeklctnhoskryahti-NONE";

const NEW_SPECIALTIES = [
  // Pilates variants
  "Reformer Pilates",
  "Mat Pilates",
  "Clinical Pilates",
  "Hot Pilates",
  "Barre",
  "Prenatal Pilates",
  // Strength / Training
  "Strength & Conditioning",
  "Bootcamp",
  "Kettlebell Training",
  // Yoga variants
  "Yin Yoga",
  "Vinyasa Yoga",
  "Hatha Yoga",
  "Hot Yoga",
  "Restorative Yoga",
  "Aerial Yoga",
  "Meditation",
  // Combat / Martial Arts
  "Martial Arts",
  "Brazilian Jiu Jitsu",
  "Mixed Martial Arts",
  "Karate",
  "Taekwondo",
  "Krav Maga",
  "Self Defence",
  // Rehab / Health
  "Rehab",
  "Exercise Physiology",
  "Physiotherapy",
  "Nutrition Coaching",
  "Women's Health",
  // Cardio / Specialty
  "Spin/Cycle",
  "Hyrox",
  "EMS Training",
  "Dance Fitness",
  "Aqua Fitness",
  // Wellness
  "Breathwork",
  "Sound Healing",
  "Infrared Sauna",
  "Cold Plunge",
  "Tai Chi",
];

async function updateDataset(table: string) {
  // Find the specialties dataset record
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  const specRecord = items.find((d) => d.name === "specialties");
  if (!specRecord) {
    console.log(`  No specialties dataset found in ${table}`);
    return;
  }

  const existing = new Set<string>((specRecord.entries as string[]) ?? []);
  const toAdd = NEW_SPECIALTIES.filter((s) => !existing.has(s));

  if (toAdd.length === 0) {
    console.log(`  All already present in ${table}`);
    return;
  }

  const merged = [...existing, ...toAdd].sort();

  await ddb.send(new UpdateCommand({
    TableName: table,
    Key: { id: specRecord.id as string },
    UpdateExpression: "SET entries = :entries, updatedAt = :now",
    ExpressionAttributeValues: {
      ":entries": merged,
      ":now": new Date().toISOString(),
    },
  }));

  console.log(`  ${table}: added ${toAdd.length} specialties (${existing.size} → ${merged.length})`);
}

async function main() {
  console.log(`Adding ${NEW_SPECIALTIES.length} specialties to datasets...\n`);
  await updateDataset(PROD_DATASET);
  await updateDataset(STAGING_DATASET);
  console.log("\nDone.");
}

main().catch(console.error);
