import type { Gym } from "@/types";
import seedGyms from "../../data/gyms.json";

// Anchor mutable state on the Node.js global object so it is shared across
// all module instances (Next.js compiles API routes and pages into separate
// bundles that each get their own module registry — global bypasses that).
const g = global as typeof globalThis & { __gymStore?: Gym[] };
if (!g.__gymStore) {
  g.__gymStore = seedGyms as Gym[];
}

export const ownerStore = {
  getAll(): Gym[] {
    return g.__gymStore!;
  },

  getById(id: string): Gym | undefined {
    return g.__gymStore!.find((gym) => gym.id === id);
  },

  getByOwner(ownerId: string): Gym[] {
    return g.__gymStore!.filter((gym) => gym.ownerId === ownerId);
  },

  update(updated: Gym): void {
    g.__gymStore = g.__gymStore!.map((gym) =>
      gym.id === updated.id ? { ...updated } : gym
    );
  },
};
