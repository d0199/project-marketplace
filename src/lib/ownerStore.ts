import { createRequire } from "module";
import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";
import type { Schema } from "../../amplify/backend";
import type { Gym } from "@/types";
import { postcodeToState } from "./utils";
import { generateSlug, generateNameSlug, generateSuburbSlug, deduplicateSlugs } from "./slugify";

const require = createRequire(import.meta.url);
const seedGymsRaw: Omit<Gym, "slug">[] = require("../../data/gyms.json");
const seedGyms: Gym[] = deduplicateSlugs(
  seedGymsRaw.map((g) => ({
    ...g,
    slug: generateNameSlug(g.name),
    suburbSlug: generateSuburbSlug(g.address.suburb, g.address.postcode),
  }))
);

// ---------------------------------------------------------------------------
// Shape converters between the flat DynamoDB record and the nested Gym type
// ---------------------------------------------------------------------------
type GymRecord = Schema["Gym"]["type"];

function toGym(r: GymRecord): Gym {
  const gym: Gym = {
    id: r.id,
    slug: generateNameSlug(r.name ?? ""),
    suburbSlug: generateSuburbSlug(r.addressSuburb ?? "", r.addressPostcode ?? ""),
    ownerId: r.ownerId ?? "",
    isActive: r.isActive ?? true,
    isTest: r.isTest ?? false,
    isFeatured: r.isFeatured ?? false,
    priceVerified: r.priceVerified ?? false,
    isPaid: r.isPaid ?? false,
    isFreeTrial: r.isFreeTrial ?? false,
    ...(r.trialExpiresAt != null && { trialExpiresAt: r.trialExpiresAt }),
    ...(r.stripeSubscriptionId != null && { stripeSubscriptionId: r.stripeSubscriptionId }),
    ...(r.stripePlan != null && { stripePlan: r.stripePlan as "paid" | "featured" }),
    ...(r.googlePlaceId != null && { googlePlaceId: r.googlePlaceId }),
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
    ...(r.bookingUrl != null && { bookingUrl: r.bookingUrl }),
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
    ...(r.pricingNotes != null && { pricingNotes: r.pricingNotes }),
    amenitiesVerified: r.amenitiesVerified ?? false,
    ...(r.amenitiesNotes != null && { amenitiesNotes: r.amenitiesNotes }),
    specialties: (r.specialties?.filter(Boolean) ?? []) as string[],
    images: (r.images?.filter(Boolean) ?? []) as string[],
    ...(r.imageFocalPoints != null && { imageFocalPoints: (r.imageFocalPoints.filter((v) => v != null) as number[]) }),
    ...(r.adminEdited != null && { adminEdited: r.adminEdited }),
    ...(r.adminEditedAt != null && { adminEditedAt: r.adminEditedAt }),
    ...(r.adminEditedBy != null && { adminEditedBy: r.adminEditedBy }),
    ...((r as Record<string, unknown>).adminEditHistory != null && {
      adminEditHistory: JSON.parse((r as Record<string, unknown>).adminEditHistory as string),
    }),
  };
  return gym;
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
    isFreeTrial: gym.isFreeTrial ?? false,
    trialExpiresAt: gym.trialExpiresAt,
    stripeSubscriptionId: gym.stripeSubscriptionId,
    stripePlan: gym.stripePlan,
    googlePlaceId: gym.googlePlaceId,
    createdBy: gym.createdBy,
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
    bookingUrl: gym.bookingUrl,
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
    pricingNotes: gym.pricingNotes,
    amenitiesVerified: gym.amenitiesVerified ?? false,
    amenitiesNotes: gym.amenitiesNotes,
    specialties: gym.specialties,
    images: gym.images,
    imageFocalPoints: gym.imageFocalPoints,
    adminEdited: gym.adminEdited,
    adminEditedAt: gym.adminEditedAt,
    adminEditedBy: gym.adminEditedBy,
    adminEditHistory: gym.adminEditHistory ? JSON.stringify(gym.adminEditHistory) : undefined,
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
// In-memory cache for getAll() — avoids repeated full DynamoDB scans.
// TTL keeps data fresh; invalidated on update/create/delete.
// ---------------------------------------------------------------------------
let _allCache: Gym[] | null = null;
let _allCacheTime = 0;
const ALL_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function invalidateCache() {
  _allCache = null;
  _allCacheTime = 0;
}

// ---------------------------------------------------------------------------
// Store — falls back to gyms.json until the Amplify backend is deployed
// ---------------------------------------------------------------------------
export const ownerStore = {
  async getAll(): Promise<Gym[]> {
    if (!isAmplifyConfigured()) return seedGyms;
    const now = Date.now();
    if (_allCache && now - _allCacheTime < ALL_CACHE_TTL) return _allCache;
    const gyms = deduplicateSlugs((await listAllGyms()).map(toGym));
    _allCache = gyms;
    _allCacheTime = now;
    return gyms;
  },

  async getById(id: string): Promise<Gym | undefined> {
    if (!isAmplifyConfigured()) return seedGyms.find((g) => g.id === id);
    const { data } = await dataClient.models.Gym.get({ id });
    return data ? toGym(data) : undefined;
  },

  async getBySlug(slug: string): Promise<Gym | undefined> {
    const all = await this.getAll();
    return all.find((g) => g.slug === slug);
  },

  async getBySuburbAndSlug(suburbSlug: string, slug: string): Promise<Gym | undefined> {
    if (!isAmplifyConfigured()) {
      return seedGyms.find((g) => g.suburbSlug === suburbSlug && g.slug === slug);
    }

    // Extract postcode from suburbSlug (last 4 digits, e.g. "perth-cbd-6000" → "6000")
    const postcodeMatch = suburbSlug.match(/(\d{4})$/);
    const postcode = postcodeMatch?.[1];

    if (postcode) {
      // GSI query on addressPostcode — direct index lookup, no table scan
      try {
        const results: GymRecord[] = [];
        let nextToken: string | null | undefined;
        do {
          const res = await dataClient.models.Gym.listGymByAddressPostcode(
            { addressPostcode: postcode },
            { limit: 100, nextToken },
          );
          results.push(...(res.data ?? []));
          nextToken = res.nextToken;
        } while (nextToken);

        const gyms = results.map(toGym);
        const match = gyms.find((g) => g.suburbSlug === suburbSlug && g.slug === slug);
        if (match) return match;
      } catch (err) {
        console.warn("[ownerStore] GSI query failed, falling back to scan:", err);
      }
    }

    // Fallback to full scan if postcode extraction failed or GSI not yet deployed
    const all = await this.getAll();
    return all.find((g) => g.suburbSlug === suburbSlug && g.slug === slug);
  },

  /** Find gym by old combined slug (for backward-compat redirects) */
  async getByLegacySlug(legacySlug: string): Promise<Gym | undefined> {
    const all = await this.getAll();
    return all.find((g) => generateSlug(g.name, g.address.suburb) === legacySlug);
  },

  async getByOwner(ownerId: string): Promise<Gym[]> {
    if (!isAmplifyConfigured())
      return seedGyms.filter((g) => g.ownerId === ownerId);
    const results: GymRecord[] = [];
    let nextToken: string | null | undefined;
    // Try GSI method first; fall back to filtered list if GSI not in model introspection
    const useGSI = typeof dataClient.models.Gym.listGymByOwnerId === "function";
    do {
      const res = useGSI
        ? await dataClient.models.Gym.listGymByOwnerId(
            { ownerId },
            { limit: 1000, nextToken }
          )
        : await dataClient.models.Gym.list({
            limit: 1000,
            nextToken,
            filter: { ownerId: { eq: ownerId } },
          });
      results.push(...(res.data ?? []));
      nextToken = res.nextToken;
    } while (nextToken);
    return results.map(toGym);
  },

  async update(gym: Gym): Promise<void> {
    if (!isAmplifyConfigured()) return; // no-op until backend is live
    const { data, errors } = await dataClient.models.Gym.update(fromGym(gym));
    if (errors?.length) console.error("[ownerStore.update] errors:", JSON.stringify(errors));
    if (!data) console.error("[ownerStore.update] no data returned");
    invalidateCache();
  },

  async updateBilling(
    id: string,
    patch: {
      isPaid: boolean;
      isFeatured: boolean;
      stripeSubscriptionId?: string | null;
      stripePlan?: string | null;
    }
  ): Promise<void> {
    if (!isAmplifyConfigured()) return;
    const { errors } = await dataClient.models.Gym.update({ id, ...patch });
    if (errors?.length) console.error("[ownerStore.updateBilling] errors:", JSON.stringify(errors));
    invalidateCache();
  },

  async create(gym: Omit<Gym, "id" | "slug" | "suburbSlug">): Promise<Gym> {
    if (!isAmplifyConfigured()) throw new Error("Backend not configured");
    const { data } = await dataClient.models.Gym.create({
      ownerId: gym.ownerId,
      isActive: gym.isActive ?? true,
      isTest: gym.isTest ?? false,
      isFeatured: gym.isFeatured ?? false,
      priceVerified: gym.priceVerified ?? false,
      isPaid: gym.isPaid ?? false,
      isFreeTrial: gym.isFreeTrial ?? false,
      trialExpiresAt: gym.trialExpiresAt,
      createdBy: gym.createdBy,
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
      bookingUrl: gym.bookingUrl,
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
      specialties: gym.specialties,
      images: gym.images,
      imageFocalPoints: gym.imageFocalPoints,
    });
    if (!data) throw new Error("Failed to create gym");
    invalidateCache();
    return toGym(data);
  },

  async delete(id: string): Promise<void> {
    if (!isAmplifyConfigured()) return;
    await dataClient.models.Gym.delete({ id });
    invalidateCache();
  },
};
