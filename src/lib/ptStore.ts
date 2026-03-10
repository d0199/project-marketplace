import { createRequire } from "module";
import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";
import type { Schema } from "../../amplify/backend";
import type { PersonalTrainer } from "@/types";
import { postcodeToState } from "./utils";

const require = createRequire(import.meta.url);
const seedPTs: PersonalTrainer[] = require("../../data/pts.json");

// ---------------------------------------------------------------------------
// Shape converters between the flat DynamoDB record and the nested PT type
// ---------------------------------------------------------------------------
type PTRecord = Schema["PersonalTrainer"]["type"];

function toPT(r: PTRecord): PersonalTrainer {
  return {
    id: r.id,
    ownerId: r.ownerId ?? "",
    isActive: r.isActive ?? true,
    isTest: r.isTest ?? false,
    isFeatured: r.isFeatured ?? false,
    isPaid: r.isPaid ?? false,
    ...(r.stripeSubscriptionId != null && { stripeSubscriptionId: r.stripeSubscriptionId }),
    ...(r.stripePlan != null && { stripePlan: r.stripePlan as "paid" | "featured" }),
    ...(r.createdBy != null && { createdBy: r.createdBy }),
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
    ...(r.tiktok != null && { tiktok: r.tiktok }),
    ...(r.bookingUrl != null && { bookingUrl: r.bookingUrl }),
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    images: (r.images?.filter(Boolean) ?? []) as string[],
    ...(r.imageFocalPoints != null && { imageFocalPoints: r.imageFocalPoints.filter((v) => v != null) as number[] }),
    gymIds: (r.gymIds?.filter(Boolean) ?? []) as string[],
    specialties: (r.specialties?.filter(Boolean) ?? []) as string[],
    qualifications: (r.qualifications?.filter(Boolean) ?? []) as string[],
    ...(r.qualificationsVerified != null && { qualificationsVerified: r.qualificationsVerified }),
    ...(r.qualificationsNotes != null && { qualificationsNotes: r.qualificationsNotes }),
    ...(r.qualificationEvidence != null && { qualificationEvidence: r.qualificationEvidence }),
    memberOffers: (r.memberOffers?.filter(Boolean) ?? []) as string[],
    ...(r.memberOffersNotes != null && { memberOffersNotes: r.memberOffersNotes }),
    ...(r.experienceYears != null && { experienceYears: r.experienceYears }),
    ...(r.pricePerSession != null && { pricePerSession: r.pricePerSession }),
    ...(r.sessionDuration != null && { sessionDuration: r.sessionDuration }),
    ...(r.pricingNotes != null && { pricingNotes: r.pricingNotes }),
    ...(r.availability != null && { availability: r.availability }),
    ...(r.gender != null && { gender: r.gender }),
    languages: (r.languages?.filter(Boolean) ?? []) as string[],
  };
}

function fromPT(pt: PersonalTrainer) {
  return {
    id: pt.id,
    ownerId: pt.ownerId,
    isActive: pt.isActive ?? true,
    isTest: pt.isTest ?? false,
    isFeatured: pt.isFeatured ?? false,
    isPaid: pt.isPaid ?? false,
    stripeSubscriptionId: pt.stripeSubscriptionId,
    stripePlan: pt.stripePlan,
    createdBy: pt.createdBy,
    name: pt.name,
    description: pt.description,
    addressStreet: pt.address.street,
    addressSuburb: pt.address.suburb,
    addressState: pt.address.state,
    addressPostcode: pt.address.postcode,
    phone: pt.phone,
    email: pt.email,
    website: pt.website,
    instagram: pt.instagram,
    facebook: pt.facebook,
    tiktok: pt.tiktok,
    bookingUrl: pt.bookingUrl,
    lat: pt.lat,
    lng: pt.lng,
    images: pt.images,
    imageFocalPoints: pt.imageFocalPoints,
    gymIds: pt.gymIds,
    specialties: pt.specialties,
    qualifications: pt.qualifications,
    qualificationsVerified: pt.qualificationsVerified,
    qualificationsNotes: pt.qualificationsNotes,
    qualificationEvidence: pt.qualificationEvidence,
    memberOffers: pt.memberOffers,
    memberOffersNotes: pt.memberOffersNotes,
    experienceYears: pt.experienceYears,
    pricePerSession: pt.pricePerSession,
    sessionDuration: pt.sessionDuration,
    pricingNotes: pt.pricingNotes,
    availability: pt.availability,
    gender: pt.gender,
    languages: pt.languages,
  };
}

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------
async function listAllPTs(
  filter?: Parameters<typeof dataClient.models.PersonalTrainer.list>[0]
): Promise<PTRecord[]> {
  const results: PTRecord[] = [];
  let nextToken: string | null | undefined;
  do {
    const res = await dataClient.models.PersonalTrainer.list({
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
// In-memory cache
// ---------------------------------------------------------------------------
let _allCache: PersonalTrainer[] | null = null;
let _allCacheTime = 0;
const ALL_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function invalidateCache() {
  _allCache = null;
  _allCacheTime = 0;
}

// ---------------------------------------------------------------------------
// Safety check — PersonalTrainer model may not be deployed yet
// ---------------------------------------------------------------------------
function isModelAvailable(): boolean {
  return isAmplifyConfigured() && !!dataClient.models.PersonalTrainer;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export const ptStore = {
  async getAll(): Promise<PersonalTrainer[]> {
    if (!isModelAvailable()) return seedPTs;
    const now = Date.now();
    if (_allCache && now - _allCacheTime < ALL_CACHE_TTL) return _allCache;
    try {
      const pts = (await listAllPTs()).map(toPT);
      _allCache = pts;
      _allCacheTime = now;
      return pts;
    } catch (err) {
      console.error("[ptStore.getAll] error, falling back to seed:", err);
      return seedPTs;
    }
  },

  async getById(id: string): Promise<PersonalTrainer | undefined> {
    if (!isModelAvailable()) return seedPTs.find((p) => p.id === id);
    try {
      const { data } = await dataClient.models.PersonalTrainer.get({ id });
      return data ? toPT(data) : undefined;
    } catch {
      return seedPTs.find((p) => p.id === id);
    }
  },

  async getByOwner(ownerId: string): Promise<PersonalTrainer[]> {
    if (!isModelAvailable()) return seedPTs.filter((p) => p.ownerId === ownerId);
    try {
      const results: PTRecord[] = [];
      let nextToken: string | null | undefined;
      do {
        const res = await dataClient.models.PersonalTrainer.listPersonalTrainerByOwnerId(
          { ownerId },
          { limit: 1000, nextToken }
        );
        results.push(...(res.data ?? []));
        nextToken = res.nextToken;
      } while (nextToken);
      return results.map(toPT);
    } catch {
      return seedPTs.filter((p) => p.ownerId === ownerId);
    }
  },

  async getByGymId(gymId: string): Promise<PersonalTrainer[]> {
    // No GSI on gymIds — filter client-side from cached list
    const all = await this.getAll();
    return all.filter((pt) => pt.gymIds.includes(gymId));
  },

  async update(pt: PersonalTrainer): Promise<void> {
    if (!isAmplifyConfigured()) return;
    const { errors } = await dataClient.models.PersonalTrainer.update(fromPT(pt));
    if (errors?.length) console.error("[ptStore.update] errors:", JSON.stringify(errors));
    invalidateCache();
  },

  async create(pt: Omit<PersonalTrainer, "id">): Promise<PersonalTrainer> {
    if (!isAmplifyConfigured()) throw new Error("Backend not configured");
    const { data } = await dataClient.models.PersonalTrainer.create({
      ownerId: pt.ownerId,
      isActive: pt.isActive ?? true,
      isTest: pt.isTest ?? false,
      isFeatured: pt.isFeatured ?? false,
      isPaid: pt.isPaid ?? false,
      createdBy: pt.createdBy,
      name: pt.name,
      description: pt.description,
      addressStreet: pt.address.street,
      addressSuburb: pt.address.suburb,
      addressState: pt.address.state,
      addressPostcode: pt.address.postcode,
      phone: pt.phone,
      email: pt.email,
      website: pt.website,
      instagram: pt.instagram,
      facebook: pt.facebook,
      tiktok: pt.tiktok,
      bookingUrl: pt.bookingUrl,
      lat: pt.lat,
      lng: pt.lng,
      images: pt.images,
      imageFocalPoints: pt.imageFocalPoints,
      gymIds: pt.gymIds,
      specialties: pt.specialties,
      qualifications: pt.qualifications,
      qualificationsVerified: pt.qualificationsVerified,
      qualificationsNotes: pt.qualificationsNotes,
      qualificationEvidence: pt.qualificationEvidence,
      memberOffers: pt.memberOffers,
      memberOffersNotes: pt.memberOffersNotes,
      experienceYears: pt.experienceYears,
      pricePerSession: pt.pricePerSession,
      sessionDuration: pt.sessionDuration,
      pricingNotes: pt.pricingNotes,
      availability: pt.availability,
      gender: pt.gender,
      languages: pt.languages,
    });
    if (!data) throw new Error("Failed to create PT");
    invalidateCache();
    return toPT(data);
  },

  async delete(id: string): Promise<void> {
    if (!isAmplifyConfigured()) return;
    await dataClient.models.PersonalTrainer.delete({ id });
    invalidateCache();
  },
};
