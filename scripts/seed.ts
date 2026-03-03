// One-time DynamoDB seeder — run after `npx ampx sandbox` has provisioned tables:
//   npx tsx scripts/seed.ts
//
// Creates all 16 gyms from data/gyms.json in the DynamoDB Gym table.
// Safe to re-run: existing items will produce an error (logged) but won't
// overwrite, because create() uses a new UUID unless you pass { id }.
// To re-seed cleanly, delete all Gym items in the AWS console first.

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const outputs = require("../amplify_outputs.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const gymsJson = require("../data/gyms.json");

Amplify.configure(outputs);

const client = generateClient<Schema>({ authMode: "apiKey" });

interface GymJson {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  address: { street: string; suburb: string; state: string; postcode: string };
  phone: string;
  email: string;
  website: string;
  lat: number;
  lng: number;
  amenities: string[];
  hours: {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
  };
  pricePerWeek: number;
  images: string[];
}

async function seed() {
  const gyms: GymJson[] = gymsJson;
  console.log(`Seeding ${gyms.length} gyms into DynamoDB…`);

  for (const gym of gyms) {
    const { errors } = await client.models.Gym.create({
      id: gym.id,
      ownerId: gym.ownerId,
      name: gym.name,
      description: gym.description,
      images: gym.images,
      amenities: gym.amenities,
      lat: gym.lat,
      lng: gym.lng,
      pricePerWeek: gym.pricePerWeek,
      addressStreet: gym.address.street,
      addressSuburb: gym.address.suburb,
      addressState: gym.address.state,
      addressPostcode: gym.address.postcode,
      phone: gym.phone,
      email: gym.email,
      website: gym.website,
      hoursMonday: gym.hours.monday,
      hoursTuesday: gym.hours.tuesday,
      hoursWednesday: gym.hours.wednesday,
      hoursThursday: gym.hours.thursday,
      hoursFriday: gym.hours.friday,
      hoursSaturday: gym.hours.saturday,
      hoursSunday: gym.hours.sunday,
    });

    if (errors?.length) {
      console.error(`  ✗ ${gym.name}:`, errors.map((e) => e.message).join(", "));
    } else {
      console.log(`  ✓ ${gym.name}`);
    }
  }

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
