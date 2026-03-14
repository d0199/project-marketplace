// Extract WA gyms with email addresses from prod DynamoDB.
// Output: CSV with Email, Business Name, Gym Category, is_enterprise, URL

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

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

async function main() {
  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({ TableName: PROD_TABLE, ExclusiveStartKey: lastKey })
    );
    items.push(...(res.Items ?? []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  // Filter: WA + has email
  const waWithEmail = items.filter(
    (g) =>
      String(g.addressState || "").toUpperCase() === "WA" &&
      g.email &&
      String(g.email).trim().length > 3 &&
      String(g.email).includes("@")
  );

  console.log(`Total prod gyms: ${items.length}`);
  console.log(`WA gyms with email: ${waWithEmail.length}`);

  // Enterprise detection maps
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

  // Build CSV with URL
  const header = "Email,Business Name,Gym Category,is_enterprise,URL";
  const rows = waWithEmail.map((g) => {
    const email = String(g.email || "").trim();
    const name = String(g.name || "");
    const specialties = ((g.specialties as string[]) || []).join("; ");
    const enterprise = isEnterprise(g) ? "Yes" : "No";

    // Build URL from slug and suburbSlug fields, or derive from name/suburb/postcode
    let url = "";
    const suburbSlug = g.suburbSlug as string | undefined;
    const nameSlug = g.slug as string | undefined;
    if (suburbSlug && nameSlug) {
      url = `${BASE_URL}/gym/${suburbSlug}/${nameSlug}`;
    } else {
      const suburb = String(g.addressSuburb || "");
      const postcode = String(g.addressPostcode || "");
      if (suburb && postcode) {
        url = `${BASE_URL}/gym/${slugify(`${suburb}-${postcode}`)}/${slugify(name)}`;
      }
    }

    return [escapeCSV(email), escapeCSV(name), escapeCSV(specialties), enterprise, escapeCSV(url)].join(",");
  });

  const csv = [header, ...rows].join("\n");
  fs.writeFileSync(OUTPUT, csv, "utf-8");
  console.log(`\nWritten to ${OUTPUT}`);

  const enterpriseCount = waWithEmail.filter(isEnterprise).length;
  console.log(`  Enterprise/franchise: ${enterpriseCount}`);
  console.log(`  Independent: ${waWithEmail.length - enterpriseCount}`);
}

main().catch(console.error);
