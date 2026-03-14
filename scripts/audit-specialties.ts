/**
 * Audit gym specialty tags against the approved Dataset specialties list.
 *
 * Scans both the Dataset and Gym DynamoDB tables, then categorizes every
 * unique specialty tag found on gyms as approved, likely-variant, or unapproved.
 *
 * Usage:  npx tsx scripts/audit-specialties.ts
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const REGION = "ap-southeast-2";
const DATASET_TABLE = "Dataset-xofowsmrxvebxmdjijmijtz5bq-NONE";
const GYM_TABLE = "Gym-xofowsmrxvebxmdjijmijtz5bq-NONE";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: REGION })
);

// ---------------------------------------------------------------------------
// DynamoDB helpers
// ---------------------------------------------------------------------------

async function scanAll<T = Record<string, unknown>>(
  tableName: string
): Promise<T[]> {
  const items: T[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      })
    );
    if (res.Items) items.push(...(res.Items as T[]));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/** Lowercase, strip punctuation, collapse whitespace, trim */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract individual word tokens from a string */
function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

/**
 * Generate candidate normalised forms for a gym tag so we can match against
 * the approved list. Handles patterns like:
 *   "Yoga - Vinyasa"   → ["yoga vinyasa", "vinyasa yoga"]
 *   "HIIT / Circuit"   → ["hiit circuit", "circuit hiit", "hiit", "circuit"]
 *   "Pilates (Reformer)" → ["pilates reformer", "reformer pilates"]
 */
function expandVariants(tag: string): string[] {
  const base = normalize(tag);
  const forms = new Set<string>();
  forms.add(base);

  // Split on common delimiters: " - ", " / ", " & ", " | ", "(", ")"
  const parts = base
    .split(/\s*[-/&|()]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    // Original order joined
    forms.add(parts.join(" "));
    // Reversed order (handles "Yoga - Vinyasa" → "Vinyasa Yoga")
    forms.add([...parts].reverse().join(" "));
    // Each individual part (handles "HIIT / Circuit" matching "HIIT")
    for (const p of parts) {
      forms.add(p);
    }
  }

  // Word-sorted form (order-independent matching)
  const sorted = tokens(base).sort().join(" ");
  forms.add(sorted);

  return [...forms];
}

/**
 * Check whether a gym tag is a "variant" of any approved specialty.
 * Returns the matched approved specialty or null.
 */
function findVariantMatch(
  tag: string,
  approvedNormMap: Map<string, string>,
  approvedTokenSets: Map<string, Set<string>>
): string | null {
  const tagVariants = expandVariants(tag);
  const tagNorm = normalize(tag);
  const tagTokens = new Set(tokens(tag));

  // 1. Check if any expanded variant exactly matches an approved normalised form
  for (const variant of tagVariants) {
    if (approvedNormMap.has(variant)) {
      return approvedNormMap.get(variant)!;
    }
  }

  // 2. Substring containment: tag contains approved or vice-versa
  for (const [normApproved, original] of approvedNormMap) {
    if (tagNorm.includes(normApproved) || normApproved.includes(tagNorm)) {
      return original;
    }
  }

  // 3. Token overlap: if all tokens of approved appear in tag (or vice-versa)
  for (const [original, approvedTokens] of approvedTokenSets) {
    if (approvedTokens.size === 0) continue;

    const allApprovedInTag = [...approvedTokens].every((t) => tagTokens.has(t));
    const allTagInApproved = [...tagTokens].every((t) => approvedTokens.has(t));

    if (allApprovedInTag || allTagInApproved) {
      return original;
    }
  }

  // 4. High token overlap ratio (≥ 70% of the smaller set)
  for (const [original, approvedTokens] of approvedTokenSets) {
    if (approvedTokens.size === 0) continue;
    let overlap = 0;
    for (const t of tagTokens) {
      if (approvedTokens.has(t)) overlap++;
    }
    const minSize = Math.min(tagTokens.size, approvedTokens.size);
    if (minSize > 0 && overlap / minSize >= 0.7) {
      return original;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Scanning Dataset table for approved specialties...");
  const datasets = await scanAll<{ name: string; entries?: string[] }>(
    DATASET_TABLE
  );
  const specialtiesRecord = datasets.find((d) => d.name === "specialties");
  if (!specialtiesRecord || !specialtiesRecord.entries) {
    console.error('ERROR: Could not find dataset record with name "specialties"');
    process.exit(1);
  }
  const approvedList: string[] = specialtiesRecord.entries;
  console.log(`  Found ${approvedList.length} approved specialties\n`);

  // Build lookup structures
  const approvedSet = new Set(approvedList);
  const approvedNormMap = new Map<string, string>(); // normalised → original
  const approvedTokenSets = new Map<string, Set<string>>(); // original → token set
  for (const a of approvedList) {
    approvedNormMap.set(normalize(a), a);
    approvedTokenSets.set(a, new Set(tokens(a)));
  }

  console.log("Scanning Gym table for all gyms...");
  const gyms = await scanAll<{
    id: string;
    name: string;
    specialties?: string[];
  }>(GYM_TABLE);
  console.log(`  Found ${gyms.length} gyms\n`);

  // Collect unique tags with counts
  const tagCounts = new Map<string, number>();
  for (const gym of gyms) {
    if (!gym.specialties || !Array.isArray(gym.specialties)) continue;
    for (const tag of gym.specialties) {
      const trimmed = tag.trim();
      if (!trimmed) continue;
      tagCounts.set(trimmed, (tagCounts.get(trimmed) || 0) + 1);
    }
  }

  // Categorise
  const approved: Array<{ tag: string; count: number }> = [];
  const variants: Array<{ tag: string; count: number; suggestedMatch: string }> = [];
  const unapproved: Array<{ tag: string; count: number }> = [];

  for (const [tag, count] of tagCounts) {
    if (approvedSet.has(tag)) {
      approved.push({ tag, count });
    } else {
      const match = findVariantMatch(tag, approvedNormMap, approvedTokenSets);
      if (match) {
        variants.push({ tag, count, suggestedMatch: match });
      } else {
        unapproved.push({ tag, count });
      }
    }
  }

  // Sort
  approved.sort((a, b) => b.count - a.count);
  variants.sort((a, b) => b.count - a.count);
  unapproved.sort((a, b) => b.count - a.count);

  // Print results
  console.log("=".repeat(60));
  console.log(`APPROVED (${approved.length} tags — exact match in dataset)`);
  console.log("=".repeat(60));
  for (const { tag, count } of approved) {
    console.log(`  [${count}] ${tag}`);
  }

  console.log();
  console.log("=".repeat(60));
  console.log(`LIKELY VARIANTS (${variants.length} tags — probable match)`);
  console.log("=".repeat(60));
  for (const { tag, count, suggestedMatch } of variants) {
    console.log(`  [${count}] "${tag}" → "${suggestedMatch}"`);
  }

  console.log();
  console.log("=".repeat(60));
  console.log(`UNAPPROVED (${unapproved.length} tags — no clear match)`);
  console.log("=".repeat(60));
  for (const { tag, count } of unapproved) {
    console.log(`  [${count}] ${tag}`);
  }

  // Summary
  const totalTags = tagCounts.size;
  const totalUsages = [...tagCounts.values()].reduce((a, b) => a + b, 0);
  console.log();
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`  Unique tags across all gyms:  ${totalTags}`);
  console.log(`  Total tag usages:             ${totalUsages}`);
  console.log(`  Approved (exact match):       ${approved.length}`);
  console.log(`  Likely variants:              ${variants.length}`);
  console.log(`  Unapproved:                   ${unapproved.length}`);
  console.log(`  Approved specialties in dataset: ${approvedList.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
