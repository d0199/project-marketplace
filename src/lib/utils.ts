import type { Gym } from "@/types";
import { WA_POSTCODE_COORDS } from "@/data/waPostcodes";

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

// Full WA postcode → [lat, lng] map (501 postcodes, sourced from matthewproctor/australianpostcodes)
export const POSTCODE_COORDS: Record<string, [number, number]> = WA_POSTCODE_COORDS;

// Suburb metadata for SEO landing pages — one entry per searchable postcode
export const POSTCODE_META: Record<string, { name: string; slug: string }> = {
  "6000": { name: "Perth CBD",          slug: "perth-6000" },
  "6003": { name: "Northbridge",        slug: "northbridge-6003" },
  "6004": { name: "East Perth",         slug: "east-perth-6004" },
  "6005": { name: "West Perth",         slug: "west-perth-6005" },
  "6006": { name: "North Perth",        slug: "north-perth-6006" },
  "6007": { name: "Leederville",        slug: "leederville-6007" },
  "6008": { name: "Subiaco",            slug: "subiaco-6008" },
  "6009": { name: "Nedlands",           slug: "nedlands-6009" },
  "6010": { name: "Claremont",          slug: "claremont-6010" },
  "6011": { name: "Cottesloe",          slug: "cottesloe-6011" },
  "6014": { name: "Floreat",            slug: "floreat-6014" },
  "6015": { name: "City Beach",         slug: "city-beach-6015" },
  "6016": { name: "Mount Hawthorn",     slug: "mount-hawthorn-6016" },
  "6017": { name: "Osborne Park",       slug: "osborne-park-6017" },
  "6018": { name: "Karrinyup",          slug: "karrinyup-6018" },
  "6019": { name: "Scarborough",        slug: "scarborough-6019" },
  "6020": { name: "Marmion",            slug: "marmion-6020" },
  "6021": { name: "Stirling",           slug: "stirling-6021" },
  "6022": { name: "Innaloo",            slug: "innaloo-6022" },
  "6023": { name: "Carine",             slug: "carine-6023" },
  "6024": { name: "Duncraig",           slug: "duncraig-6024" },
  "6025": { name: "Hillarys",           slug: "hillarys-6025" },
  "6026": { name: "Padbury",            slug: "padbury-6026" },
  "6027": { name: "Joondalup",          slug: "joondalup-6027" },
  "6028": { name: "Kinross",            slug: "kinross-6028" },
  "6029": { name: "Currambine",         slug: "currambine-6029" },
  "6030": { name: "Clarkson",           slug: "clarkson-6030" },
  "6031": { name: "Merriwa",            slug: "merriwa-6031" },
  "6032": { name: "Alkimos",            slug: "alkimos-6032" },
  "6033": { name: "Eglinton",           slug: "eglinton-6033" },
  "6034": { name: "Yanchep",            slug: "yanchep-6034" },
  "6035": { name: "Two Rocks",          slug: "two-rocks-6035" },
  "6036": { name: "Edgewater",          slug: "edgewater-6036" },
  "6037": { name: "Heathridge",         slug: "heathridge-6037" },
  "6050": { name: "Mount Lawley",       slug: "mount-lawley-6050" },
  "6051": { name: "Maylands",           slug: "maylands-6051" },
  "6052": { name: "Bayswater",          slug: "bayswater-6052" },
  "6053": { name: "Bassendean",         slug: "bassendean-6053" },
  "6054": { name: "Midland",            slug: "midland-6054" },
  "6056": { name: "Midvale",            slug: "midvale-6056" },
  "6059": { name: "Dianella",           slug: "dianella-6059" },
  "6060": { name: "Tuart Hill",         slug: "tuart-hill-6060" },
  "6061": { name: "Balga",              slug: "balga-6061" },
  "6062": { name: "Morley",             slug: "morley-6062" },
  "6063": { name: "Embleton",           slug: "embleton-6063" },
  "6064": { name: "Nollamara",          slug: "nollamara-6064" },
  "6065": { name: "Wanneroo",           slug: "wanneroo-6065" },
  "6069": { name: "Ellenbrook",         slug: "ellenbrook-6069" },
  "6100": { name: "Victoria Park",      slug: "victoria-park-6100" },
  "6101": { name: "East Victoria Park", slug: "east-victoria-park-6101" },
  "6102": { name: "Bentley",            slug: "bentley-6102" },
  "6107": { name: "Cannington",         slug: "cannington-6107" },
  "6112": { name: "Armadale",           slug: "armadale-6112" },
  "6151": { name: "South Perth",        slug: "south-perth-6151" },
  "6154": { name: "Applecross",         slug: "applecross-6154" },
  "6157": { name: "Bicton",             slug: "bicton-6157" },
  "6158": { name: "East Fremantle",     slug: "east-fremantle-6158" },
  "6159": { name: "North Fremantle",    slug: "north-fremantle-6159" },
  "6160": { name: "Fremantle",          slug: "fremantle-6160" },
  "6162": { name: "South Fremantle",    slug: "south-fremantle-6162" },
  "6168": { name: "Rockingham",         slug: "rockingham-6168" },
  "6210": { name: "Mandurah",           slug: "mandurah-6210" },
  "6211": { name: "Dawesville",         slug: "dawesville-6211" },
  "6230": { name: "Bunbury",            slug: "bunbury-6230" },
  "6232": { name: "Eaton",              slug: "eaton-6232" },
  "6233": { name: "Australind",         slug: "australind-6233" },
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

// Quality tier for non-featured gyms (higher = appears first)
function gymTier(gym: Gym): number {
  const isOwned = gym.ownerId !== "owner-3" && gym.ownerId !== "unclaimed" && gym.ownerId !== "";
  const hasPricing = (gym.priceVerified ?? false) && (gym.pricePerWeek ?? 0) > 0;
  if (isOwned && hasPricing) return 3;
  if (isOwned) return 2;
  if (hasPricing) return 1;
  return 0;
}

/**
 * Apply ranking on top of an already-sorted results array.
 * Featured gyms float to the top (rotated by rotationSeed so all get equal exposure).
 * Non-featured gyms are then sorted by quality tier; existing order is preserved
 * within each tier (stable sort).
 *
 * rotationSeed: use Math.floor(Date.now() / (8 * 60 * 60 * 1000)) for 8-hour rotation.
 */
export function rankGyms(
  gyms: GymWithDistance[],
  rotationSeed: number
): GymWithDistance[] {
  const featured = gyms.filter((g) => g.isFeatured);
  const rest = gyms.filter((g) => !g.isFeatured);

  // Rotate featured array so a different gym leads each rotation window
  const offset = featured.length > 0 ? rotationSeed % featured.length : 0;
  const rotatedFeatured = [...featured.slice(offset), ...featured.slice(0, offset)];

  // Stable sort rest by tier (preserves within-tier order from user's sort)
  const sortedRest = rest
    .map((g, i) => ({ g, i, tier: gymTier(g) }))
    .sort((a, b) => b.tier - a.tier || a.i - b.i)
    .map(({ g }) => g);

  return [...rotatedFeatured, ...sortedRest];
}
