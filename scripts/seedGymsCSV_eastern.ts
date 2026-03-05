/**
 * scripts/seedGymsCSV_eastern.ts
 * Fetches gym listings from Google Places API for NSW, VIC, QLD, SA & TAS.
 * Outputs: data/gyms_eastern.csv
 *
 * Run:  npx tsx scripts/seedGymsCSV_eastern.ts
 * Requires GOOGLE_PLACES_API_KEY in .env.local
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!API_KEY) {
  console.error("GOOGLE_PLACES_API_KEY not found in .env.local");
  process.exit(1);
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.internationalPhoneNumber",
  "places.websiteUri",
].join(",");

// State centres used as location bias — keeps results within each state
const STATE_CONFIGS: Record<string, {
  center: { latitude: number; longitude: number };
  radius: number;
  locations: string[];
}> = {
  NSW: {
    center: { latitude: -33.8688, longitude: 151.2093 },
    radius: 80000,
    locations: [
      "Sydney CBD", "Parramatta", "Liverpool", "Penrith", "Blacktown",
      "Chatswood", "Bondi", "Newtown", "Surry Hills", "North Sydney",
      "Hornsby", "Ryde", "Hurstville", "Bankstown", "Castle Hill",
      "Campbelltown", "Cronulla", "Manly", "Dee Why", "Pymble",
    ],
  },
  NSW_REGIONAL: {
    center: { latitude: -32.9283, longitude: 151.7817 },
    radius: 60000,
    locations: [
      "Newcastle", "Maitland", "Lake Macquarie",
    ],
  },
  NSW_SOUTH: {
    center: { latitude: -34.4278, longitude: 150.8931 },
    radius: 30000,
    locations: [
      "Wollongong", "Shellharbour", "Kiama",
    ],
  },
  VIC: {
    center: { latitude: -37.8136, longitude: 144.9631 },
    radius: 80000,
    locations: [
      "Melbourne CBD", "St Kilda", "Richmond", "Fitzroy", "Collingwood",
      "South Yarra", "Prahran", "Carlton", "Footscray", "Sunshine",
      "Dandenong", "Frankston", "Ringwood", "Box Hill", "Hawthorn",
      "Northcote", "Brunswick", "Doncaster", "Werribee", "Cranbourne",
    ],
  },
  VIC_REGIONAL: {
    center: { latitude: -38.1499, longitude: 144.3617 },
    radius: 30000,
    locations: [
      "Geelong", "Ballarat", "Bendigo",
    ],
  },
  QLD: {
    center: { latitude: -27.4698, longitude: 153.0251 },
    radius: 60000,
    locations: [
      "Brisbane CBD", "Fortitude Valley", "South Brisbane", "Toowong",
      "Indooroopilly", "Chermside", "Carindale", "Ipswich", "Redcliffe",
      "Strathpine", "Eight Mile Plains", "Springwood", "Browns Plains",
      "Woolloongabba", "Coorparoo", "Wynnum", "Nundah", "Aspley",
    ],
  },
  QLD_GOLDCOAST: {
    center: { latitude: -28.0167, longitude: 153.4000 },
    radius: 40000,
    locations: [
      "Gold Coast", "Southport", "Robina", "Helensvale",
      "Surfers Paradise", "Nerang", "Coomera",
    ],
  },
  QLD_SUNSHINE: {
    center: { latitude: -26.6500, longitude: 153.0667 },
    radius: 40000,
    locations: [
      "Sunshine Coast", "Maroochydore", "Caloundra", "Noosa", "Nambour",
    ],
  },
  QLD_NORTH: {
    center: { latitude: -19.2590, longitude: 146.8169 },
    radius: 50000,
    locations: [
      "Townsville", "Cairns",
    ],
  },
  SA: {
    center: { latitude: -34.9285, longitude: 138.6007 },
    radius: 60000,
    locations: [
      "Adelaide CBD", "Glenelg", "Salisbury", "Elizabeth", "Marion",
      "Norwood", "Unley", "Mitcham", "Port Adelaide", "Morphett Vale",
      "Tea Tree Gully", "Modbury", "Golden Grove", "Mawson Lakes",
      "Christies Beach", "Noarlunga",
    ],
  },
  SA_REGIONAL: {
    center: { latitude: -37.8300, longitude: 140.7833 },
    radius: 20000,
    locations: [
      "Mount Gambier", "Whyalla",
    ],
  },
  TAS: {
    center: { latitude: -42.8821, longitude: 147.3272 },
    radius: 40000,
    locations: [
      "Hobart", "Sandy Bay", "Glenorchy", "Moonah", "Kingston",
    ],
  },
  TAS_NORTH: {
    center: { latitude: -41.4332, longitude: 147.1441 },
    radius: 40000,
    locations: [
      "Launceston", "Devonport", "Burnie", "Ulverstone",
    ],
  },
};

// Maps config group keys back to a canonical state code for the CSV
const STATE_CODE: Record<string, string> = {
  NSW: "NSW", NSW_REGIONAL: "NSW", NSW_SOUTH: "NSW",
  VIC: "VIC", VIC_REGIONAL: "VIC",
  QLD: "QLD", QLD_GOLDCOAST: "QLD", QLD_SUNSHINE: "QLD", QLD_NORTH: "QLD",
  SA: "SA", SA_REGIONAL: "SA",
  TAS: "TAS", TAS_NORTH: "TAS",
};

interface Gym {
  id: string;
  name: string;
  address: string;
  suburb: string;
  lat: number | string;
  lng: number | string;
  rating: string;
  totalRatings: string;
  phone: string;
  website: string;
  state: string;
  country: string;
}

async function searchGymsInArea(
  location: string,
  state: string,
  center: { latitude: number; longitude: number },
  radius: number,
): Promise<Gym[]> {
  console.log(`  Searching: ${location}, ${state}...`);

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY!,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: `gym fitness centre ${location} ${state} Australia`,
        maxResultCount: 20,
        locationBias: {
          circle: { center, radius },
        },
      }),
    }
  );

  const data = await response.json() as any;

  if (data.error) {
    console.error(`  API error for ${location}:`, data.error.message);
    return [];
  }

  if (!data.places || data.places.length === 0) {
    console.log(`  No results for ${location}`);
    return [];
  }

  console.log(`  Found ${data.places.length} gyms in ${location}`);

  return data.places.map((place: any) => ({
    id: place.id ?? "",
    name: place.displayName?.text ?? "",
    address: place.formattedAddress ?? "",
    suburb: location,
    lat: place.location?.latitude ?? "",
    lng: place.location?.longitude ?? "",
    rating: place.rating ?? "",
    totalRatings: place.userRatingCount ?? "",
    phone: place.internationalPhoneNumber ?? "",
    website: place.websiteUri ?? "",
    state,
    country: "AU",
  }));
}

function toCSV(gyms: Gym[]): string {
  const headers = [
    "id", "name", "address", "suburb", "lat", "lng",
    "rating", "totalRatings", "phone", "website", "state", "country",
  ];

  const rows = gyms.map((gym) =>
    headers.map((h) => {
      const value = String((gym as any)[h] ?? "");
      return value.includes(",") || value.includes('"') || value.includes("\n")
        ? `"${value.replace(/"/g, '""')}"`
        : value;
    }).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

async function run() {
  console.log("\nStarting Eastern States Gym Seed to CSV...\n");

  const allGyms: Gym[] = [];
  const seen = new Set<string>();
  let totalCalls = 0;

  for (const [groupKey, config] of Object.entries(STATE_CONFIGS)) {
    const stateCode = STATE_CODE[groupKey];
    console.log(`\n--- ${stateCode} (${groupKey}) ---`);

    for (const location of config.locations) {
      const gyms = await searchGymsInArea(location, stateCode, config.center, config.radius);
      for (const gym of gyms) {
        if (gym.id && !seen.has(gym.id)) {
          seen.add(gym.id);
          allGyms.push(gym);
        }
      }
      totalCalls++;
      // Respect rate limits — 1 request/second
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  const byState = allGyms.reduce<Record<string, number>>((acc, g) => {
    acc[g.state] = (acc[g.state] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\nResults:`);
  console.log(`  Unique gyms found: ${allGyms.length}`);
  for (const [state, count] of Object.entries(byState)) {
    console.log(`    ${state}: ${count}`);
  }
  console.log(`  API calls used: ${totalCalls}`);

  const outputPath = path.join(process.cwd(), "data", "gyms_eastern.csv");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, toCSV(allGyms), "utf8");

  console.log(`\nCSV saved to: data/gyms_eastern.csv`);
  console.log(`Done!\n`);
}

run().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
