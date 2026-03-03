import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";

export interface GymStats {
  pageViews: number;
  websiteClicks: number;
  phoneClicks: number;
  emailClicks: number;
}

export type StatEvent = keyof GymStats;

const ZERO: GymStats = {
  pageViews: 0,
  websiteClicks: 0,
  phoneClicks: 0,
  emailClicks: 0,
};

// GymStat records use gymId as the DynamoDB item id so that get({ id: gymId })
// works without a secondary index.
//
// NOTE: the update path (get → increment → put) is NOT atomic. For production,
// replace with a DynamoDB UpdateItem ADD expression via @aws-sdk/lib-dynamodb
// so concurrent increments don't race. The AppSync-generated client does not
// expose native atomic counters.
export const statsStore = {
  async record(gymId: string, event: StatEvent): Promise<void> {
    if (!isAmplifyConfigured()) return;
    const { data: existing } = await dataClient.models.GymStat.get({
      id: gymId,
    });
    if (existing) {
      await dataClient.models.GymStat.update({
        id: gymId,
        [event]: (existing[event] ?? 0) + 1,
      });
    } else {
      await dataClient.models.GymStat.create({
        id: gymId,
        gymId,
        pageViews: event === "pageViews" ? 1 : 0,
        websiteClicks: event === "websiteClicks" ? 1 : 0,
        phoneClicks: event === "phoneClicks" ? 1 : 0,
        emailClicks: event === "emailClicks" ? 1 : 0,
      });
    }
  },

  async get(gymId: string): Promise<GymStats> {
    if (!isAmplifyConfigured()) return { ...ZERO };
    const { data } = await dataClient.models.GymStat.get({ id: gymId });
    return {
      pageViews: data?.pageViews ?? 0,
      websiteClicks: data?.websiteClicks ?? 0,
      phoneClicks: data?.phoneClicks ?? 0,
      emailClicks: data?.emailClicks ?? 0,
    };
  },
};
