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
      // admin review tracking
      adminEdited: a.boolean(),
      adminEditedAt: a.string(),
      adminEditedBy: a.string(),
      adminEditHistory: a.string(), // JSON-encoded array of { by, at }
    })
    // GSIs: ownerId for owner portal, addressPostcode for suburb page lookups
    .secondaryIndexes((index) => [index("ownerId"), index("addressPostcode")])
    .authorization((allow) => [allow.publicApiKey()]),

  GymStat: a
    .model({
      gymId: a.string().required(),
      pageViews: a.integer().default(0),
      websiteClicks: a.integer().default(0),
      phoneClicks: a.integer().default(0),
      emailClicks: a.integer().default(0),
      bookingClicks: a.integer().default(0),
      directionsClicks: a.integer().default(0),
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
      claimType: a.string(),  // "gym" (default) | "pt"
      claimantNote: a.string(), // note from claimant visible to admin
    })
    .authorization((allow) => [allow.publicApiKey()]),

  GymEdit: a
    .model({
      gymId: a.string().required(),  // gymId or ptId depending on editType
      gymName: a.string(),        // denormalized for display
      ownerEmail: a.string(),     // submitter's email
      currentSnapshot: a.string(), // JSON of gym/PT at time of submission
      proposedChanges: a.string(), // JSON of proposed full gym/PT
      status: a.string(),          // "pending" | "approved" | "rejected"
      notes: a.string(),           // internal admin notes
      editType: a.string(),        // "gym" (default) | "pt" | "bulk" | "pt-verification"
      reviewedBy: a.string(),      // admin email who approved/rejected
      reviewedAt: a.string(),      // ISO timestamp of review
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
      customData: a.string(),       // JSON-encoded custom field responses
      entityType: a.string(),       // "gym" | "pt"
      status: a.string(),           // "new" | "read" | "contacted"
      notes: a.string(),            // internal owner notes
    })
    .authorization((allow) => [allow.publicApiKey()]),

  PersonalTrainer: a
    .model({
      ownerId: a.string().required(),
      name: a.string().required(),
      isActive: a.boolean(),
      isTest: a.boolean(),
      isFeatured: a.boolean(),
      isPaid: a.boolean(),
      stripeSubscriptionId: a.string(),
      stripePlan: a.string(),
      createdBy: a.string(),
      description: a.string(),
      images: a.string().array(),
      imageFocalPoints: a.integer().array(),
      lat: a.float().required(),
      lng: a.float().required(),
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
      tiktok: a.string(),
      bookingUrl: a.string(),
      // PT-specific
      gymIds: a.string().array(),
      specialties: a.string().array(),
      qualifications: a.string().array(),
      qualificationsVerifiedList: a.string().array(),
      qualificationsVerified: a.boolean(),
      qualificationsNotes: a.string(),
      qualificationEvidence: a.string(),
      memberOffers: a.string().array(),
      memberOffersNotes: a.string(),
      memberOffersTnC: a.string(),
      experienceYears: a.integer(),
      pricePerSession: a.float(),
      sessionDuration: a.integer(),
      pricingNotes: a.string(),
      availability: a.string(),
      gender: a.string(),
      languages: a.string().array(),
      hideAddress: a.boolean(),
      serviceAreas: a.string().array(), // postcodes the PT also services
      isNational: a.boolean(),           // online PT — shows in every search
      customLeadFields: a.string(), // JSON-encoded CustomLeadField[]
      // admin review tracking
      adminEdited: a.boolean(),
      adminEditedAt: a.string(),
      adminEditedBy: a.string(),
      adminEditHistory: a.string(), // JSON-encoded array of { by, at }
    })
    // GSIs: ownerId for owner portal, addressPostcode for suburb page lookups
    .secondaryIndexes((index) => [index("ownerId"), index("addressPostcode")])
    .authorization((allow) => [allow.publicApiKey()]),

  Affiliation: a
    .model({
      ptId: a.string().required(),
      ptName: a.string(),
      gymId: a.string().required(),
      gymName: a.string(),
      requestedBy: a.string().required(), // "pt" or "gym"
      status: a.string(),  // "pending" | "approved" | "rejected"
      notes: a.string(),
      requestedAt: a.string(),
    })
    .secondaryIndexes((index) => [index("ptId"), index("gymId")])
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
      directionsClicks: a.integer().default(0),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // Feature flags — single record (id = "global") toggled from admin panel.
  // Controls which UI features are visible on the public search page.
  FeatureFlag: a
    .model({
      ptSearch: a.boolean(),
      specialties: a.boolean(),
      memberOffers: a.boolean(),
      amenities: a.boolean(),
      radiusSlider: a.boolean(),
      ptMemberOffers: a.boolean(),
      chatbot: a.boolean(),
      chatbotSchedule: a.string(),   // "HH:MM-HH:MM" AEST or "" for always-on
      claudeApi: a.boolean(),        // Kill-switch for Anthropic API usage
      googleApi: a.boolean(),        // Kill-switch for Google Places/Geocoding API usage
      // Legacy — kept for backwards compat with existing records
      heroSpecialties: a.boolean(),
      heroAmenities: a.boolean(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // Admin-managed picklists (e.g. "specialties", "amenities").
  // Very few records — full scan is fine.
  Dataset: a
    .model({
      name: a.string().required(),   // logical key, unique by convention
      entries: a.string().array(),   // the picklist values
      icons: a.string(),             // JSON map: { "entry name": "<svg ...>...</svg>" }
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // Admin audit log — tracks all admin actions for accountability.
  AdminAuditLog: a
    .model({
      adminEmail: a.string().required(),
      action: a.string().required(),     // e.g. "gym.update", "claim.approve", "user.delete"
      entityType: a.string(),            // "gym" | "pt" | "claim" | "user" | "dataset" | "feature-flag"
      entityId: a.string(),              // the ID of the affected entity
      entityName: a.string(),            // human-readable name for display
      details: a.string(),               // JSON or text with action-specific details
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // Blog / content pages managed by admins.
  BlogPost: a
    .model({
      slug: a.string().required(),
      title: a.string().required(),
      excerpt: a.string(),             // meta description / preview text
      content: a.string().required(),   // markdown body
      coverImage: a.string(),           // URL or S3 key
      coverImageAlt: a.string(),
      authorName: a.string(),
      authorEmail: a.string(),
      tags: a.string().array(),
      status: a.string().required(),    // "draft" | "published"
      publishedAt: a.string(),
      seoTitle: a.string(),             // override for <title>
      seoDescription: a.string(),       // override for meta description
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // AI chatbot conversation transcripts for admin review.
  ChatTranscript: a
    .model({
      sessionId: a.string().required(),    // unique per conversation
      messages: a.string().required(),     // JSON array of {role, content, timestamp}
      messageCount: a.integer(),           // total messages in conversation
      startedAt: a.string().required(),    // ISO timestamp
      lastMessageAt: a.string().required(),// ISO timestamp
      userAgent: a.string(),              // browser user agent
      page: a.string(),                   // page the chat was started from
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // User-submitted feedback / issue reports on listings.
  FeedbackReport: a
    .model({
      listingId: a.string().required(),   // gymId or ptId
      listingName: a.string(),
      listingType: a.string().required(),  // "gym" | "pt"
      issueType: a.string().required(),
      message: a.string(),
      submittedAt: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  // Support / contact form submissions from the About page.
  SupportRequest: a
    .model({
      name: a.string().required(),
      email: a.string().required(),
      message: a.string().required(),
      category: a.string(),              // "general" | "billing" | "listing" | "bug" | "other"
      userEmail: a.string(),             // Cognito email if logged in
      entityType: a.string(),            // "gym" | "pt" | null
      entityId: a.string(),              // gym/PT id if applicable
      entityName: a.string(),            // gym/PT name if applicable
      submittedAt: a.string().required(),
      status: a.string(),                // "new" | "read" | "resolved"
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
