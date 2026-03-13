// Seed staging with core records (Datasets + FeatureFlags) and 100 WA gyms
//   npx tsx scripts/seed-staging-core.ts
//
// Reads AppSync config from amplify_outputs_staging.json (updated after stack rebuild).

import { readFileSync } from "fs";
import { randomUUID } from "crypto";

// ── Config ──────────────────────────────────────────────────────────────────
const OUTPUTS_PATH = "amplify_outputs_staging.json";

interface AmplifyOutputs {
  data: { url: string; api_key: string };
}

const outputs: AmplifyOutputs = JSON.parse(readFileSync(OUTPUTS_PATH, "utf-8"));
const APPSYNC_URL = outputs.data.url;
const API_KEY = outputs.data.api_key;

// Safety: ensure we're targeting staging, not production
const prodOutputs: AmplifyOutputs = JSON.parse(readFileSync("amplify_outputs.json", "utf-8"));
if (APPSYNC_URL === prodOutputs.data.url) {
  console.error("❌ ABORT: amplify_outputs_staging.json points to the PRODUCTION AppSync endpoint.");
  console.error("   Update amplify_outputs_staging.json with the new staging config first.");
  process.exit(1);
}

// ── GraphQL helper ──────────────────────────────────────────────────────────
async function gql(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(APPSYNC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

// ── Dataset records ─────────────────────────────────────────────────────────
const DATASETS: { name: string; entries: string[] }[] = [
  {
    name: "amenities",
    entries: [
      "pool", "spa", "sauna", "free weights", "cardio", "group classes",
      "boxing/mma", "yoga/pilates", "parking", "showers", "lockers",
      "childcare", "café", "24/7 access", "personal training",
    ],
  },
  {
    name: "member-offers",
    entries: [
      "no contract", "contract", "new member trial", "referral scheme",
      "multiple location access", "gym or community app", "casual classes",
    ],
  },
  {
    name: "specialties",
    entries: [
      "HYROX", "CrossFit", "F45", "Pilates", "Yoga", "Olympic Lifting",
      "Powerlifting", "Strongman", "Boxing", "Kickboxing", "MMA",
      "Brazilian Jiu-Jitsu", "Muay Thai", "Calisthenics", "Gymnastics",
      "Functional Training", "HIIT", "Spin / Cycling", "Swimming Classes",
      "Rock Climbing", "Rehab / Physio", "Seniors Fitness", "Kids Programs",
      "Women Only", "Group Fitness", "Personal Training", "Boot Camp",
      "Bodybuilding", "Circuit Training", "Parkour",
    ],
  },
  {
    name: "pt-specialties",
    entries: [
      "Strength Training", "Weight Loss", "HIIT", "Boxing", "Yoga",
      "Pilates", "Rehabilitation", "Sports Performance", "Powerlifting",
      "CrossFit", "Functional Training", "Pre & Postnatal", "Nutrition",
      "MMA", "Athletic Conditioning", "Flexibility & Mobility",
      "Body Composition", "Senior Fitness", "Mindfulness", "Competition Prep",
    ],
  },
  {
    name: "pt-member-offers",
    entries: [
      "free initial consultation", "first session free", "discounted packs",
      "couples training", "online coaching", "group sessions",
      "student discount", "referral bonus", "flexible scheduling",
      "nutrition plan included",
    ],
  },
  {
    name: "report-issues",
    entries: [
      "Pricing is incorrect", "Address is wrong", "Amenities are incorrect",
      "Opening hours are wrong", "Contact info is incorrect",
      "Gym is permanently closed", "Duplicate listing", "Other",
    ],
  },
];

async function seedDatasets() {
  console.log("── Seeding Datasets ──");
  for (const ds of DATASETS) {
    const mutation = `mutation CreateDataset($input: CreateDatasetInput!) {
      createDataset(input: $input) { id name }
    }`;
    await gql(mutation, { input: { name: ds.name, entries: ds.entries } });
    console.log(`  ✓ ${ds.name} (${ds.entries.length} entries)`);
  }
}

// ── FeatureFlag global record ───────────────────────────────────────────────
async function seedFeatureFlags() {
  console.log("\n── Seeding FeatureFlags ──");
  const mutation = `mutation CreateFeatureFlag($input: CreateFeatureFlagInput!) {
    createFeatureFlag(input: $input) { id }
  }`;
  await gql(mutation, {
    input: {
      id: "global",
      ptSearch: true,
      specialties: true,
      memberOffers: true,
      amenities: true,
      radiusSlider: true,
      ptMemberOffers: true,
      chatbot: false,
      chatbotSchedule: "",
      claudeApi: true,
      googleApi: true,
    },
  });
  console.log("  ✓ global feature flags");
}

// ── 100 WA Gyms ─────────────────────────────────────────────────────────────
function parseCSV(path: string) {
  const raw = readFileSync(path, "utf-8");
  const lines = raw.split("\n").filter(Boolean);
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') { inQuotes = !inQuotes; continue; }
      if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; continue; }
      current += char;
    }
    values.push(current.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function seedGyms() {
  console.log("\n── Seeding 100 WA Gyms ──");
  const allGyms = parseCSV("data/gyms_wa.csv");
  const selected = shuffle(allGyms).slice(0, 100);
  const now = new Date().toISOString();

  const mutation = `mutation CreateGym($input: CreateGymInput!) {
    createGym(input: $input) { id name }
  }`;

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < selected.length; i++) {
    const g = selected[i];
    const postcode = g.address?.match(/\b(\d{4})\b/)?.[1] ?? "";
    const street = g.address?.split(",")[0]?.trim() ?? "";

    try {
      await gql(mutation, {
        input: {
          ownerId: "unclaimed",
          name: g.name,
          isActive: true,
          isTest: false,
          isPaid: false,
          isFeatured: false,
          isFreeTrial: false,
          priceVerified: false,
          amenitiesVerified: false,
          memberOffersScroll: false,
          createdBy: "seed-staging",
          googlePlaceId: g.id || null,
          description: "",
          addressStreet: street,
          addressSuburb: g.suburb || "",
          addressState: g.state || "WA",
          addressPostcode: postcode,
          phone: g.phone || "",
          email: "",
          website: g.website || "",
          lat: parseFloat(g.lat) || -31.95,
          lng: parseFloat(g.lng) || 115.86,
          amenities: [],
          specialties: [],
          memberOffers: [],
          images: [],
          pricePerWeek: 0,
        },
      });
      console.log(`  ✓ [${i + 1}/100] ${g.name} — ${g.suburb} ${postcode}`);
      ok++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ [${i + 1}/100] ${g.name}: ${msg}`);
      fail++;
    }
  }

  console.log(`\n  Gyms: ${ok} created, ${fail} failed.`);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Using AppSync: ${APPSYNC_URL}\n`);
  await seedDatasets();
  await seedFeatureFlags();
  await seedGyms();
  console.log("\n✅ Staging seed complete.");
}

main().catch((err) => { console.error(err); process.exit(1); });
