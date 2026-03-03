import type { Gym } from "@/types";

// Haversine distance in kilometres
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Static postcode → [lat, lng] map for WA suburbs 6000–6065
export const POSTCODE_COORDS: Record<string, [number, number]> = {
  "6000": [-31.9505, 115.8605], // Perth CBD
  "6001": [-31.9505, 115.8605], // Perth CBD (GPO)
  "6003": [-31.9353, 115.8601], // Northbridge
  "6004": [-31.9290, 115.8730], // East Perth
  "6005": [-31.9500, 115.8440], // West Perth
  "6006": [-31.9250, 115.8480], // North Perth
  "6007": [-31.9340, 115.8340], // Leederville
  "6008": [-31.9480, 115.8200], // Subiaco
  "6009": [-31.9750, 115.8170], // Nedlands
  "6010": [-31.9200, 115.8030], // Wembley
  "6011": [-31.9630, 115.7770], // Cottesloe
  "6012": [-31.9750, 115.8000], // Claremont
  "6014": [-31.9270, 115.7900], // Floreat
  "6015": [-31.9050, 115.7820], // City Beach
  "6016": [-31.9120, 115.8360], // Mount Hawthorn
  "6017": [-31.9050, 115.8110], // Scarborough (S)
  "6018": [-31.8850, 115.8000], // Karrinyup
  "6019": [-31.8780, 115.7830], // Scarborough (N)
  "6020": [-31.8680, 115.7780], // Marmion
  "6021": [-31.8550, 115.7910], // Stirling
  "6022": [-31.8880, 115.8210], // Innaloo
  "6023": [-31.8590, 115.8050], // Carine
  "6024": [-31.8450, 115.8200], // Duncraig
  "6025": [-31.8170, 115.7990], // Hillarys
  "6026": [-31.7870, 115.7800], // Padbury
  "6027": [-31.7440, 115.7630], // Joondalup
  "6028": [-31.7326, 115.7476], // Kinross
  "6029": [-31.7200, 115.7390], // Currambine
  "6030": [-31.7050, 115.7260], // Clarkson
  "6031": [-31.6840, 115.7250], // Merriwa
  "6032": [-31.6580, 115.7360], // Alkimos
  "6033": [-31.6330, 115.7060], // Eglinton
  "6034": [-31.6010, 115.6980], // Yanchep
  "6035": [-31.5600, 115.6750], // Two Rocks
  "6036": [-31.7890, 115.8560], // Edgewater
  "6037": [-31.7640, 115.8030], // Heathridge
  "6050": [-31.8910, 115.8620], // Mount Lawley
  "6051": [-31.8990, 115.8780], // Maylands
  "6052": [-31.8990, 115.8900], // Bayswater
  "6053": [-31.8850, 115.8900], // Bassendean
  "6054": [-31.8720, 115.9050], // Midland
  "6055": [-31.8700, 115.7600], // Osborne Park
  "6056": [-31.8530, 115.8840], // Guildford
  "6060": [-31.9050, 115.8420], // Tuart Hill
  "6061": [-31.8750, 115.8400], // Balga
  "6062": [-31.8590, 115.8570], // Morley
  "6063": [-31.8430, 115.8680], // Embleton
  "6064": [-31.8290, 115.8500], // Nollamara
  "6065": [-31.8080, 115.8280], // Wanneroo
};

export const ALL_AMENITIES = [
  "pool",
  "spa",
  "sauna",
  "free weights",
  "cardio",
  "group classes",
  "boxing/mma",
  "yoga/pilates",
  "parking",
  "showers",
  "lockers",
  "childcare",
  "café",
  "24/7 access",
  "personal training",
] as const;

export type Amenity = (typeof ALL_AMENITIES)[number];

export const AMENITY_ICONS: Record<string, string> = {
  pool: "🏊",
  spa: "♨️",
  sauna: "🧖",
  "free weights": "🏋️",
  cardio: "🚴",
  "group classes": "👥",
  "boxing/mma": "🥊",
  "yoga/pilates": "🧘",
  parking: "🅿️",
  showers: "🚿",
  lockers: "🔒",
  childcare: "👶",
  café: "☕",
  "24/7 access": "🔑",
  "personal training": "💪",
};

export interface FilterOptions {
  postcode?: string;
  amenities: string[];
  radiusKm?: number;
}

export interface GymWithDistance extends Gym {
  distanceKm?: number;
}

export function filterGyms(
  gyms: Gym[],
  options: FilterOptions
): GymWithDistance[] {
  let results: GymWithDistance[] = gyms.map((g) => ({ ...g }));

  // Attach distance if postcode provided
  if (options.postcode && POSTCODE_COORDS[options.postcode]) {
    const [lat, lng] = POSTCODE_COORDS[options.postcode];
    results = results.map((g) => ({
      ...g,
      distanceKm: haversineKm(lat, lng, g.lat, g.lng),
    }));
    results.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    results = results.filter((g) => (g.distanceKm ?? Infinity) <= (options.radiusKm ?? 10));
  }

  // Filter by selected amenities (must have ALL selected)
  if (options.amenities.length > 0) {
    results = results.filter((g) =>
      options.amenities.every((a) => g.amenities.includes(a))
    );
  }

  return results;
}
