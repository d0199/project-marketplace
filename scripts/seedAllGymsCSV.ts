/**
 * scripts/seedAllGymsCSV.ts
 * Fetches gym listings from Google Places API for ALL Australian states
 * (WA, NSW, VIC, QLD, SA, TAS, NT, ACT). Runs two queries per location
 * ("gym" + "fitness centre") to maximise results past the 20-result cap.
 * Outputs: data/gyms_all.csv
 *
 * Run:  npx tsx scripts/seedAllGymsCSV.ts
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

const SEARCH_TERMS = ["gym", "fitness centre"];

const STATE_CONFIGS: Record<string, {
  center: { latitude: number; longitude: number };
  radius: number;
  locations: string[];
}> = {
  WA: {
    center: { latitude: -31.9505, longitude: 115.8605 },
    radius: 50000,
    locations: [
      "Perth CBD", "Fremantle", "Joondalup", "Midland", "Rockingham",
      "Mandurah", "Armadale", "Stirling", "Cannington", "Subiaco",
      "Osborne Park", "Morley", "Claremont", "Northbridge", "Victoria Park",
      "Balcatta", "Innaloo", "Karrinyup", "Ellenbrook", "Bassendean",
      "Bayswater", "Belmont", "Canning Vale", "Cockburn", "Fremantle",
      "Gosnells", "Kelmscott", "Melville", "Murdoch", "Nedlands",
    ],
  },
  WA_REGIONAL: {
    center: { latitude: -33.3271, longitude: 115.6414 },
    radius: 50000,
    locations: [
      "Bunbury", "Busselton", "Geraldton", "Kalgoorlie",
    ],
  },
  NSW: {
    center: { latitude: -33.8688, longitude: 151.2093 },
    radius: 50000,
    locations: [
      "Sydney CBD", "Parramatta", "Liverpool", "Penrith", "Blacktown",
      "Chatswood", "Bondi", "Newtown", "Surry Hills", "North Sydney",
      "Hornsby", "Ryde", "Hurstville", "Bankstown", "Castle Hill",
      "Campbelltown", "Cronulla", "Manly", "Dee Why", "Pymble",
      "Strathfield", "Burwood", "Auburn", "Fairfield", "Cabramatta",
      "Kogarah", "Rockdale", "Sutherland", "Miranda", "Caringbah",
      "Mascot", "Zetland", "Waterloo", "Redfern", "Glebe",
      "Balmain", "Leichhardt", "Marrickville", "Ashfield", "Homebush",
    ],
  },
  NSW_REGIONAL: {
    center: { latitude: -32.9283, longitude: 151.7817 },
    radius: 50000,
    locations: [
      "Newcastle", "Maitland", "Lake Macquarie", "Cessnock",
      "Charlestown", "Glendale", "Kotara", "Hamilton",
    ],
  },
  NSW_SOUTH: {
    center: { latitude: -34.4278, longitude: 150.8931 },
    radius: 30000,
    locations: [
      "Wollongong", "Shellharbour", "Kiama", "Figtree", "Warrawong",
    ],
  },
  NSW_CENTRAL: {
    center: { latitude: -33.4169, longitude: 151.3424 },
    radius: 30000,
    locations: [
      "Gosford", "Wyong", "Tuggerah", "Terrigal",
    ],
  },
  VIC: {
    center: { latitude: -37.8136, longitude: 144.9631 },
    radius: 50000,
    locations: [
      "Melbourne CBD", "St Kilda", "Richmond", "Fitzroy", "Collingwood",
      "South Yarra", "Prahran", "Carlton", "Footscray", "Sunshine",
      "Dandenong", "Frankston", "Ringwood", "Box Hill", "Hawthorn",
      "Northcote", "Brunswick", "Doncaster", "Werribee", "Cranbourne",
      "Coburg", "Preston", "Reservoir", "Heidelberg", "Bundoora",
      "Epping", "Craigieburn", "Melton", "Hoppers Crossing", "Point Cook",
      "Moorabbin", "Bentleigh", "Oakleigh", "Chadstone", "Glen Waverley",
      "Knox", "Boronia", "Lilydale", "Croydon", "Springvale",
    ],
  },
  VIC_REGIONAL: {
    center: { latitude: -38.1499, longitude: 144.3617 },
    radius: 30000,
    locations: [
      "Geelong", "Geelong West", "Norlane", "Corio",
      "Ballarat", "Wendouree",
      "Bendigo", "Kangaroo Flat",
    ],
  },
  QLD: {
    center: { latitude: -27.4698, longitude: 153.0251 },
    radius: 50000,
    locations: [
      "Brisbane CBD", "Fortitude Valley", "South Brisbane", "Toowong",
      "Indooroopilly", "Chermside", "Carindale", "Ipswich", "Redcliffe",
      "Strathpine", "Eight Mile Plains", "Springwood", "Browns Plains",
      "Woolloongabba", "Coorparoo", "Wynnum", "Nundah", "Aspley",
      "Stafford", "Everton Park", "Mitchelton", "Keperra", "Ferny Grove",
      "Inala", "Richlands", "Forest Lake", "Sunnybank", "Runcorn",
      "Acacia Ridge", "Moorooka", "Yeronga", "Annerley", "Greenslopes",
      "Norman Park", "Bulimba", "Hawthorne", "Tingalpa", "Capalaba",
    ],
  },
  QLD_GOLDCOAST: {
    center: { latitude: -28.0167, longitude: 153.4000 },
    radius: 50000,
    locations: [
      "Gold Coast", "Southport", "Robina", "Helensvale",
      "Surfers Paradise", "Nerang", "Coomera", "Labrador",
      "Bundall", "Ashmore", "Molendinar", "Arundel",
      "Burleigh Heads", "Tugun", "Coolangatta",
    ],
  },
  QLD_SUNSHINE: {
    center: { latitude: -26.6500, longitude: 153.0667 },
    radius: 50000,
    locations: [
      "Sunshine Coast", "Maroochydore", "Caloundra", "Noosa", "Nambour",
      "Kawana", "Mooloolaba", "Buderim", "Sippy Downs",
    ],
  },
  QLD_NORTH: {
    center: { latitude: -19.2590, longitude: 146.8169 },
    radius: 50000,
    locations: [
      "Townsville", "Aitkenvale", "Kirwan", "Mount Louisa",
      "Cairns", "Manunda", "Earlville", "Smithfield",
    ],
  },
  SA: {
    center: { latitude: -34.9285, longitude: 138.6007 },
    radius: 50000,
    locations: [
      "Adelaide CBD", "Glenelg", "Salisbury", "Elizabeth", "Marion",
      "Norwood", "Unley", "Mitcham", "Port Adelaide", "Morphett Vale",
      "Tea Tree Gully", "Modbury", "Golden Grove", "Mawson Lakes",
      "Christies Beach", "Noarlunga", "Hallett Cove", "Reynella",
      "Parafield Gardens", "Pooraka", "Prospect", "Enfield",
      "Campbelltown SA", "Newton SA", "Burnside SA",
    ],
  },
  SA_REGIONAL: {
    center: { latitude: -33.7000, longitude: 136.0000 },
    radius: 50000,
    locations: [
      "Mount Gambier", "Whyalla", "Port Augusta", "Port Pirie",
    ],
  },
  TAS: {
    center: { latitude: -42.8821, longitude: 147.3272 },
    radius: 40000,
    locations: [
      "Hobart", "Sandy Bay", "Glenorchy", "Moonah", "Kingston",
      "Bellerive", "Rosny", "Lindisfarne",
    ],
  },
  TAS_NORTH: {
    center: { latitude: -41.2000, longitude: 146.8000 },
    radius: 50000,
    locations: [
      "Launceston", "Invermay", "Newnham", "Kings Meadows",
      "Devonport", "Burnie", "Ulverstone",
    ],
  },
  NT: {
    center: { latitude: -12.4634, longitude: 130.8456 },
    radius: 50000,
    locations: [
      "Darwin CBD", "Casuarina", "Palmerston", "Nightcliff",
      "Rapid Creek", "Winnellie", "Stuart Park", "Fannie Bay",
    ],
  },
  NT_CENTRAL: {
    center: { latitude: -23.6980, longitude: 133.8807 },
    radius: 40000,
    locations: [
      "Alice Springs", "Larapinta", "Gillen",
    ],
  },
  ACT: {
    center: { latitude: -35.2809, longitude: 149.1300 },
    radius: 40000,
    locations: [
      "Canberra CBD", "Belconnen", "Tuggeranong", "Woden",
      "Gungahlin", "Bruce", "Phillip", "Fyshwick",
      "Braddon", "Kingston", "Manuka", "Weston Creek",
    ],
  },
};

const STATE_CODE: Record<string, string> = {
  WA: "WA", WA_REGIONAL: "WA",
  NSW: "NSW", NSW_REGIONAL: "NSW", NSW_SOUTH: "NSW", NSW_CENTRAL: "NSW",
  VIC: "VIC", VIC_REGIONAL: "VIC",
  QLD: "QLD", QLD_GOLDCOAST: "QLD", QLD_SUNSHINE: "QLD", QLD_NORTH: "QLD",
  SA: "SA", SA_REGIONAL: "SA",
  TAS: "TAS", TAS_NORTH: "TAS",
  NT: "NT", NT_CENTRAL: "NT",
  ACT: "ACT",
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

async function searchGyms(
  query: string,
  state: string,
  center: { latitude: number; longitude: number },
  radius: number,
): Promise<Gym[]> {
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
        textQuery: query,
        maxResultCount: 20,
        locationBias: { circle: { center, radius } },
      }),
    }
  );

  const data = await response.json() as any;

  if (data.error) {
    console.error(`  API error: ${data.error.message}`);
    return [];
  }

  return (data.places ?? []).map((place: any) => ({
    id: place.id ?? "",
    name: place.displayName?.text ?? "",
    address: place.formattedAddress ?? "",
    suburb: "",
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
  // Optional: --states=NT,ACT  to run only specific state codes
  const statesArg = process.argv.find((a) => a.startsWith("--states="));
  const filterStates = statesArg
    ? new Set(statesArg.replace("--states=", "").split(",").map((s) => s.trim().toUpperCase()))
    : null;

  const activeGroups = Object.entries(STATE_CONFIGS).filter(([groupKey]) => {
    if (!filterStates) return true;
    return filterStates.has(STATE_CODE[groupKey]);
  });

  const stateLabel = filterStates ? [...filterStates].join(", ") : "all Australian states";
  console.log(`\nFetching gyms for ${stateLabel}...\n`);
  console.log("Running 2 queries per location (gym + fitness centre)\n");

  const allGyms: Gym[] = [];
  const seen = new Set<string>();
  let totalCalls = 0;

  for (const [groupKey, config] of activeGroups) {
    const stateCode = STATE_CODE[groupKey];
    console.log(`\n--- ${stateCode} (${groupKey}) ---`);

    for (const location of config.locations) {
      let locationNew = 0;

      for (const term of SEARCH_TERMS) {
        const query = `${term} ${location} ${stateCode} Australia`;
        const gyms = await searchGyms(query, stateCode, config.center, config.radius);
        totalCalls++;

        for (const gym of gyms) {
          if (gym.id && !seen.has(gym.id)) {
            seen.add(gym.id);
            gym.suburb = location;
            allGyms.push(gym);
            locationNew++;
          }
        }

        await new Promise((r) => setTimeout(r, 1100));
      }

      console.log(`  ${location}: +${locationNew} unique (total: ${allGyms.length})`);
    }
  }

  const byState = allGyms.reduce<Record<string, number>>((acc, g) => {
    acc[g.state] = (acc[g.state] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\nResults:`);
  console.log(`  Unique gyms found: ${allGyms.length}`);
  for (const [state, count] of Object.entries(byState).sort()) {
    console.log(`    ${state}: ${count}`);
  }
  console.log(`  API calls used: ${totalCalls}`);

  const suffix = filterStates ? [...filterStates].join("_").toLowerCase() : "all";
  const csvFile = `gyms_${suffix}.csv`;
  const outputPath = path.join(process.cwd(), "data", csvFile);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, toCSV(allGyms), "utf8");

  console.log(`\nCSV saved to: data/${csvFile}`);
  console.log(`Next: npx tsx scripts/buildAllGymsJson.ts data/${csvFile}`);
  console.log(`Then: npx tsx scripts/importGyms.ts data/gyms_${suffix}.json\n`);
}

run().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
