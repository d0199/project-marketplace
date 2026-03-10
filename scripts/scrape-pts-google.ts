#!/usr/bin/env npx tsx
/**
 * Scrape Personal Trainer listings from Google Places API (New).
 *
 * Uses Text Search to find "personal trainer" businesses across Australian cities,
 * then fetches full details (phone, website, hours, etc.) for each result.
 *
 * Usage:
 *   npx tsx scripts/scrape-pts-google.ts
 *   npx tsx scripts/scrape-pts-google.ts --state WA
 *   npx tsx scripts/scrape-pts-google.ts --state WA --limit 50
 *   npx tsx scripts/scrape-pts-google.ts --radius 30000
 *
 * Resume: re-running skips already-scraped Place IDs automatically.
 */

import fs from "fs";
import path from "path";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";

// ── Load .env.local ──────────────────────────────────────────────────────────
const envFile = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const val = rest.join("=").replace(/^['"]|['"]$/g, "");
    if (!process.env[key.trim()]) process.env[key.trim()] = val;
  }
}

// ── Config ───────────────────────────────────────────────────────────────────
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const DEFAULT_OUTPUT = `data/pts_google_${new Date().toISOString().slice(0, 10)}.csv`;
const DELAY_MS = 300; // between API calls to avoid quota issues

// Fields we want from Google Places (New API)
const DETAIL_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.regularOpeningHours",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.photos",
  "places.editorialSummary",
].join(",");

// Search locations: major Australian cities and suburbs to cover broad area
// Each entry: [query suffix, lat, lng]
const SEARCH_LOCATIONS: Record<string, [string, number, number][]> = {
  WA: [
    ["Perth CBD", -31.9505, 115.8605],
    ["Fremantle", -32.0569, 115.7439],
    ["Joondalup", -31.7467, 115.7677],
    ["Rockingham", -32.2772, 115.7301],
    ["Midland", -31.8891, 116.0104],
    ["Armadale WA", -32.1532, 116.0103],
    ["Scarborough WA", -31.8940, 115.7580],
    ["Subiaco", -31.9440, 115.8270],
    ["Morley WA", -31.8920, 115.9050],
    ["Cannington", -32.0169, 115.9340],
    ["Canning Vale", -32.0630, 115.9185],
    ["Baldivis", -32.3240, 115.7830],
    ["Ellenbrook", -31.7650, 116.0530],
    ["Mandurah", -32.5269, 115.7217],
    ["Bunbury", -33.3271, 115.6414],
  ],
  NSW: [
    ["Sydney CBD", -33.8688, 151.2093],
    ["Parramatta", -33.8151, 151.0011],
    ["Bondi", -33.8915, 151.2767],
    ["Chatswood", -33.7969, 151.1832],
    ["Liverpool NSW", -33.9200, 150.9237],
    ["Penrith", -33.7510, 150.6944],
    ["Manly NSW", -33.7981, 151.2877],
    ["Cronulla", -34.0548, 151.1517],
    ["Newtown NSW", -33.8975, 151.1786],
    ["Bankstown", -33.9175, 151.0350],
    ["Newcastle", -32.9283, 151.7817],
    ["Wollongong", -34.4278, 150.8931],
  ],
  VIC: [
    ["Melbourne CBD", -37.8136, 144.9631],
    ["St Kilda", -37.8578, 144.9797],
    ["Richmond VIC", -37.8235, 145.0000],
    ["South Yarra", -37.8388, 144.9921],
    ["Brunswick VIC", -37.7654, 144.9605],
    ["Hawthorn VIC", -37.8167, 145.0366],
    ["Footscray", -37.7990, 144.8994],
    ["Caulfield", -37.8777, 145.0233],
    ["Geelong", -38.1499, 144.3617],
    ["Ballarat", -37.5622, 143.8503],
  ],
  QLD: [
    ["Brisbane CBD", -27.4698, 153.0251],
    ["Gold Coast", -28.0167, 153.4000],
    ["Surfers Paradise", -28.0029, 153.4300],
    ["Sunshine Coast", -26.6500, 153.0667],
    ["Fortitude Valley", -27.4577, 153.0357],
    ["Carindale", -27.5058, 153.1017],
    ["Chermside", -27.3872, 153.0338],
    ["Toowoomba", -27.5598, 151.9507],
    ["Cairns", -16.9186, 145.7781],
    ["Townsville", -19.2590, 146.8169],
  ],
  SA: [
    ["Adelaide CBD", -34.9285, 138.6007],
    ["Glenelg", -34.9821, 138.5126],
    ["Norwood SA", -34.9218, 138.6316],
    ["Unley", -34.9499, 138.5937],
    ["Port Adelaide", -34.8469, 138.5034],
  ],
  TAS: [
    ["Hobart", -42.8821, 147.3272],
    ["Launceston", -41.4332, 147.1441],
  ],
};

const OUTPUT_FIELDS = [
  "googlePlaceId",
  "name",
  "formattedAddress",
  "addressStreet",
  "addressSuburb",
  "addressState",
  "addressPostcode",
  "lat",
  "lng",
  "phone",
  "internationalPhone",
  "email",
  "website",
  "googleMapsUrl",
  "rating",
  "ratingCount",
  "businessStatus",
  "primaryType",
  "types",
  "description",
  "hoursMonday",
  "hoursTuesday",
  "hoursWednesday",
  "hoursThursday",
  "hoursFriday",
  "hoursSaturday",
  "hoursSunday",
  "photoCount",
  "photoRefs",
  "searchQuery",
  "searchLocation",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    state: get("--state")?.toUpperCase(),
    limit: get("--limit") ? parseInt(get("--limit")!) : undefined,
    radius: get("--radius") ? parseInt(get("--radius")!) : 20000, // 20km default
    output: get("--output"),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadProcessedIds(outputCsv: string): Set<string> {
  if (!fs.existsSync(outputCsv)) return new Set();
  const rows = parse(fs.readFileSync(outputCsv, "utf8"), { columns: true });
  return new Set(rows.map((r: any) => r.googlePlaceId));
}

function appendRow(outputCsv: string, row: Record<string, string>) {
  const isNew = !fs.existsSync(outputCsv);
  const line = stringify([row], { header: isNew, columns: OUTPUT_FIELDS });
  fs.appendFileSync(outputCsv, line, "utf8");
}

// Parse address components from Google Places API
function parseAddressComponents(
  components: any[]
): {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
} {
  const get = (type: string) =>
    components?.find((c: any) => c.types?.includes(type))?.longText || "";

  const streetNumber = get("street_number");
  const route = get("route");
  const street = [streetNumber, route].filter(Boolean).join(" ");
  const suburb = get("locality") || get("sublocality") || get("neighborhood") || "";
  const state = components?.find((c: any) => c.types?.includes("administrative_area_level_1"))?.shortText || "";
  const postcode = get("postal_code");

  return { street, suburb, state, postcode };
}

// Format opening hours into per-day strings
function formatHours(
  openingHours: any
): Record<string, string> {
  const result: Record<string, string> = {
    hoursMonday: "",
    hoursTuesday: "",
    hoursWednesday: "",
    hoursThursday: "",
    hoursFriday: "",
    hoursSaturday: "",
    hoursSunday: "",
  };

  if (!openingHours?.periods) return result;

  const dayMap: Record<number, string> = {
    0: "hoursSunday",
    1: "hoursMonday",
    2: "hoursTuesday",
    3: "hoursWednesday",
    4: "hoursThursday",
    5: "hoursFriday",
    6: "hoursSaturday",
  };

  for (const period of openingHours.periods) {
    const dayKey = dayMap[period.open?.day];
    if (!dayKey) continue;

    const openH = period.open?.hour ?? 0;
    const openM = period.open?.minute ?? 0;
    const closeH = period.close?.hour ?? 0;
    const closeM = period.close?.minute ?? 0;

    const fmt = (h: number, m: number) => {
      const suffix = h >= 12 ? "PM" : "AM";
      const hh = h % 12 || 12;
      return m === 0 ? `${hh}${suffix}` : `${hh}:${String(m).padStart(2, "0")}${suffix}`;
    };

    // 24-hour check
    if (openH === 0 && openM === 0 && closeH === 23 && closeM === 59) {
      result[dayKey] = "Open 24 hours";
    } else {
      const existing = result[dayKey];
      const slot = `${fmt(openH, openM)} - ${fmt(closeH, closeM)}`;
      result[dayKey] = existing ? `${existing}, ${slot}` : slot;
    }
  }

  return result;
}

// ── Google Places API (New) ──────────────────────────────────────────────────

const BASE_URL = "https://places.googleapis.com/v1/places:searchText";

interface SearchResult {
  places?: any[];
  nextPageToken?: string;
}

async function textSearch(
  query: string,
  lat: number,
  lng: number,
  radiusM: number,
  pageToken?: string
): Promise<SearchResult> {
  const body: any = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusM,
      },
    },
    maxResultCount: 20,
    languageCode: "en",
    regionCode: "AU",
  };

  if (pageToken) {
    body.pageToken = pageToken;
  }

  const resp = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY!,
      "X-Goog-FieldMask": DETAIL_FIELDS + ",nextPageToken",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Places API error ${resp.status}: ${errText.slice(0, 300)}`);
  }

  return resp.json();
}

function placeToRow(
  place: any,
  searchQuery: string,
  searchLocation: string
): Record<string, string> {
  const addr = parseAddressComponents(place.addressComponents);
  const hours = formatHours(place.regularOpeningHours);

  // Extract photo references (first 6)
  const photos = (place.photos || []).slice(0, 6);
  const photoRefs = photos
    .map((p: any) => p.name) // e.g. "places/ChIJ.../photos/AelY..."
    .join("|");

  return {
    googlePlaceId: place.id || "",
    name: place.displayName?.text || "",
    formattedAddress: place.formattedAddress || "",
    addressStreet: addr.street,
    addressSuburb: addr.suburb,
    addressState: addr.state,
    addressPostcode: addr.postcode,
    lat: String(place.location?.latitude || ""),
    lng: String(place.location?.longitude || ""),
    phone: place.nationalPhoneNumber || "",
    internationalPhone: place.internationalPhoneNumber || "",
    email: "", // Google Places doesn't return email directly
    website: place.websiteUri || "",
    googleMapsUrl: place.googleMapsUri || "",
    rating: String(place.rating || ""),
    ratingCount: String(place.userRatingCount || ""),
    businessStatus: place.businessStatus || "",
    primaryType: place.primaryTypeDisplayName?.text || place.primaryType || "",
    types: (place.types || []).join("|"),
    description: place.editorialSummary?.text || "",
    ...hours,
    photoCount: String(photos.length),
    photoRefs,
    searchQuery,
    searchLocation,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const OUTPUT_CSV = path.resolve(opts.output ?? DEFAULT_OUTPUT);

  if (!API_KEY) {
    console.error("Error: GOOGLE_PLACES_API_KEY not found in environment or .env.local");
    process.exit(1);
  }

  // Determine which states to search
  const states = opts.state
    ? [opts.state]
    : Object.keys(SEARCH_LOCATIONS);

  const allLocations: { state: string; label: string; lat: number; lng: number }[] = [];
  for (const st of states) {
    const locs = SEARCH_LOCATIONS[st];
    if (!locs) {
      console.error(`Unknown state: ${st}. Available: ${Object.keys(SEARCH_LOCATIONS).join(", ")}`);
      process.exit(1);
    }
    for (const [label, lat, lng] of locs) {
      allLocations.push({ state: st, label, lat, lng });
    }
  }

  console.log(`Searching ${allLocations.length} locations across ${states.join(", ")}`);
  console.log(`Radius: ${(opts.radius / 1000).toFixed(0)}km | Output: ${OUTPUT_CSV}\n`);

  // Load already-processed place IDs for dedup
  const processed = loadProcessedIds(OUTPUT_CSV);
  console.log(`Already scraped: ${processed.size.toLocaleString()} place IDs\n`);

  const SEARCH_QUERIES = [
    "personal trainer",
    "personal training studio",
    "fitness coach",
    "PT studio",
  ];

  let totalNew = 0;
  let totalSkipped = 0;
  let totalApiCalls = 0;

  for (const loc of allLocations) {
    for (const query of SEARCH_QUERIES) {
      const fullQuery = `${query} near ${loc.label}`;
      process.stdout.write(`🔍 "${fullQuery}" ... `);

      let pageToken: string | undefined;
      let locationNew = 0;
      let locationSkipped = 0;
      let pageNum = 0;

      // Paginate through all results
      do {
        try {
          totalApiCalls++;
          const result = await textSearch(
            fullQuery,
            loc.lat,
            loc.lng,
            opts.radius,
            pageToken
          );

          const places = result.places || [];
          pageNum++;

          for (const place of places) {
            const placeId = place.id;
            if (!placeId || processed.has(placeId)) {
              locationSkipped++;
              continue;
            }

            // Check it's in Australia
            const addr = parseAddressComponents(place.addressComponents);
            const country = place.addressComponents?.find(
              (c: any) => c.types?.includes("country")
            )?.shortText;
            if (country && country !== "AU") {
              locationSkipped++;
              continue;
            }

            processed.add(placeId);
            const row = placeToRow(place, query, loc.label);
            appendRow(OUTPUT_CSV, row);
            locationNew++;
          }

          pageToken = result.nextPageToken;
          if (pageToken) await sleep(DELAY_MS);
        } catch (err: any) {
          console.error(`\n  ERROR: ${err.message}`);
          pageToken = undefined;
        }
      } while (pageToken);

      totalNew += locationNew;
      totalSkipped += locationSkipped;
      console.log(
        `${locationNew} new, ${locationSkipped} dupes (${pageNum} page${pageNum > 1 ? "s" : ""})`
      );

      // Check limit
      if (opts.limit && totalNew >= opts.limit) {
        console.log(`\nReached --limit ${opts.limit}, stopping.`);
        break;
      }

      await sleep(DELAY_MS);
    }

    if (opts.limit && totalNew >= opts.limit) break;
  }

  // Summary
  console.log(`\n── Done ──`);
  console.log(`  New PTs scraped : ${totalNew}`);
  console.log(`  Duplicates skip : ${totalSkipped}`);
  console.log(`  API calls       : ${totalApiCalls}`);
  console.log(`  Total in file   : ${processed.size}`);
  console.log(`\nOutput: ${OUTPUT_CSV}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
