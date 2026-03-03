import type { Gym } from "@/types";
import seedGyms from "../../data/gyms.json";

// Module-level mutable store — survives hot-reload but not server restarts.
// No persistence: prototype only.
let gyms: Gym[] = seedGyms as Gym[];

export const ownerStore = {
  getAll(): Gym[] {
    return gyms;
  },

  getById(id: string): Gym | undefined {
    return gyms.find((g) => g.id === id);
  },

  getByOwner(ownerId: string): Gym[] {
    return gyms.filter((g) => g.ownerId === ownerId);
  },

  update(updated: Gym): void {
    gyms = gyms.map((g) => (g.id === updated.id ? { ...updated } : g));
  },
};
