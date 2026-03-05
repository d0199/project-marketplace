import { createRequire } from "module";
import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";
import type { Schema } from "../../amplify/backend";
import type { Gym } from "@/types";
import { postcodeToState } from "./utils";

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
    isActive: r.isActive ?? true,
    isTest: r.isTest ?? false,
    isFeatured: r.isFeatured ?? false,
    priceVerified: r.priceVerified ?? false,
    isPaid: r.isPaid ?? false,
    ...(r.googlePlaceId != null && { googlePlaceId: r.googlePlaceId }),
    name: r.name ?? "",
    description: r.description ?? "",
    address: {
      street: r.addressStreet ?? "",
      suburb: r.addressSuburb ?? "",
      state: r.addressState || postcodeToState(r.addressPostcode ?? ""),
      postcode: r.addressPostcode ?? "",
    },
    phone: r.phone ?? "",
    email: r.email ?? "",
    website: r.website ?? "",
    ...(r.instagram != null && { instagram: r.instagram }),
    ...(r.facebook != null && { facebook: r.facebook }),
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
    ...(r.hoursComment != null && { hoursComment: r.hoursComment }),
    memberOffers: (r.memberOffers?.filter(Boolean) ?? []) as string[],
    ...(r.memberOffersNotes != null && { memberOffersNotes: r.memberOffersNotes }),
    memberOffersScroll: r.memberOffersScroll ?? false,
    ...(r.memberScrollText != null && { memberScrollText: r.memberScrollText }),
    ...(r.memberOffersTnC != null && { memberOffersTnC: r.memberOffersTnC }),
    pricePerWeek: r.pricePerWeek ?? 0,
    images: (r.images?.filter(Boolean) ?? []) as string[],
  };
}

function fromGym(gym: Gym) {
  return {
    id: gym.id,
    ownerId: gym.ownerId,
    isActive: gym.isActive ?? true,
    isTest: gym.isTest ?? false,
    isFeatured: gym.isFeatured ?? false,
    priceVerified: gym.priceVerified ?? false,
    isPaid: gym.isPaid ?? false,
    googlePlaceId: gym.googlePlaceId,
    name: gym.name,
    description: gym.description,
    addressStreet: gym.address.street,
    addressSuburb: gym.address.suburb,
    addressState: gym.address.state,
    addressPostcode: gym.address.postcode,
    phone: gym.phone,
    email: gym.email,
    website: gym.website,
    instagram: gym.instagram,
    facebook: gym.facebook,
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
    hoursComment: gym.hoursComment,
    memberOffers: gym.memberOffers,
    memberOffersNotes: gym.memberOffersNotes,
    memberOffersScroll: gym.memberOffersScroll ?? false,
    memberScrollText: gym.memberScrollText,
    memberOffersTnC: gym.memberOffersTnC,
    pricePerWeek: gym.pricePerWeek,
    images: gym.images,
  };
}

// ---------------------------------------------------------------------------
// Pagination helper — exhausts all pages from a list() call
// ---------------------------------------------------------------------------
async function listAllGyms(
  filter?: Parameters<typeof dataClient.models.Gym.list>[0]
): Promise<GymRecord[]> {
  const results: GymRecord[] = [];
  let nextToken: string | null | undefined;
  do {
    const res = await dataClient.models.Gym.list({
      ...filter,
      limit: 1000,
      nextToken,
    });
    results.push(...(res.data ?? []));
    nextToken = res.nextToken;
  } while (nextToken);
  return results;
}

// ---------------------------------------------------------------------------
// Store — falls back to gyms.json until the Amplify backend is deployed
// ---------------------------------------------------------------------------
export const ownerStore = {
  async getAll(): Promise<Gym[]> {
    if (!isAmplifyConfigured()) return seedGyms;
    return (await listAllGyms()).map(toGym);
  },

  async getById(id: string): Promise<Gym | undefined> {
    if (!isAmplifyConfigured()) return seedGyms.find((g) => g.id === id);
    const { data } = await dataClient.models.Gym.get({ id });
    return data ? toGym(data) : undefined;
  },

  async getByOwner(ownerId: string): Promise<Gym[]> {
    if (!isAmplifyConfigured())
      return seedGyms.filter((g) => g.ownerId === ownerId);
    return (
      await listAllGyms({ filter: { ownerId: { eq: ownerId } } })
    ).map(toGym);
  },

  async update(gym: Gym): Promise<void> {
    if (!isAmplifyConfigured()) return; // no-op until backend is live
    await dataClient.models.Gym.update(fromGym(gym));
  },

  async create(gym: Omit<Gym, "id">): Promise<Gym> {
    if (!isAmplifyConfigured()) throw new Error("Backend not configured");
    const { data } = await dataClient.models.Gym.create({
      ownerId: gym.ownerId,
      isActive: gym.isActive ?? true,
      isTest: gym.isTest ?? false,
      isFeatured: gym.isFeatured ?? false,
      priceVerified: gym.priceVerified ?? false,
      isPaid: gym.isPaid ?? false,
      name: gym.name,
      description: gym.description,
      addressStreet: gym.address.street,
      addressSuburb: gym.address.suburb,
      addressState: gym.address.state,
      addressPostcode: gym.address.postcode,
      phone: gym.phone,
      email: gym.email,
      website: gym.website,
      instagram: gym.instagram,
      facebook: gym.facebook,
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
      hoursComment: gym.hoursComment,
      memberOffers: gym.memberOffers,
      memberOffersNotes: gym.memberOffersNotes,
      memberOffersScroll: gym.memberOffersScroll ?? false,
      memberScrollText: gym.memberScrollText,
      memberOffersTnC: gym.memberOffersTnC,
      pricePerWeek: gym.pricePerWeek,
      images: gym.images,
    });
    if (!data) throw new Error("Failed to create gym");
    return toGym(data);
  },

  async delete(id: string): Promise<void> {
    if (!isAmplifyConfigured()) return;
    await dataClient.models.Gym.delete({ id });
  },
};
