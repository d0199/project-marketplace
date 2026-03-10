/**
 * Feature flags — admin-controlled toggles for the public site.
 *
 * Stored as a single DynamoDB record (id = "global") via the FeatureFlag model.
 * Falls back to defaults when Amplify is not configured (local dev).
 *
 * Flags are read server-side in getServerSideProps and passed as props,
 * so changes take effect on next page load without a deploy.
 */

import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";

export interface FeatureFlags {
  /** Show the Gyms / Personal Trainers toggle on the search page */
  ptSearch: boolean;
  /** Show specialty quick-filter chips in the hero */
  heroSpecialties: boolean;
  /** Show member-offer filter in the sidebar */
  memberOffers: boolean;
  /** Show amenity quick-filter icons in the hero */
  heroAmenities: boolean;
  /** Show the radius slider in the sidebar */
  radiusSlider: boolean;
}

const DEFAULTS: FeatureFlags = {
  ptSearch: false,
  heroSpecialties: true,
  memberOffers: true,
  heroAmenities: true,
  radiusSlider: true,
};

const RECORD_ID = "global";

// In-memory cache so concurrent SSR requests don't hammer DynamoDB
let cached: FeatureFlags | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

export const featureFlagStore = {
  /** Get current flags (cached for 30s server-side) */
  async get(): Promise<FeatureFlags> {
    if (cached && Date.now() - cacheTs < CACHE_TTL_MS) return { ...cached };

    if (!isAmplifyConfigured()) {
      cached = { ...DEFAULTS };
      cacheTs = Date.now();
      return { ...cached };
    }

    try {
      const { data } = await dataClient.models.FeatureFlag.get({ id: RECORD_ID });
      if (data) {
        cached = {
          ptSearch: data.ptSearch ?? DEFAULTS.ptSearch,
          heroSpecialties: data.heroSpecialties ?? DEFAULTS.heroSpecialties,
          memberOffers: data.memberOffers ?? DEFAULTS.memberOffers,
          heroAmenities: data.heroAmenities ?? DEFAULTS.heroAmenities,
          radiusSlider: data.radiusSlider ?? DEFAULTS.radiusSlider,
        };
      } else {
        cached = { ...DEFAULTS };
      }
    } catch {
      cached = { ...DEFAULTS };
    }

    cacheTs = Date.now();
    return { ...cached };
  },

  /** Update one or more flags (admin only) */
  async update(partial: Partial<FeatureFlags>): Promise<FeatureFlags> {
    // Invalidate cache
    cached = null;
    cacheTs = 0;

    if (!isAmplifyConfigured()) {
      // Local dev: just return defaults merged with partial
      return { ...DEFAULTS, ...partial };
    }

    const { data: existing } = await dataClient.models.FeatureFlag.get({ id: RECORD_ID });
    if (existing) {
      await dataClient.models.FeatureFlag.update({ id: RECORD_ID, ...partial });
    } else {
      await dataClient.models.FeatureFlag.create({ id: RECORD_ID, ...DEFAULTS, ...partial });
    }

    return this.get();
  },

  /** Return the default values (useful for tests / reference) */
  defaults(): FeatureFlags {
    return { ...DEFAULTS };
  },
};
