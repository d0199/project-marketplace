import { defineBackend } from "@aws-amplify/backend";
import { defineAuth } from "@aws-amplify/backend";
import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const auth = defineAuth({
  loginWith: {
    email: true,
  },
});

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
