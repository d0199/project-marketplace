import type { Gym } from "@/types";
import { WA_POSTCODE_COORDS, WA_SUBURB_INDEX } from "@/data/waPostcodes";
import { EASTERN_POSTCODE_COORDS, EASTERN_SUBURB_INDEX } from "@/data/easternPostcodes";

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

// All Australian postcodes → [lat, lng] (WA + NSW/VIC/QLD/SA/TAS)
export const POSTCODE_COORDS: Record<string, [number, number]> = {
  ...WA_POSTCODE_COORDS,
  ...EASTERN_POSTCODE_COORDS,
};

// Title-case a locality name (e.g. "MOUNT HAWTHORN" → "Mount Hawthorn")
function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// Comprehensive suburb search index — all localities across WA + eastern states.
// Names are title-cased for display. Used to power the SearchBar autocomplete.
export const ALL_SUBURB_INDEX = [
  ...WA_SUBURB_INDEX,
  ...EASTERN_SUBURB_INDEX,
].map((s) => ({ ...s, name: toTitleCase(s.name) }));

// Derive AU state from postcode prefix
export function postcodeToState(postcode: string): string {
  const n = parseInt(postcode, 10);
  if (isNaN(n)) return "";
  if (n >= 1000 && n <= 2599) return "NSW";
  if (n >= 2619 && n <= 2899) return "NSW";
  if (n >= 2921 && n <= 2999) return "NSW";
  if (n >= 2600 && n <= 2618) return "ACT";
  if (n >= 2900 && n <= 2920) return "ACT";
  if (n >= 3000 && n <= 3999) return "VIC";
  if (n >= 4000 && n <= 4999) return "QLD";
  if (n >= 5000 && n <= 5999) return "SA";
  if (n >= 6000 && n <= 6999) return "WA";
  if (n >= 7000 && n <= 7999) return "TAS";
  if (n >= 800  && n <= 999)  return "NT";
  return "";
}

// Suburb metadata for SEO landing pages — one entry per searchable postcode
// Ordered by population (ABS 2021 Census) within each state
export const POSTCODE_META: Record<string, { name: string; slug: string; state: string }> = {
  // WA — top 15 by population
  "6171": { name: "Baldivis",       slug: "baldivis-6171",       state: "WA" },
  "6210": { name: "Mandurah",       slug: "mandurah-6210",       state: "WA" },
  "6069": { name: "Ellenbrook",     slug: "ellenbrook-6069",     state: "WA" },
  "6168": { name: "Rockingham",     slug: "rockingham-6168",     state: "WA" },
  "6027": { name: "Joondalup",      slug: "joondalup-6027",      state: "WA" },
  "6030": { name: "Clarkson",       slug: "clarkson-6030",       state: "WA" },
  "6108": { name: "Thornlie",       slug: "thornlie-6108",       state: "WA" },
  "6155": { name: "Canning Vale",   slug: "canning-vale-6155",   state: "WA" },
  "6059": { name: "Dianella",       slug: "dianella-6059",       state: "WA" },
  "6062": { name: "Morley",         slug: "morley-6062",         state: "WA" },
  "6021": { name: "Stirling",       slug: "stirling-6021",       state: "WA" },
  "6065": { name: "Wanneroo",       slug: "wanneroo-6065",       state: "WA" },
  "6112": { name: "Armadale",       slug: "armadale-6112",       state: "WA" },
  "6110": { name: "Gosnells",       slug: "gosnells-6110",       state: "WA" },
  "6109": { name: "Maddington",     slug: "maddington-6109",     state: "WA" },
  // NSW — top 15 by population
  "2148": { name: "Blacktown",      slug: "blacktown-2148",      state: "NSW" },
  "2750": { name: "Penrith",        slug: "penrith-2750",        state: "NSW" },
  "2170": { name: "Liverpool",      slug: "liverpool-2170",      state: "NSW" },
  "2560": { name: "Campbelltown",   slug: "campbelltown-2560",   state: "NSW" },
  "2150": { name: "Parramatta",     slug: "parramatta-2150",     state: "NSW" },
  "2763": { name: "Quakers Hill",   slug: "quakers-hill-2763",   state: "NSW" },
  "2155": { name: "Kellyville",     slug: "kellyville-2155",     state: "NSW" },
  "2153": { name: "Baulkham Hills", slug: "baulkham-hills-2153", state: "NSW" },
  "2154": { name: "Castle Hill",    slug: "castle-hill-2154",    state: "NSW" },
  "2765": { name: "Marsden Park",   slug: "marsden-park-2765",   state: "NSW" },
  "2768": { name: "Stanhope Gardens",slug:"stanhope-gardens-2768",state:"NSW"},
  "2564": { name: "Macquarie Fields",slug:"macquarie-fields-2564",state:"NSW"},
  "2144": { name: "Auburn",         slug: "auburn-2144",         state: "NSW" },
  "2770": { name: "Mount Druitt",   slug: "mount-druitt-2770",   state: "NSW" },
  "2300": { name: "Newcastle",      slug: "newcastle-2300",      state: "NSW" },
  // VIC — top 15 by population (deduped by postcode)
  "3030": { name: "Point Cook",     slug: "point-cook-3030",     state: "VIC" },
  "3064": { name: "Craigieburn",    slug: "craigieburn-3064",    state: "VIC" },
  "3810": { name: "Pakenham",       slug: "pakenham-3810",       state: "VIC" },
  "3024": { name: "Wyndham Vale",   slug: "wyndham-vale-3024",   state: "VIC" },
  "3978": { name: "Clyde North",    slug: "clyde-north-3978",    state: "VIC" },
  "3429": { name: "Sunbury",        slug: "sunbury-3429",        state: "VIC" },
  "3337": { name: "Melton",         slug: "melton-3337",         state: "VIC" },
  "3029": { name: "Tarneit",        slug: "tarneit-3029",        state: "VIC" },
  "3752": { name: "South Morang",   slug: "south-morang-3752",   state: "VIC" },
  "3754": { name: "Doreen",         slug: "doreen-3754",         state: "VIC" },
  "3023": { name: "Caroline Springs",slug:"caroline-springs-3023",state:"VIC"},
  "3175": { name: "Dandenong",      slug: "dandenong-3175",      state: "VIC" },
  "3220": { name: "Geelong",        slug: "geelong-3220",        state: "VIC" },
  "3199": { name: "Frankston",      slug: "frankston-3199",      state: "VIC" },
  "3128": { name: "Box Hill",       slug: "box-hill-3128",       state: "VIC" },
  // QLD — top 15 by population (deduped by postcode)
  "4209": { name: "Coomera",        slug: "coomera-4209",        state: "QLD" },
  "4300": { name: "Springfield Lakes",slug:"springfield-lakes-4300",state:"QLD"},
  "4306": { name: "Ripley",         slug: "ripley-4306",         state: "QLD" },
  "4208": { name: "Ormeau",         slug: "ormeau-4208",         state: "QLD" },
  "4132": { name: "Marsden",        slug: "marsden-4132",        state: "QLD" },
  "4109": { name: "Sunnybank Hills",slug:"sunnybank-hills-4109", state: "QLD" },
  "4113": { name: "Eight Mile Plains",slug:"eight-mile-plains-4113",state:"QLD"},
  "4118": { name: "Browns Plains",  slug: "browns-plains-4118",  state: "QLD" },
  "4152": { name: "Carindale",      slug: "carindale-4152",      state: "QLD" },
  "4178": { name: "Wynnum",         slug: "wynnum-4178",         state: "QLD" },
  "4123": { name: "Rochedale South",slug:"rochedale-south-4123", state: "QLD" },
  "4510": { name: "Caboolture",     slug: "caboolture-4510",     state: "QLD" },
  "4504": { name: "Narangba",       slug: "narangba-4504",       state: "QLD" },
  "4509": { name: "Mango Hill",     slug: "mango-hill-4509",     state: "QLD" },
  "4000": { name: "Brisbane CBD",   slug: "brisbane-4000",       state: "QLD" },
  // SA — top 15 by population
  "5162": { name: "Morphett Vale",  slug: "morphett-vale-5162",  state: "SA" },
  "5108": { name: "Salisbury",      slug: "salisbury-5108",      state: "SA" },
  "5092": { name: "Modbury",        slug: "modbury-5092",        state: "SA" },
  "5164": { name: "Christie Downs", slug: "christie-downs-5164", state: "SA" },
  "5115": { name: "Munno Para",     slug: "munno-para-5115",     state: "SA" },
  "5095": { name: "Mawson Lakes",   slug: "mawson-lakes-5095",   state: "SA" },
  "5107": { name: "Parafield Gardens",slug:"parafield-gardens-5107",state:"SA"},
  "5118": { name: "Gawler",         slug: "gawler-5118",         state: "SA" },
  "5096": { name: "Para Hills",     slug: "para-hills-5096",     state: "SA" },
  "5158": { name: "Hallett Cove",   slug: "hallett-cove-5158",   state: "SA" },
  "5125": { name: "Golden Grove",   slug: "golden-grove-5125",   state: "SA" },
  "5173": { name: "Aldinga Beach",  slug: "aldinga-beach-5173",  state: "SA" },
  "5163": { name: "Hackham",        slug: "hackham-5163",        state: "SA" },
  "5112": { name: "Elizabeth",      slug: "elizabeth-5112",      state: "SA" },
  "5169": { name: "Seaford",        slug: "seaford-5169",        state: "SA" },
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

export const ALL_MEMBER_OFFERS = [
  "no contract",
  "contract",
  "new member trial",
  "referral scheme",
  "multiple location access",
  "gym or community app",
] as const;

export type MemberOffer = (typeof ALL_MEMBER_OFFERS)[number];

export const MEMBER_OFFER_ICONS: Record<string, string> = {
  "no contract": "🆓",
  "contract": "📝",
  "new member trial": "🎁",
  "referral scheme": "🤝",
  "multiple location access": "📍",
  "gym or community app": "📱",
};

export interface FilterOptions {
  postcode?: string;
  amenities: string[];
  memberOffers?: string[];
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

  // Filter by selected member offers (must have ALL selected)
  if (options.memberOffers && options.memberOffers.length > 0) {
    results = results.filter((g) =>
      options.memberOffers!.every((o) => (g.memberOffers ?? []).includes(o))
    );
  }

  return results;
}

// Quality tier for non-featured gyms (higher = appears first)
function gymTier(gym: Gym): number {
  const isOwned = gym.ownerId !== "owner-3" && gym.ownerId !== "unclaimed" && gym.ownerId !== "";
  const hasPricing = (gym.priceVerified ?? false) && (gym.pricePerWeek ?? 0) > 0;
  if (gym.isPaid) return 4;
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
