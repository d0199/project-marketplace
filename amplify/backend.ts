import {
  a,
  defineAuth,
  defineBackend,
  defineData,
  type ClientSchema,
} from "@aws-amplify/backend";

// ---------------------------------------------------------------------------
// Auth — email + password sign-in. Owner accounts are admin-created only.
// ---------------------------------------------------------------------------
const auth = defineAuth({
  loginWith: { email: true },
});

// ---------------------------------------------------------------------------
// Data schema — flattened address/hours so DynamoDB stores native scalars.
// API key allows public reads; ownership is enforced by the API routes.
// ---------------------------------------------------------------------------
const schema = a.schema({
  Gym: a
    .model({
      ownerId: a.string().required(),
      name: a.string().required(),
      description: a.string(),
      images: a.string().array(),
      amenities: a.string().array(),
      lat: a.float().required(),
      lng: a.float().required(),
      pricePerWeek: a.integer(),
      addressStreet: a.string(),
      addressSuburb: a.string(),
      addressState: a.string(),
      addressPostcode: a.string(),
      phone: a.string(),
      email: a.string(),
      website: a.string(),
      hoursMonday: a.string(),
      hoursTuesday: a.string(),
      hoursWednesday: a.string(),
      hoursThursday: a.string(),
      hoursFriday: a.string(),
      hoursSaturday: a.string(),
      hoursSunday: a.string(),
    })
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
});

export type Schema = ClientSchema<typeof schema>;

const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: { expiresInDays: 365 },
  },
});

defineBackend({ auth, data });
