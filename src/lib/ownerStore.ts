import { createRequire } from "module";
import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";
import type { Schema } from "../../amplify/backend";
import type { Gym } from "@/types";

const require = createRequire(import.meta.url);
const seedGyms: Gym[] = require("../../data/gyms.json");

// ---------------------------------------------------------------------------
// Shape converters between the flat DynamoDB record and the nested Gym type
// ---------------------------------------------------------------------------
type GymRecord = Schema["Gym"]["type"];

function toGym(r: GymRecord): Gym {
  return {
    id: r.id,
    ownerId: r.ownerId ?? "",
    name: r.name ?? "",
    description: r.description ?? "",
    address: {
      street: r.addressStreet ?? "",
      suburb: r.addressSuburb ?? "",
      state: r.addressState ?? "",
      postcode: r.addressPostcode ?? "",
    },
    phone: r.phone ?? "",
    email: r.email ?? "",
    website: r.website ?? "",
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    amenities: (r.amenities?.filter(Boolean) ?? []) as string[],
    hours: {
      monday: r.hoursMonday ?? null,
      tuesday: r.hoursTuesday ?? null,
      wednesday: r.hoursWednesday ?? null,
      thursday: r.hoursThursday ?? null,
      friday: r.hoursFriday ?? null,
      saturday: r.hoursSaturday ?? null,
      sunday: r.hoursSunday ?? null,
    },
    pricePerWeek: r.pricePerWeek ?? 0,
    images: (r.images?.filter(Boolean) ?? []) as string[],
  };
}

function fromGym(gym: Gym) {
  return {
    id: gym.id,
    ownerId: gym.ownerId,
    name: gym.name,
    description: gym.description,
    addressStreet: gym.address.street,
    addressSuburb: gym.address.suburb,
    addressState: gym.address.state,
    addressPostcode: gym.address.postcode,
    phone: gym.phone,
    email: gym.email,
    website: gym.website,
    lat: gym.lat,
    lng: gym.lng,
    amenities: gym.amenities,
    hoursMonday: gym.hours.monday,
    hoursTuesday: gym.hours.tuesday,
    hoursWednesday: gym.hours.wednesday,
    hoursThursday: gym.hours.thursday,
    hoursFriday: gym.hours.friday,
    hoursSaturday: gym.hours.saturday,
    hoursSunday: gym.hours.sunday,
    pricePerWeek: gym.pricePerWeek,
    images: gym.images,
  };
}

// ---------------------------------------------------------------------------
// Store — falls back to gyms.json until the Amplify backend is deployed
// ---------------------------------------------------------------------------
export const ownerStore = {
  async getAll(): Promise<Gym[]> {
    if (!isAmplifyConfigured()) return seedGyms;
    const { data } = await dataClient.models.Gym.list();
    return (data ?? []).map(toGym);
  },

  async getById(id: string): Promise<Gym | undefined> {
    if (!isAmplifyConfigured()) return seedGyms.find((g) => g.id === id);
    const { data } = await dataClient.models.Gym.get({ id });
    return data ? toGym(data) : undefined;
  },

  async getByOwner(ownerId: string): Promise<Gym[]> {
    if (!isAmplifyConfigured())
      return seedGyms.filter((g) => g.ownerId === ownerId);
    const { data } = await dataClient.models.Gym.list({
      filter: { ownerId: { eq: ownerId } },
    });
    return (data ?? []).map(toGym);
  },

  async update(gym: Gym): Promise<void> {
    if (!isAmplifyConfigured()) return; // no-op until backend is live
    await dataClient.models.Gym.update(fromGym(gym));
  },
};
