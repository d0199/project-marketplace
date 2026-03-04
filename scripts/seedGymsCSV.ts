import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!API_KEY) {
  console.error("GOOGLE_PLACES_API_KEY not found in .env.local");
  process.exit(1);
}

const WA_LOCATIONS = [
  "Perth CBD", "Fremantle", "Joondalup", "Midland", "Rockingham",
  "Mandurah", "Armadale", "Stirling", "Cannington", "Subiaco",
  "Osborne Park", "Morley", "Claremont", "Northbridge", "Victoria Park",
  "Balcatta", "Innaloo", "Karrinyup", "Ellenbrook", "Bunbury",
];

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

async function searchGymsInArea(location: string): Promise<Gym[]> {
  console.log(`  Searching: ${location}...`);

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
        textQuery: `gym fitness centre ${location} Western Australia`,
        maxResultCount: 20,
        locationBias: {
          circle: {
            center: { latitude: -31.9505, longitude: 115.8605 },
            radius: 50000,
          },
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
    state: "WA",
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

async function seed() {
  console.log("\nStarting WA Gym Seed to CSV...\n");

  const allGyms: Gym[] = [];
  const seen = new Set<string>();

  for (const location of WA_LOCATIONS) {
    const gyms = await searchGymsInArea(location);
    for (const gym of gyms) {
      if (!seen.has(gym.id)) {
        seen.add(gym.id);
        allGyms.push(gym);
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\nResults:`);
  console.log(`  Unique gyms found: ${allGyms.length}`);
  console.log(`  API calls used:    ${WA_LOCATIONS.length} / 10,000 free`);

  const outputPath = path.join(process.cwd(), "data", "gyms_wa.csv");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, toCSV(allGyms), "utf8");

  console.log(`\nCSV saved to: data/gyms_wa.csv`);
  console.log(`Done!\n`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
