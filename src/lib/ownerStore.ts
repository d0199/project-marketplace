import { dataClient } from "./amplifyServerConfig";
import type { Schema } from "../../amplify/data/resource";
import type { Gym } from "@/types";

type GymRecord = Schema["Gym"]["type"];

function toGym(r: GymRecord): Gym {
  return {
    id: r.id,
    ownerId: r.ownerId ?? "",
    name: r.name ?? "",
    description: r.description ?? "",
    address: {
      street: r.addressStreet ?? "",
      suburb: r.addressSuburb ?? "",
      state: r.addressState ?? "",
      postcode: r.addressPostcode ?? "",
    },
    phone: r.phone ?? "",
    email: r.email ?? "",
    website: r.website ?? "",
    lat: r.lat ?? 0,
    lng: r.lng ?? 0,
    amenities: (r.amenities?.filter(Boolean) ?? []) as string[],
    hours: {
      monday: r.hoursMonday ?? undefined,
      tuesday: r.hoursTuesday ?? undefined,
      wednesday: r.hoursWednesday ?? undefined,
      thursday: r.hoursThursday ?? undefined,
      friday: r.hoursFriday ?? undefined,
      saturday: r.hoursSaturday ?? undefined,
      sunday: r.hoursSunday ?? undefined,
    },
    pricePerWeek: r.pricePerWeek ?? 0,
    images: (r.images?.filter(Boolean) ?? []) as string[],
  };
}

function fromGym(gym: Gym) {
  return {
    id: gym.id,
    ownerId: gym.ownerId,
    name: gym.name,
    description: gym.description,
    addressStreet: gym.address.street,
    addressSuburb: gym.address.suburb,
    addressState: gym.address.state,
    addressPostcode: gym.address.postcode,
    phone: gym.phone,
    email: gym.email,
    website: gym.website,
    lat: gym.lat,
    lng: gym.lng,
    amenities: gym.amenities,
    hoursMonday: gym.hours.monday,
    hoursTuesday: gym.hours.tuesday,
    hoursWednesday: gym.hours.wednesday,
    hoursThursday: gym.hours.thursday,
    hoursFriday: gym.hours.friday,
    hoursSaturday: gym.hours.saturday,
    hoursSunday: gym.hours.sunday,
    pricePerWeek: gym.pricePerWeek,
    images: gym.images,
  };
}

export const ownerStore = {
  async getAll(): Promise<Gym[]> {
    const { data } = await dataClient.models.Gym.list();
    return (data ?? []).map(toGym);
  },

  async getById(id: string): Promise<Gym | undefined> {
    const { data } = await dataClient.models.Gym.get({ id });
    return data ? toGym(data) : undefined;
  },

  async getByOwner(ownerId: string): Promise<Gym[]> {
    const { data } = await dataClient.models.Gym.list({
      filter: { ownerId: { eq: ownerId } },
    });
    return (data ?? []).map(toGym);
  },

  async update(gym: Gym): Promise<void> {
    await dataClient.models.Gym.update(fromGym(gym));
  },
};
