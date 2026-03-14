// Clean up gym specialty tags in DynamoDB:
// 1. Map known variants → approved specialty names
// 2. Remove unapproved tags entirely
// 3. Deduplicate
//
// Usage:
//   npx tsx scripts/cleanup-specialties.ts              # dry-run (report only)
//   npx tsx scripts/cleanup-specialties.ts --apply      # actually write changes

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const REGION = "ap-southeast-2";
const APPLY = process.argv.includes("--apply");
const PROD_TABLE = "Gym-xofowsmrxvebxmdjijmijtz5bq-NONE";
const STAGING_TABLE = "Gym-qanzfeewlfeklctnhoskryahti-NONE";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION }),
  { marshallOptions: { removeUndefinedValues: true } }
);

// ── Manual variant → approved mapping ──
// Multi-value entries use arrays (tag splits into multiple approved tags)
const VARIANT_MAP: Record<string, string | string[]> = {
  // Case variants of approved tags
  "strength and conditioning": "Strength & Conditioning",
  "strength & conditioning": "Strength & Conditioning",
  "functional training": "Functional Training",
  "circuit training": "Circuit Training",
  "meditation": "Meditation",
  "boxing": "Boxing",
  "rehab": "Rehab",
  "yoga": "Yoga",
  "gymnastics": "Gymnastics",
  "parkour": "Parkour",
  "bodybuilding": "Bodybuilding",
  "hatha yoga": "Hatha Yoga",
  "yin yoga": "Yin Yoga",
  "vinyasa yoga": "Vinyasa Yoga",
  "Olympic lifting": "Olympic Lifting",
  "EMS training": "EMS Training",

  // Yoga/Pilates combo → both
  "Yoga/Pilates": ["Yoga", "Pilates"],
  "yoga/pilates": ["Yoga", "Pilates"],
  "Yoga/pilates": ["Yoga", "Pilates"],

  // Pilates variants
  "Reform Pilates": "Reformer Pilates",
  "Heated Pilates": "Hot Pilates",
  "Tempo Pilates": "Reformer Pilates",  // Tempo is a reformer brand
  "Matwork Pilates": "Mat Pilates",
  "Matwork": "Mat Pilates",
  "Hot Mat Pilates": "Mat Pilates",
  "Pilates Fusion": "Pilates",
  "Pilates Arc": "Pilates",
  "Pilates Chair": "Pilates",
  "Therapeutic Pilates": "Clinical Pilates",
  "Active Recovery Pilates": "Pilates",
  "Restorative Pilates": "Pilates",
  "Cardio Pilates": "Pilates",
  "Scoliosis Pilates": "Clinical Pilates",
  "Scolio-Pilates": "Clinical Pilates",
  "Pre-Post Natal Pilates": "Prenatal Pilates",
  "Pre/Post Natal Pilates": "Prenatal Pilates",
  "Pregnancy and Postnatal Pilates": "Prenatal Pilates",
  "Pregnancy Pilates": "Prenatal Pilates",
  "Postnatal Pilates": "Pilates",
  "Teen Reformer": "Reformer Pilates",

  // Yoga variants → generic Yoga (specific sub-styles not in approved list)
  "Vinyasa": "Vinyasa Yoga",
  "Vinyasa Flow": "Vinyasa Yoga",
  "Heated Vinyasa": "Vinyasa Yoga",
  "Hatha Vinyasa": "Vinyasa Yoga",
  "Ashtanga Vinyasa": "Vinyasa Yoga",
  "Hatha": "Hatha Yoga",
  "Yin": "Yin Yoga",
  "Restorative": "Restorative Yoga",
  "Yin-Restorative": ["Yin Yoga", "Restorative Yoga"],
  "Restorative Yin": ["Yin Yoga", "Restorative Yoga"],
  "Slow Flow": "Vinyasa Yoga",
  "Slow Flow Yoga": "Vinyasa Yoga",
  "Ashtanga": "Yoga",
  "Ashtanga Yoga": "Yoga",
  "Iyengar": "Yoga",
  "Iyengar Yoga": "Yoga",
  "Kundalini Yoga": "Yoga",
  "Bikram Yoga": "Hot Yoga",
  "Yoga Nidra": "Yoga",
  "Power Yoga": "Yoga",
  "Kids Yoga": "Yoga",
  "kids yoga": "Yoga",
  "Teens Yoga": "Yoga",
  "Teen Yoga": "Yoga",
  "Children's Yoga": "Yoga",
  "Chair Yoga": "Yoga",
  "Prenatal Yoga": "Yoga",
  "prenatal yoga": "Yoga",
  "Postnatal Yoga": "Yoga",
  "Pregnancy Yoga": "Yoga",
  "Mum and Baby Yoga": "Yoga",
  "Mums and Bubs Yoga": "Yoga",
  "Beginner Yoga": "Yoga",
  "Beginners Yoga": "Yoga",
  "Gentle Yoga": "Yoga",
  "Yoga Therapy": "Yoga",
  "yoga therapy": "Yoga",
  "Therapeutic Yoga": "Yoga",
  "Trauma Informed Yoga": "Yoga",
  "Trauma-Sensitive Yoga": "Yoga",
  "Special Needs Yoga": "Yoga",
  "Yoga Teacher Training": "Yoga",
  "yoga teacher training": "Yoga",
  "SUP Yoga": "Yoga",
  "Mat Yoga": "Yoga",
  "Strength & Flexibility Yoga": "Yoga",
  "Bhakti Mantra Yoga": "Yoga",
  "Mantra Yoga": "Yoga",
  "Nada Yoga": "Yoga",
  "Ayurvedic Yoga Therapy": "Yoga",
  "Ayurvedic Yoga": "Yoga",
  "Pelvic Floor Yoga": "Yoga",
  "Beach Yoga": "Yoga",
  "Private Yoga": "Yoga",
  "Menopause Yoga": "Yoga",
  "Yoga Hikes": "Yoga",
  "Family Acroyoga": "Yoga",
  "Acroyoga": "Yoga",
  "Mysore": "Yoga",

  // Rehab variants
  "Rehabilitation": "Rehab",
  "Injury Rehabilitation": "Rehab",
  "Injury Rehab": "Rehab",
  "Sports Injury Rehabilitation": "Rehab",
  "Sports Rehabilitation": "Rehab",
  "Exercise Rehabilitation": "Rehab",
  "Post-Surgery Rehabilitation": "Rehab",
  "Cardiac Rehabilitation": "Rehab",
  "Cancer Rehabilitation": "Rehab",
  "Workplace Rehabilitation": "Rehab",
  "Pelvic Floor Rehabilitation": "Rehab",
  "performance rehab": "Rehab",

  // Physiotherapy variants
  "Vestibular Physiotherapy": "Physiotherapy",
  "Sports Physiotherapy": "Physiotherapy",

  // Combat/martial arts variants
  "BJJ": "Brazilian Jiu Jitsu",
  "No Gi BJJ": "Brazilian Jiu Jitsu",
  "Nogi Grappling": "Brazilian Jiu Jitsu",
  "Submission Grappling": "Brazilian Jiu Jitsu",
  "Grappling": "Brazilian Jiu Jitsu",
  "Boxing/MMA": ["Boxing", "MMA"],
  "Youth Boxing": "Boxing",
  "Kids Boxing": "Boxing",
  "Competitive Boxing": "Boxing",
  "Olympic Boxing": "Boxing",
  "Boxercise": "Boxing",
  "Kyokushin Karate": "Karate",
  "Tae Kwon Do": "Taekwondo",
  "Self-Defence": "Self Defence",
  "Self-Defense": "Self Defence",
  "Kali Self Defence": "Self Defence",
  "Kung Fu": "Martial Arts",
  "Ninjutsu": "Martial Arts",
  "Jujutsu": "Martial Arts",
  "Zen Do Kai": "Martial Arts",
  "Eskrima": "Martial Arts",
  "Striking": "Martial Arts",
  "Combat Sports": "Martial Arts",

  // Spin/Cycle variants
  "Spin": "Spin/Cycle",
  "Cycle": "Spin/Cycle",
  "Cycling": "Spin/Cycle",
  "Cycle Studio": "Spin/Cycle",
  "Virtual Cycling": "Spin/Cycle",
  "Rhythm Ride": "Spin/Cycle",
  "Spin / Cycling": "Spin/Cycle",

  // Bootcamp variants (note: "Boot Camp" is already approved, kept as-is)
  "Bootcamps": "Bootcamp",

  // Breathing/wellness variants
  "Somatic Breathwork": "Breathwork",
  "Breath Work": "Breathwork",
  "Breathwork & Meditation": ["Breathwork", "Meditation"],
  "Guided Meditation": "Meditation",
  "Yin Meditation": "Meditation",
  "Sound Bath": "Sound Healing",
  "Sound Therapy": "Sound Healing",
  "Sound Massage": "Sound Healing",

  // Cold/sauna variants
  "Ice Bath": "Cold Plunge",
  "Ice Bath Therapy": "Cold Plunge",
  "Cold Therapy": "Cold Plunge",
  "Cold Plunge Therapy": "Cold Plunge",
  "Infrared Therapy": "Infrared Sauna",
  "Sauna Therapy": "Infrared Sauna",

  // Women's health variants
  "Women's Pelvic Health": "Women's Health",
  "Women's Fitness": "Women's Health",

  // Dance
  "Zumba": "Dance Fitness",
  "Dance": "Dance Fitness",
  "Dance Cardio": "Dance Fitness",
  "Dancing": "Dance Fitness",
  "Jungle Body": "Dance Fitness",

  // Aqua
  "Aqua Aerobics": "Aqua Fitness",
  "Swimming": "Swimming Classes",

  // EMS
  "EMS": "EMS Training",

  // Nutrition
  "Nutritional Coaching": "Nutrition Coaching",

  // Barre
  "Barre Body": "Barre",
  "Barre Fitness": "Barre",

  // Gymnastics
  "Artistic Gymnastics": "Gymnastics",
  "Rhythmic Gymnastics": "Gymnastics",
  "TeamGym": "Gymnastics",
  "Tumbling": "Gymnastics",

  // Misc case fixes
  "personal training": "Personal Training",  // will be removed as unapproved anyway
  "strength training": "Strength & Conditioning",
  "Strength Training": "Strength & Conditioning",
  "Resistance Training": "Strength & Conditioning",
};

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

async function getApprovedSet(table: string): Promise<Set<string>> {
  const datasetTable = table.replace("Gym-", "Dataset-");
  const items = await scanAll(datasetTable);
  const rec = items.find((d) => d.name === "specialties");
  return new Set<string>((rec?.entries as string[]) ?? []);
}

async function cleanupTable(table: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing: ${table}`);
  console.log("=".repeat(60));

  const approved = await getApprovedSet(table);
  console.log(`Approved specialties: ${approved.size}`);

  const gyms = await scanAll(table);
  console.log(`Total gyms: ${gyms.length}`);

  const gymsWithSpecs = gyms.filter(
    (g) => Array.isArray(g.specialties) && (g.specialties as string[]).length > 0
  );
  console.log(`Gyms with specialties: ${gymsWithSpecs.length}`);

  let updatedCount = 0;
  let removedTags = 0;
  let mappedTags = 0;
  const removedTagCounts = new Map<string, number>();
  const mappedFromTo = new Map<string, string>();

  const updates: { id: string; oldSpecs: string[]; newSpecs: string[] }[] = [];

  for (const gym of gymsWithSpecs) {
    const oldSpecs = (gym.specialties as string[]) ?? [];
    const newSpecs = new Set<string>();

    for (const tag of oldSpecs) {
      if (approved.has(tag)) {
        // Exact match in approved list — always keep as-is
        newSpecs.add(tag);
      } else if (VARIANT_MAP[tag]) {
        // Known variant — map to approved tag(s)
        const mapping = VARIANT_MAP[tag];
        const targets = Array.isArray(mapping) ? mapping : [mapping];
        for (const t of targets) {
          if (approved.has(t)) {
            newSpecs.add(t);
            mappedTags++;
            mappedFromTo.set(tag, t);
          }
        }
      } else {
        // Unapproved — remove
        removedTags++;
        removedTagCounts.set(tag, (removedTagCounts.get(tag) || 0) + 1);
      }
    }

    const newArr = [...newSpecs].sort();
    const oldSorted = [...oldSpecs].sort();

    // Check if changed
    if (
      newArr.length !== oldSorted.length ||
      newArr.some((v, i) => v !== oldSorted[i])
    ) {
      updates.push({
        id: gym.id as string,
        oldSpecs: oldSpecs,
        newSpecs: newArr,
      });
    }
  }

  console.log(`\nGyms to update: ${updates.length}`);
  console.log(`Tags mapped to approved: ${mappedTags}`);
  console.log(`Tags removed (unapproved): ${removedTags}`);

  // Show top removed tags
  const sortedRemoved = [...removedTagCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  );
  if (sortedRemoved.length > 0) {
    console.log(`\nTop removed tags:`);
    for (const [tag, count] of sortedRemoved.slice(0, 30)) {
      console.log(`  [${count}] ${tag}`);
    }
    if (sortedRemoved.length > 30) {
      console.log(`  ... and ${sortedRemoved.length - 30} more`);
    }
  }

  // Show some example updates
  console.log(`\nSample updates (first 5):`);
  for (const u of updates.slice(0, 5)) {
    const removed = u.oldSpecs.filter((s) => !u.newSpecs.includes(s));
    const added = u.newSpecs.filter((s) => !u.oldSpecs.includes(s));
    console.log(`  ${u.id}:`);
    if (removed.length) console.log(`    - removed: ${removed.join(", ")}`);
    if (added.length) console.log(`    + added: ${added.join(", ")}`);
  }

  if (!APPLY) {
    console.log(`\nDRY-RUN — no changes written.`);
    return;
  }

  // Apply updates
  console.log(`\nApplying ${updates.length} updates...`);
  let done = 0;
  for (const u of updates) {
    await ddb.send(
      new UpdateCommand({
        TableName: table,
        Key: { id: u.id },
        UpdateExpression: "SET specialties = :specs, updatedAt = :now",
        ExpressionAttributeValues: {
          ":specs": u.newSpecs.length > 0 ? u.newSpecs : [],
          ":now": new Date().toISOString(),
        },
      })
    );
    done++;
    if (done % 200 === 0 || done === updates.length) {
      console.log(`  Updated ${done}/${updates.length}`);
    }
  }
  console.log("  Done.");
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);
  await cleanupTable(PROD_TABLE);
  await cleanupTable(STAGING_TABLE);
  console.log("\nAll done.");
}

main().catch(console.error);
