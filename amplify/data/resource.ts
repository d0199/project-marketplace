import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

// Address and hours are flattened into scalar attributes so DynamoDB can
// store them natively without JSON serialisation.  The ownerStore mapper
// re-assembles them into the nested Gym type at read time.
const schema = a.schema({
  Gym: a
    .model({
      ownerId: a.string().required(),
      name: a.string().required(),
      isActive: a.boolean(),
      isTest: a.boolean(),
      isFeatured: a.boolean(),
      priceVerified: a.boolean(),
      description: a.string(),
      images: a.string().array(),
      amenities: a.string().array(),
      lat: a.float().required(),
      lng: a.float().required(),
      pricePerWeek: a.float(),
      // address (flattened)
      addressStreet: a.string(),
      addressSuburb: a.string(),
      addressState: a.string(),
      addressPostcode: a.string(),
      // contact
      phone: a.string(),
      email: a.string(),
      website: a.string(),
      instagram: a.string(),
      facebook: a.string(),
      bookingUrl: a.string(),
      // hours (flattened)
      hoursMonday: a.string(),
      hoursTuesday: a.string(),
      hoursWednesday: a.string(),
      hoursThursday: a.string(),
      hoursFriday: a.string(),
      hoursSaturday: a.string(),
      hoursSunday: a.string(),
      hoursComment: a.string(),
      // paid listing flag
      isPaid: a.boolean(),
      // Stripe billing
      stripeSubscriptionId: a.string(),
      stripePlan: a.string(), // "paid" | "featured" | null
      // Google Places ID — used for deduplication on re-import
      googlePlaceId: a.string(),
      // Who created this record: email address, "bulk", or "system"
      createdBy: a.string(),
      // member offers
      imageFocalPoints: a.integer().array(),
      memberOffers: a.string().array(),
      memberOffersNotes: a.string(),
      memberOffersScroll: a.boolean(),
      memberScrollText: a.string(),
      memberOffersTnC: a.string(),
      // pricing notes — shown publicly below the price; auto-set to "Verified using AI" on scrape
      pricingNotes: a.string(),
      amenitiesVerified: a.boolean(),
      amenitiesNotes: a.string(),
      specialties: a.string().array(),
    })
    // GSI on ownerId — makes getByOwner O(1) instead of a full table scan.
    .secondaryIndexes((index) => [index("ownerId")])
    // API key allows public reads and owner writes from server-side API routes.
    // The API routes themselves enforce ownership by comparing ownerId values.
    .authorization((allow) => [allow.publicApiKey()]),

  GymStat: a
    .model({
      gymId: a.string().required(),
      pageViews: a.integer().default(0),
      websiteClicks: a.integer().default(0),
      phoneClicks: a.integer().default(0),
      emailClicks: a.integer().default(0),
      bookingClicks: a.integer().default(0),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Claim: a
    .model({
      gymId: a.string().required(),
      gymName: a.string(),
      gymAddress: a.string(),
      gymWebsite: a.string(),
      claimantName: a.string().required(),
      claimantEmail: a.string().required(),
      claimantPhone: a.string(),
      message: a.string(),
      status: a.string(), // "pending" | "approved" | "rejected"
      notes: a.string(),  // internal admin notes
      // New listing fields (isNewListing = true)
      isNewListing: a.boolean(),
      gymPhone: a.string(),
      gymEmail: a.string(),
      gymSuburb: a.string(),
      gymPostcode: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  GymEdit: a
    .model({
      gymId: a.string().required(),
      gymName: a.string(),        // denormalized for display
      ownerEmail: a.string(),     // submitter's email
      currentSnapshot: a.string(), // JSON of gym at time of submission
      proposedChanges: a.string(), // JSON of proposed full gym
      status: a.string(),          // "pending" | "approved" | "rejected"
      notes: a.string(),           // internal admin notes
    })
    .authorization((allow) => [allow.publicApiKey()]),

  Lead: a
    .model({
      gymId: a.string().required(),
      gymName: a.string(),
      name: a.string().required(),
      email: a.string().required(),
      phone: a.string(),
      message: a.string(),
      status: a.string(), // "new" | "read" | "contacted"
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // Daily stat buckets for time-series analytics.
  // id = gymId#YYYY-MM-DD (deterministic) so upserts work without a GSI.
  DailyGymStat: a
    .model({
      gymId: a.string().required(),
      date: a.string().required(), // YYYY-MM-DD
      pageViews: a.integer().default(0),
      websiteClicks: a.integer().default(0),
      phoneClicks: a.integer().default(0),
      emailClicks: a.integer().default(0),
      bookingClicks: a.integer().default(0),
    })
    .authorization((allow) => [allow.publicApiKey()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: { expiresInDays: 365 },
  },
});
