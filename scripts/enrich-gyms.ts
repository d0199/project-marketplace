// Enrich gym profiles by scraping their websites and extracting data via Claude Haiku.
//
// Usage:
//   npx tsx scripts/enrich-gyms.ts                     # dry-run (preview only)
//   npx tsx scripts/enrich-gyms.ts --apply             # actually write to DynamoDB
//   npx tsx scripts/enrich-gyms.ts --apply --limit 5   # limit to first 5 gyms
//   npx tsx scripts/enrich-gyms.ts --skip-copy         # skip delete/copy, just enrich
//   npx tsx scripts/enrich-gyms.ts --state WA          # only enrich gyms in a specific state
//
// Steps:
//   1. Delete all gyms in staging table
//   2. Copy all gyms from prod table
//   3. For each gym with a website (where adminEdited is null/false):
//      - Fetch website HTML, convert to text
//      - Send to Claude Haiku for extraction
//      - Update DynamoDB with extracted fields

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const STAGING_TABLE = "Gym-qanzfeewlfeklctnhoskryahti-NONE";
const PROD_TABLE = "Gym-xofowsmrxvebxmdjijmijtz5bq-NONE";
const REGION = "ap-southeast-2";
const APP_ID = "d36uz2q25gygnh";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const SKIP_COPY = args.includes("--skip-copy");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;
const stateIdx = args.indexOf("--state");
const STATE_FILTER = stateIdx >= 0 ? args[stateIdx + 1]?.toUpperCase() : "";

// ---------------------------------------------------------------------------
// SSM -> Anthropic API key
// ---------------------------------------------------------------------------
let anthropicKey = "";

async function getAnthropicKey(): Promise<string> {
  if (anthropicKey) return anthropicKey;
  if (process.env.ANTHROPIC_API_KEY) {
    anthropicKey = process.env.ANTHROPIC_API_KEY;
    return anthropicKey;
  }
  const client = new SSMClient({ region: REGION });
  const result = await client.send(
    new GetParametersCommand({
      Names: [
        `/amplify/shared/${APP_ID}/ANTHROPIC_API_KEY`,
        `/amplify/${APP_ID}/staging/ANTHROPIC_API_KEY`,
      ],
      WithDecryption: true,
    })
  );
  for (const param of result.Parameters ?? []) {
    if (param.Value) { anthropicKey = param.Value; break; }
  }
  if (!anthropicKey) throw new Error("Could not retrieve ANTHROPIC_API_KEY from SSM or env");
  return anthropicKey;
}

// ---------------------------------------------------------------------------
// HTML -> text
// ---------------------------------------------------------------------------
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<\/(p|div|h[1-6]|li|tr|br\s*\/?)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Step 1: Delete all staging gyms
// ---------------------------------------------------------------------------
async function deleteAllStaging() {
  console.log("\n=== Step 1: Deleting all staging gyms ===");
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: STAGING_TABLE,
      ProjectionExpression: "id",
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  console.log(`  Found ${items.length} staging gyms to delete`);
  if (!APPLY) { console.log("  [DRY RUN] Skipping delete"); return; }

  const BATCH = 25;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    await ddb.send(new BatchWriteCommand({
      RequestItems: {
        [STAGING_TABLE]: batch.map((item) => ({
          DeleteRequest: { Key: { id: item.id } },
        })),
      },
    }));
  }
  console.log(`  Deleted ${items.length} staging gyms`);
}

// ---------------------------------------------------------------------------
// Step 2: Copy prod -> staging
// ---------------------------------------------------------------------------
async function copyProdToStaging(): Promise<Record<string, unknown>[]> {
  console.log("\n=== Step 2: Copying prod gyms to staging ===");
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: PROD_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  // Fix empty GSI key fields — DynamoDB rejects empty strings on GSI keys
  let fixed = 0;
  for (const item of items) {
    if (item.addressPostcode === "") { delete item.addressPostcode; fixed++; }
    if (item.ownerId === "") { delete item.ownerId; fixed++; }
  }
  console.log(`  Found ${items.length} prod gyms${fixed > 0 ? ` (fixed ${fixed} empty GSI keys)` : ""}`);
  if (!APPLY) { console.log("  [DRY RUN] Skipping copy"); return items; }

  const BATCH = 25;
  let written = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    await ddb.send(new BatchWriteCommand({
      RequestItems: {
        [STAGING_TABLE]: batch.map((item) => ({
          PutRequest: { Item: item },
        })),
      },
    }));
    written += batch.length;
    if (written % 500 === 0) console.log(`  ${written} / ${items.length} copied...`);
  }
  console.log(`  Copied ${written} gyms to staging`);
  return items;
}

// ---------------------------------------------------------------------------
// Step 3: Enrich gyms
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are analyzing a gym/fitness centre website. Extract as much useful profile information as possible from the page content.

Return a JSON object with ONLY the fields you can confidently extract. Omit any field you cannot find or are unsure about. Do NOT guess or make up data.

Fields to look for:
- "phone": phone number (Australian format preferred)
- "email": email address
- "instagram": Instagram profile URL (full URL)
- "facebook": Facebook page URL (full URL)
- "bookingUrl": online booking URL (Mindbody, Glofox, etc.)
- "amenities": array of amenities from this list ONLY: ["pool", "spa", "sauna", "free weights", "cardio", "group classes", "boxing/mma", "yoga/pilates", "parking", "showers", "lockers", "childcare", "cafe", "24/7 access", "personal training"]
- "specialties": array of specialties/programs (e.g. "Hyrox", "F45", "Olympic Lifting", "Powerlifting", "Rehab", "Seniors Fitness", "CrossFit", "HIIT", "Reformer Pilates", "Spin/Cycle", "Martial Arts", "Muay Thai", "Boxing", "Kickboxing", "Strength & Conditioning", "Functional Training", "Circuit Training")
- "description": write a compelling, SEO-optimized description for this gym listing on mynextgym.com.au. 100-200 words, plain text only (no HTML, no markdown, no headings). Use Australian English spelling. Emphasise the gym's amenities, location, and what makes it stand out. Naturally include the suburb name for local SEO. The tone should be professional but approachable - as if the gym owner is talking to a potential member. Do NOT include the gym name at the start (it's already shown as the page title). Do NOT use bullet points or lists. Write flowing paragraphs only. Do NOT copy text verbatim from the website - rewrite it in your own words
- "pricePerWeek": weekly membership price as a number (calculate from weekly/fortnightly/monthly if needed)
- "hours": object with keys monday-sunday, values as opening hours strings (e.g. "5:00am - 9:00pm"). Only include days where hours are clearly stated on the website.
- "memberOffers": array of member offer tags from this list ONLY: ["no contract", "contract", "new member trial", "referral scheme", "multiple location access", "gym or community app", "casual classes"]

Return ONLY valid JSON. No markdown, no explanation, no code blocks.`;

async function fetchWebsite(url: string): Promise<string | null> {
  try {
    const parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; mynextgym.com.au bot; +https://www.mynextgym.com.au)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const html = await response.text();
    let text = htmlToText(html);
    if (text.length > 8000) text = text.slice(0, 8000);
    if (text.length < 50) return null;
    return text;
  } catch {
    return null;
  }
}

async function extractWithHaiku(
  apiKey: string,
  websiteUrl: string,
  pageText: string
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `Website URL: ${websiteUrl}\n\nPage content:\n${pageText}` }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`    Haiku error ${response.status}: ${err.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text ?? "{}";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`    Haiku parse error:`, err);
    return null;
  }
}

async function enrichGyms(gyms: Record<string, unknown>[]) {
  console.log("\n=== Step 3: Enriching gyms ===");

  // Filter: has website, adminEdited is null/false, optional state filter
  const candidates = gyms.filter(
    (g) =>
      g.website &&
      String(g.website).length > 5 &&
      !g.adminEdited &&
      (!STATE_FILTER || String(g.addressState || "").toUpperCase() === STATE_FILTER)
  );

  const toProcess = candidates.slice(0, LIMIT);
  const stateLabel = STATE_FILTER ? ` [${STATE_FILTER} only]` : "";
  console.log(`  ${candidates.length} candidates${stateLabel} (adminEdited=null/false with website), processing ${toProcess.length}\n`);

  if (!APPLY) {
    console.log("DRY-RUN — skipping API calls. Run with --apply to enrich.\n");
    return;
  }

  const apiKey = await getAnthropicKey();
  console.log("  API key retrieved");

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const gym = toProcess[i];
    const name = String(gym.name ?? "");
    const website = String(gym.website ?? "");
    const id = String(gym.id);

    console.log(`  [${i + 1}/${toProcess.length}] ${name} -- ${website}`);

    // Fetch website
    const pageText = await fetchWebsite(website);
    if (!pageText) {
      console.log("    ! Could not fetch website, skipping");
      skipped++;
      continue;
    }

    // Extract via Haiku
    const extracted = await extractWithHaiku(apiKey, website, pageText);
    if (!extracted) {
      console.log("    ! Extraction failed, skipping");
      failed++;
      continue;
    }

    // Build update expression
    const setExprs: string[] = ["updatedAt = :now"];
    const values: Record<string, unknown> = { ":now": new Date().toISOString() };
    const updatedFields: string[] = [];

    // Description
    if (extracted.description && typeof extracted.description === "string") {
      setExprs.push("description = :desc");
      values[":desc"] = extracted.description;
      updatedFields.push("description");
    }

    // Price + pricing notes
    if (extracted.pricePerWeek && typeof extracted.pricePerWeek === "number") {
      setExprs.push("pricePerWeek = :price");
      values[":price"] = extracted.pricePerWeek;
      setExprs.push("pricingNotes = :pnotes");
      values[":pnotes"] = "Verified by AI";
      updatedFields.push("pricePerWeek");
    }

    // Phone
    if (extracted.phone && typeof extracted.phone === "string") {
      setExprs.push("phone = :phone");
      values[":phone"] = extracted.phone;
      updatedFields.push("phone");
    }

    // Email
    if (extracted.email && typeof extracted.email === "string") {
      setExprs.push("email = :email");
      values[":email"] = extracted.email;
      updatedFields.push("email");
    }

    // Instagram
    if (extracted.instagram && typeof extracted.instagram === "string") {
      setExprs.push("instagram = :ig");
      values[":ig"] = extracted.instagram;
      updatedFields.push("instagram");
    }

    // Facebook
    if (extracted.facebook && typeof extracted.facebook === "string") {
      setExprs.push("facebook = :fb");
      values[":fb"] = extracted.facebook;
      updatedFields.push("facebook");
    }

    // Booking URL
    if (extracted.bookingUrl && typeof extracted.bookingUrl === "string") {
      setExprs.push("bookingUrl = :booking");
      values[":booking"] = extracted.bookingUrl;
      updatedFields.push("bookingUrl");
    }

    // Amenities + notes
    if (Array.isArray(extracted.amenities) && extracted.amenities.length > 0) {
      setExprs.push("amenities = :amenities");
      values[":amenities"] = extracted.amenities;
      setExprs.push("amenitiesNotes = :anotes");
      values[":anotes"] = "Verified by AI";
      updatedFields.push(`amenities(${extracted.amenities.length})`);
    }

    // Specialties
    if (Array.isArray(extracted.specialties) && extracted.specialties.length > 0) {
      setExprs.push("specialties = :specs");
      values[":specs"] = extracted.specialties;
      updatedFields.push(`specialties(${extracted.specialties.length})`);
    }

    // Member offers
    if (Array.isArray(extracted.memberOffers) && extracted.memberOffers.length > 0) {
      setExprs.push("memberOffers = :offers");
      values[":offers"] = extracted.memberOffers;
      updatedFields.push(`memberOffers(${extracted.memberOffers.length})`);
    }

    // Hours -- only include days with real values
    const hours = extracted.hours as Record<string, string> | undefined;
    if (hours && typeof hours === "object") {
      const dayMap: Record<string, string> = {
        monday: "hoursMonday", tuesday: "hoursTuesday", wednesday: "hoursWednesday",
        thursday: "hoursThursday", friday: "hoursFriday", saturday: "hoursSaturday",
        sunday: "hoursSunday",
      };
      let hoursCount = 0;
      for (const [day, attr] of Object.entries(dayMap)) {
        const val = hours[day];
        if (val && typeof val === "string" && val.length > 2 &&
            !val.toLowerCase().includes("unavailable") &&
            !val.toLowerCase().includes("unknown") &&
            !val.toLowerCase().includes("closed") &&
            !val.toLowerCase().includes("n/a")) {
          const placeholder = `:h${day.slice(0, 3)}`;
          setExprs.push(`${attr} = ${placeholder}`);
          values[placeholder] = val;
          hoursCount++;
        }
      }
      if (hoursCount > 0) updatedFields.push(`hours(${hoursCount} days)`);
    }

    if (updatedFields.length === 0) {
      console.log("    ! No fields extracted, skipping");
      skipped++;
      continue;
    }

    console.log(`    > Extracted: ${updatedFields.join(", ")}`);

    if (APPLY) {
      await ddb.send(new UpdateCommand({
        TableName: STAGING_TABLE,
        Key: { id },
        UpdateExpression: `SET ${setExprs.join(", ")}`,
        ExpressionAttributeValues: values,
      }));
      console.log("    > Written to DynamoDB");
    } else {
      console.log("    [DRY RUN] Would update DynamoDB");
    }

    updated++;

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Mode: ${APPLY ? "APPLIED" : "DRY RUN"}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (writing to DynamoDB)" : "DRY RUN (preview only)"}`);
  console.log(`Limit: ${LIMIT === Infinity ? "all" : LIMIT}`);

  if (!SKIP_COPY) {
    await deleteAllStaging();
    await copyProdToStaging();
  }

  // Scan staging table for enrichment
  const gyms: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: SKIP_COPY ? STAGING_TABLE : STAGING_TABLE,
      ExclusiveStartKey: lastKey,
    }));
    gyms.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  await enrichGyms(gyms);
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
