#!/usr/bin/env npx tsx
/**
 * Mirror DynamoDB data from production to staging via AppSync GraphQL.
 *
 * Usage:
 *   npx tsx scripts/mirror-prod-to-staging.ts
 *   npx tsx scripts/mirror-prod-to-staging.ts --tables Gym,PersonalTrainer
 *   npx tsx scripts/mirror-prod-to-staging.ts --dry-run
 *   npx tsx scripts/mirror-prod-to-staging.ts --prod-config amplify_outputs.json --staging-config amplify_outputs_staging.json
 *
 * Safe to re-run: uses existing IDs, duplicates get ConditionalCheckFailed (skipped).
 */

import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// ── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    prodConfig: get("--prod-config") || "amplify_outputs.json",
    stagingConfig: get("--staging-config") || "amplify_outputs_staging.json",
    tables: get("--tables")?.split(",").map((s) => s.trim()),
    dryRun: args.includes("--dry-run"),
  };
}

// ── Table definitions ────────────────────────────────────────────────────────
// Each entry: model name → list of fields to copy (excluding createdAt/updatedAt which are read-only)
const TABLE_DEFS: Record<string, string[]> = {
  Gym: [
    "id", "ownerId", "name", "isActive", "isTest", "isFeatured", "priceVerified",
    "description", "images", "amenities", "lat", "lng", "pricePerWeek",
    "addressStreet", "addressSuburb", "addressState", "addressPostcode",
    "phone", "email", "website", "instagram", "facebook", "bookingUrl",
    "hoursMonday", "hoursTuesday", "hoursWednesday", "hoursThursday",
    "hoursFriday", "hoursSaturday", "hoursSunday", "hoursComment",
    "isPaid", "stripeSubscriptionId", "stripePlan", "googlePlaceId", "createdBy",
    "imageFocalPoints", "memberOffers", "memberOffersNotes", "memberOffersScroll",
    "memberScrollText", "memberOffersTnC", "pricingNotes", "amenitiesVerified",
    "amenitiesNotes", "specialties",
  ],
  GymStat: [
    "id", "gymId", "pageViews", "websiteClicks", "phoneClicks", "emailClicks", "bookingClicks",
  ],
  Claim: [
    "id", "gymId", "gymName", "gymAddress", "gymWebsite", "claimantName", "claimantEmail",
    "claimantPhone", "message", "status", "notes", "isNewListing", "gymPhone",
    "gymEmail", "gymSuburb", "gymPostcode", "claimType",
  ],
  GymEdit: [
    "id", "gymId", "gymName", "ownerEmail", "currentSnapshot", "proposedChanges",
    "status", "notes", "editType", "reviewedBy", "reviewedAt",
  ],
  Lead: [
    "id", "gymId", "gymName", "name", "email", "phone", "message", "status",
  ],
  PersonalTrainer: [
    "id", "ownerId", "name", "isActive", "isTest", "isFeatured", "isPaid",
    "stripeSubscriptionId", "stripePlan", "createdBy", "description", "images",
    "imageFocalPoints", "lat", "lng",
    "addressStreet", "addressSuburb", "addressState", "addressPostcode",
    "phone", "email", "website", "instagram", "facebook", "tiktok", "bookingUrl",
    "gymIds", "specialties", "qualifications", "qualificationsVerified",
    "qualificationsNotes", "qualificationEvidence",
    "memberOffers", "memberOffersNotes", "memberOffersTnC",
    "experienceYears", "pricePerSession", "sessionDuration", "pricingNotes",
    "availability", "gender", "languages", "customLeadFields",
  ],
  Affiliation: [
    "id", "ptId", "ptName", "gymId", "gymName", "requestedBy", "status", "notes", "requestedAt",
  ],
  DailyGymStat: [
    "id", "gymId", "date", "pageViews", "websiteClicks", "phoneClicks", "emailClicks", "bookingClicks",
  ],
  FeatureFlag: [
    "id", "ptSearch", "specialties", "memberOffers", "amenities", "radiusSlider",
    "ptMemberOffers", "heroSpecialties", "heroAmenities",
  ],
  Dataset: ["id", "name", "entries"],
  FeedbackReport: [
    "id", "listingId", "listingName", "listingType", "issueType", "message", "submittedAt",
  ],
};

// ── GraphQL helpers ──────────────────────────────────────────────────────────

function buildListQuery(model: string, fields: string[]): string {
  return `query List${model}s($limit: Int, $nextToken: String) {
    list${model}s(limit: $limit, nextToken: $nextToken) {
      items { ${fields.join(" ")} }
      nextToken
    }
  }`;
}

function buildCreateMutation(model: string): string {
  return `mutation Create${model}($input: Create${model}Input!) {
    create${model}(input: $input) { id }
  }`;
}

async function gqlRequest(
  url: string,
  apiKey: string,
  query: string,
  variables: Record<string, any>
): Promise<any> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ query, variables }),
  });
  return resp.json();
}

async function fetchAll(
  url: string,
  apiKey: string,
  model: string,
  fields: string[]
): Promise<Record<string, any>[]> {
  const query = buildListQuery(model, fields);
  const items: Record<string, any>[] = [];
  let nextToken: string | null = null;

  do {
    const json = await gqlRequest(url, apiKey, query, { limit: 1000, nextToken });
    const data = json.data?.[`list${model}s`];
    if (!data) {
      console.error(`  Failed to list ${model}:`, JSON.stringify(json.errors?.[0]?.message || json));
      break;
    }
    items.push(...(data.items || []));
    nextToken = data.nextToken || null;
  } while (nextToken);

  return items;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  const prodOutputs = require(path.resolve(opts.prodConfig));
  const stagingOutputs = require(path.resolve(opts.stagingConfig));

  const prodUrl = prodOutputs.data?.url;
  const prodKey = prodOutputs.data?.api_key;
  const stagingUrl = stagingOutputs.data?.url;
  const stagingKey = stagingOutputs.data?.api_key;

  if (!prodUrl || !prodKey) { console.error("Missing prod AppSync config"); process.exit(1); }
  if (!stagingUrl || !stagingKey) { console.error("Missing staging AppSync config"); process.exit(1); }

  console.log(`Source:  ${opts.prodConfig}`);
  console.log(`Target:  ${opts.stagingConfig}`);

  const tablesToMirror = opts.tables || Object.keys(TABLE_DEFS);

  for (const model of tablesToMirror) {
    const fields = TABLE_DEFS[model];
    if (!fields) {
      console.error(`Unknown model: ${model}`);
      continue;
    }

    console.log(`\n── ${model} ──`);

    // 1. Fetch all records from prod
    const items = await fetchAll(prodUrl, prodKey, model, fields);
    console.log(`  Fetched ${items.length.toLocaleString()} from prod`);

    if (!items.length) continue;

    if (opts.dryRun) {
      console.log(`  [DRY RUN] Would create ${items.length} records in staging`);
      continue;
    }

    // 2. Write each record to staging
    const createMutation = buildCreateMutation(model);
    let ok = 0, skipped = 0, failed = 0;

    for (let i = 0; i < items.length; i++) {
      // Strip null/undefined values and read-only timestamps
      const input: Record<string, any> = {};
      for (const key of fields) {
        if (items[i][key] !== null && items[i][key] !== undefined) {
          input[key] = items[i][key];
        }
      }

      const json = await gqlRequest(stagingUrl, stagingKey, createMutation, { input });

      if (json.data?.[`create${model}`]) {
        ok++;
        if (ok % 100 === 0) {
          process.stdout.write(`  Progress: ${ok}/${items.length} created\r`);
        }
      } else if (
        json.errors?.[0]?.message?.includes("onditional") ||
        json.errors?.[0]?.message?.includes("already exists")
      ) {
        skipped++;
      } else {
        failed++;
        if (failed <= 5) {
          console.log(`  FAIL [${items[i].id}]: ${json.errors?.[0]?.message?.slice(0, 120)}`);
        }
      }
    }

    console.log(`  Created: ${ok} | Skipped: ${skipped} (exist) | Failed: ${failed}`);
  }

  console.log("\n── Mirror complete ──");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
