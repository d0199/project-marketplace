import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

// Address and hours are flattened into scalar attributes so DynamoDB can
// store them natively without JSON serialisation.  The ownerStore mapper
// re-assembles them into the nested Gym type at read time.
const schema = a.schema({
  Gym: a
    .model({
      ownerId: a.string().required(),
      name: a.string().required(),
      isTest: a.boolean(),
      isFeatured: a.boolean(),
      priceVerified: a.boolean(),
      description: a.string(),
      images: a.string().array(),
      amenities: a.string().array(),
      lat: a.float().required(),
      lng: a.float().required(),
      pricePerWeek: a.integer(),
      // address (flattened)
      addressStreet: a.string(),
      addressSuburb: a.string(),
      addressState: a.string(),
      addressPostcode: a.string(),
      // contact
      phone: a.string(),
      email: a.string(),
      website: a.string(),
      // hours (flattened)
      hoursMonday: a.string(),
      hoursTuesday: a.string(),
      hoursWednesday: a.string(),
      hoursThursday: a.string(),
      hoursFriday: a.string(),
      hoursSaturday: a.string(),
      hoursSunday: a.string(),
    })
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
