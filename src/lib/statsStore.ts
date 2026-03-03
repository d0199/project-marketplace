export interface GymStats {
  pageViews: number;
  websiteClicks: number;
  phoneClicks: number;
  emailClicks: number;
}

export type StatEvent = keyof GymStats;

const store: Record<string, GymStats> = {};

function ensure(gymId: string): GymStats {
  if (!store[gymId]) {
    store[gymId] = {
      pageViews: 0,
      websiteClicks: 0,
      phoneClicks: 0,
      emailClicks: 0,
    };
  }
  return store[gymId];
}

export const statsStore = {
  record(gymId: string, event: StatEvent): void {
    ensure(gymId)[event] += 1;
  },

  get(gymId: string): GymStats {
    return { ...ensure(gymId) };
  },
};
