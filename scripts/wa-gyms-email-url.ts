// Extract WA gyms with email addresses from prod DynamoDB.
// Output: CSV with Email, Business Name, Gym Category, is_enterprise, URL
// URLs are generated using the same deduplicateSlugs logic as the app.

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROD_TABLE = "Gym-xofowsmrxvebxmdjijmijtz5bq-NONE";
const OUTPUT = path.join(__dirname, "..", "data", "wa_gyms_email_url.csv");
const BASE_URL = "https://www.mynextgym.com.au";

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-southeast-2" })
);

const ENTERPRISE_PATTERNS = [
  /\bf45\b/i, /\banytime fitness\b/i, /\bsnap fitness\b/i, /\bjetts\b/i,
  /\bgoodlife\b/i, /\bplus fitness\b/i, /\bworld gym\b/i, /\brevo fitness\b/i,
  /\bfitstop\b/i, /\bcrossfit\b/i, /\bbft\b/i, /\bbody fit training\b/i,
  /\bcurves\b/i, /\bgold'?s gym\b/i, /\bkx pilates\b/i, /\bgenesis\b/i,
  /\bspeedfit\b/i, /\bstudio pilates international\b/i, /\bpronto pilates\b/i,
  /\borangetheory\b/i, /\b9round\b/i, /\bclub lime\b/i, /\bfernwood\b/i,
  /\bviva leisure\b/i, /\bplatinum fitness\b/i, /\bfit college\b/i,
  /\borbit fitness\b/i, /\belite fitness\b/i, /\bbest body pilates\b/i,
  /\bshemoves\b/i, /\bflow space\b/i, /\bstrong pilates\b/i, /\bclub pilates\b/i,
];

// ── Replicate app's slug logic exactly ──
function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function generateNameSlug(name: string): string {
  return slugify(name);
}

function generateSuburbSlug(suburb: string, postcode: string): string {
  return slugify(`${suburb}-${postcode}`);
}

// Same deduplication as src/lib/slugify.ts deduplicateSlugs
function deduplicateSlugs<T extends { slug: string }>(items: T[]): T[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = item.slug;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    if (count === 1) return item;
    return { ...item, slug: `${base}-${count}` };
  });
}

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

async function main() {
  // Load ALL gyms (same as ownerStore.getAll)
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({ TableName: PROD_TABLE, ExclusiveStartKey: lastKey })
    );
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  console.log(`Total prod gyms: ${items.length}`);

  // Build slug + suburbSlug for every gym, then deduplicate (mirrors ownerStore.getAll)
  const allWithSlugs = items.map((g) => ({
    ...g,
    slug: generateNameSlug(String(g.name || "")),
    suburbSlug: generateSuburbSlug(String(g.addressSuburb || ""), String(g.addressPostcode || "")),
  }));
  const deduped = deduplicateSlugs(allWithSlugs);

  // Index by id for fast lookup
  const slugById = new Map<string, { slug: string; suburbSlug: string }>();
  for (const g of deduped) {
    slugById.set(String(g.id), { slug: g.slug, suburbSlug: g.suburbSlug });
  }

  // Filter: WA + has email
  const waWithEmail = deduped.filter(
    (g) =>
      String(g.addressState || "").toUpperCase() === "WA" &&
      g.email &&
      String(g.email).trim().length > 3 &&
      String(g.email).includes("@")
  );

  console.log(`WA gyms with email: ${waWithEmail.length}`);

  // Enterprise detection
  const emailCount = new Map<string, number>();
  const domainCount = new Map<string, number>();
  for (const g of waWithEmail) {
    const email = String(g.email).trim().toLowerCase();
    emailCount.set(email, (emailCount.get(email) || 0) + 1);
    const domain = email.split("@")[1];
    if (domain) domainCount.set(domain, (domainCount.get(domain) || 0) + 1);
  }

  function baseName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[-–—]/g, " ")
      .replace(/\b(gym|fitness|training|studio|centre|center|club|health)\b/g, "")
      .replace(/\b(north|south|east|west|central|inner|outer)\b/g, "")
      .replace(/\b[a-z]{2,}\s+(wa|nsw|vic|qld|sa|tas|nt|act)\b/g, "")
      .replace(/\d{4}/g, "")
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const baseNameCount = new Map<string, number>();
  for (const g of waWithEmail) {
    const bn = baseName(String(g.name || ""));
    if (bn.length > 2) baseNameCount.set(bn, (baseNameCount.get(bn) || 0) + 1);
  }

  const genericDomains = new Set(["gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com", "live.com", "me.com", "bigpond.com", "optusnet.com.au", "westnet.com.au"]);

  function isEnterprise(g: Record<string, unknown>): boolean {
    const name = String(g.name || "");
    const email = String(g.email || "").trim().toLowerCase();
    const domain = email.split("@")[1] || "";
    if (ENTERPRISE_PATTERNS.some((p) => p.test(name))) return true;
    if ((emailCount.get(email) || 0) > 1) return true;
    if (!genericDomains.has(domain) && (domainCount.get(domain) || 0) >= 3) return true;
    const bn = baseName(name);
    if (bn.length > 2 && (baseNameCount.get(bn) || 0) > 1) return true;
    return false;
  }

  // Sort by name
  waWithEmail.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  // Build CSV
  const header = "Email,Business Name,Gym Category,is_enterprise,URL";
  const rows = waWithEmail.map((g) => {
    const email = String(g.email || "").trim();
    const name = String(g.name || "");
    const specialties = ((g.specialties as string[]) || []).join("; ");
    const enterprise = isEnterprise(g) ? "Yes" : "No";
    const url = `${BASE_URL}/gym/${g.suburbSlug}/${g.slug}?claim=true`;

    return [escapeCSV(email), escapeCSV(name), escapeCSV(specialties), enterprise, escapeCSV(url)].join(",");
  });

  const csv = [header, ...rows].join("\n");
  fs.writeFileSync(OUTPUT, csv, "utf-8");
  console.log(`\nWritten to ${OUTPUT}`);

  const enterpriseCount = waWithEmail.filter(isEnterprise).length;
  console.log(`  Enterprise/franchise: ${enterpriseCount}`);
  console.log(`  Independent: ${waWithEmail.length - enterpriseCount}`);

  // Report any duplicated slugs in WA
  const dupes = waWithEmail.filter((g) => g.slug.match(/-\d+$/));
  if (dupes.length) {
    console.log(`\n  Deduplicated slugs (${dupes.length}):`);
    for (const g of dupes) console.log(`    ${g.slug} — ${g.name}`);
  }
}

main().catch(console.error);
