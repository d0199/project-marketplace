#!/usr/bin/env npx tsx
/**
 * Scrape Personal Trainer listings from Google Places API (New).
 *
 * Uses Text Search to find "personal trainer" businesses across Australian cities,
 * then fetches full details (phone, website, hours, etc.) for each result.
 *
 * Usage:
 *   npx tsx scripts/scrape-pts-google.ts
 *   npx tsx scripts/scrape-pts-google.ts --state WA
 *   npx tsx scripts/scrape-pts-google.ts --state WA --limit 50
 *   npx tsx scripts/scrape-pts-google.ts --radius 30000
 *
 * Resume: re-running skips already-scraped Place IDs automatically.
 */

import fs from "fs";
import path from "path";
import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";

// ── Load .env.local ──────────────────────────────────────────────────────────
const envFile = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const val = rest.join("=").replace(/^['"]|['"]$/g, "");
    if (!process.env[key.trim()]) process.env[key.trim()] = val;
  }
}

// ── Config ───────────────────────────────────────────────────────────────────
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const DEFAULT_OUTPUT = `data/pts_google_${new Date().toISOString().slice(0, 10)}.csv`;
const DELAY_MS = 300; // between API calls to avoid quota issues

// Fields we want from Google Places (New API)
const DETAIL_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.regularOpeningHours",
  "places.businessStatus",
  "places.rating",
  "places.userRatingCount",
  "places.types",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.photos",
  "places.editorialSummary",
].join(",");

// Search locations: dense grid of Australian cities, suburbs, and regional centres
// Each entry: [query suffix, lat, lng]
const SEARCH_LOCATIONS: Record<string, [string, number, number][]> = {
  WA: [
    // Perth metro — dense grid
    ["Perth CBD", -31.9505, 115.8605],
    ["Northbridge WA", -31.9440, 115.8570],
    ["Fremantle", -32.0569, 115.7439],
    ["Joondalup", -31.7467, 115.7677],
    ["Rockingham", -32.2772, 115.7301],
    ["Midland", -31.8891, 116.0104],
    ["Armadale WA", -32.1532, 116.0103],
    ["Scarborough WA", -31.8940, 115.7580],
    ["Subiaco", -31.9440, 115.8270],
    ["Morley WA", -31.8920, 115.9050],
    ["Cannington", -32.0169, 115.9340],
    ["Canning Vale", -32.0630, 115.9185],
    ["Baldivis", -32.3240, 115.7830],
    ["Ellenbrook", -31.7650, 116.0530],
    ["Mandurah", -32.5269, 115.7217],
    ["Clarkson WA", -31.6830, 115.7270],
    ["Wanneroo", -31.7500, 115.8060],
    ["Hillarys WA", -31.8230, 115.7380],
    ["Innaloo WA", -31.8920, 115.7960],
    ["Nedlands", -31.9790, 115.8060],
    ["Victoria Park WA", -31.9760, 115.8970],
    ["Belmont WA", -31.9510, 115.9390],
    ["Bassendean", -31.9070, 115.9490],
    ["Kalamunda", -31.9740, 116.0590],
    ["Mundijong", -32.2930, 115.9830],
    ["Byford WA", -32.2220, 116.0040],
    ["Cockburn Central", -32.1240, 115.8460],
    ["Success WA", -32.1440, 115.8500],
    ["Bibra Lake", -32.0910, 115.8180],
    ["Willetton", -32.0530, 115.8870],
    ["Riverton WA", -32.0340, 115.8970],
    ["Thornlie", -32.0580, 115.9570],
    ["Gosnells", -32.0810, 116.0050],
    ["Warnbro", -32.3370, 115.7510],
    ["Kwinana", -32.2410, 115.7790],
    // WA regional
    ["Bunbury", -33.3271, 115.6414],
    ["Geraldton", -28.7744, 114.6150],
    ["Busselton", -33.6445, 115.3487],
    ["Albany WA", -35.0269, 117.8837],
    ["Kalgoorlie", -30.7489, 121.4661],
    ["Karratha", -20.7344, 116.8461],
    ["Broome", -17.9614, 122.2359],
  ],
  NSW: [
    // Sydney metro — dense grid
    ["Sydney CBD", -33.8688, 151.2093],
    ["Parramatta", -33.8151, 151.0011],
    ["Bondi", -33.8915, 151.2767],
    ["Chatswood", -33.7969, 151.1832],
    ["Liverpool NSW", -33.9200, 150.9237],
    ["Penrith", -33.7510, 150.6944],
    ["Manly NSW", -33.7981, 151.2877],
    ["Cronulla", -34.0548, 151.1517],
    ["Newtown NSW", -33.8975, 151.1786],
    ["Bankstown", -33.9175, 151.0350],
    ["Hornsby", -33.7043, 151.0993],
    ["Dee Why", -33.7500, 151.2850],
    ["Blacktown", -33.7690, 150.9063],
    ["Castle Hill", -33.7310, 151.0050],
    ["Campbelltown NSW", -34.0650, 150.8142],
    ["Hurstville", -33.9670, 151.1010],
    ["Marrickville", -33.9110, 151.1550],
    ["Ryde", -33.8130, 151.1040],
    ["Strathfield", -33.8780, 151.0940],
    ["Burwood NSW", -33.8770, 151.1030],
    ["Randwick", -33.9140, 151.2410],
    ["Maroubra", -33.9490, 151.2410],
    ["Mascot NSW", -33.9260, 151.1930],
    ["Kogarah", -33.9660, 151.1330],
    ["Miranda", -34.0370, 151.1010],
    ["Caringbah", -34.0480, 151.1250],
    ["Brookvale", -33.7670, 151.2700],
    ["Mona Vale", -33.6780, 151.3020],
    ["Epping NSW", -33.7730, 151.0820],
    ["Macquarie Park", -33.7760, 151.1230],
    ["Rhodes NSW", -33.8300, 151.0890],
    ["Drummoyne", -33.8540, 151.1540],
    ["Leichhardt", -33.8830, 151.1570],
    ["Ashfield NSW", -33.8890, 151.1260],
    ["Concord", -33.8600, 151.1050],
    ["Auburn NSW", -33.8490, 151.0330],
    ["Merrylands", -33.8360, 150.9920],
    ["Fairfield NSW", -33.8710, 150.9560],
    ["Cabramatta", -33.8950, 150.9360],
    ["Wetherill Park", -33.8430, 150.9050],
    ["Mount Druitt", -33.7680, 150.8180],
    ["Rouse Hill", -33.6820, 150.9120],
    ["Kellyville", -33.7170, 150.9540],
    ["Camden NSW", -34.0540, 150.6960],
    ["Oran Park", -34.0030, 150.7410],
    ["Narellan", -34.0410, 150.7260],
    // NSW regional
    ["Newcastle", -32.9283, 151.7817],
    ["Wollongong", -34.4278, 150.8931],
    ["Central Coast NSW", -33.4260, 151.3420],
    ["Gosford", -33.4250, 151.3410],
    ["Maitland NSW", -32.7330, 151.5560],
    ["Cessnock", -32.8320, 151.3560],
    ["Port Macquarie", -31.4310, 152.9090],
    ["Coffs Harbour", -30.2963, 153.1138],
    ["Tamworth", -31.0830, 150.9170],
    ["Dubbo", -32.2427, 148.6024],
    ["Orange NSW", -33.2835, 149.1013],
    ["Bathurst", -33.4193, 149.5777],
    ["Wagga Wagga", -35.1082, 147.3598],
    ["Albury", -36.0737, 146.9135],
    ["Lismore NSW", -28.8133, 153.2840],
    ["Byron Bay", -28.6474, 153.6020],
    ["Tweed Heads", -28.1760, 153.5410],
    ["Nowra", -34.8800, 150.6000],
    ["Shellharbour", -34.5830, 150.8700],
    ["Queanbeyan", -35.3540, 149.2320],
    ["Armidale NSW", -30.5130, 151.6660],
    ["Broken Hill", -31.9530, 141.4530],
  ],
  VIC: [
    // Melbourne metro — dense grid
    ["Melbourne CBD", -37.8136, 144.9631],
    ["St Kilda", -37.8578, 144.9797],
    ["Richmond VIC", -37.8235, 145.0000],
    ["South Yarra", -37.8388, 144.9921],
    ["Brunswick VIC", -37.7654, 144.9605],
    ["Hawthorn VIC", -37.8167, 145.0366],
    ["Footscray", -37.7990, 144.8994],
    ["Caulfield", -37.8777, 145.0233],
    ["Preston VIC", -37.7430, 145.0150],
    ["Coburg", -37.7440, 144.9660],
    ["Essendon", -37.7550, 144.9170],
    ["Moonee Ponds", -37.7670, 144.9200],
    ["Carlton", -37.8000, 144.9670],
    ["Fitzroy", -37.7990, 144.9780],
    ["Collingwood VIC", -37.8020, 144.9870],
    ["Prahran", -37.8480, 144.9920],
    ["Malvern VIC", -37.8630, 145.0310],
    ["Glen Iris", -37.8600, 145.0600],
    ["Camberwell", -37.8410, 145.0580],
    ["Box Hill", -37.8190, 145.1220],
    ["Doncaster", -37.7850, 145.1270],
    ["Ringwood", -37.8150, 145.2290],
    ["Croydon VIC", -37.7950, 145.2820],
    ["Lilydale VIC", -37.7570, 145.3540],
    ["Eltham", -37.7140, 145.1480],
    ["Greensborough", -37.7040, 145.1050],
    ["Heidelberg", -37.7570, 145.0670],
    ["Ivanhoe", -37.7690, 145.0430],
    ["Northcote", -37.7700, 145.0010],
    ["Thornbury VIC", -37.7570, 145.0060],
    ["Reservoir VIC", -37.7160, 145.0070],
    ["South Melbourne", -37.8320, 144.9580],
    ["Port Melbourne", -37.8380, 144.9330],
    ["Williamstown", -37.8560, 144.8980],
    ["Altona", -37.8680, 144.8300],
    ["Werribee", -37.8990, 144.6610],
    ["Point Cook", -37.9080, 144.7480],
    ["Tarneit", -37.8370, 144.6960],
    ["Sunshine VIC", -37.7880, 144.8320],
    ["Caroline Springs", -37.7410, 144.7350],
    ["Melton", -37.6870, 144.5800],
    ["Craigieburn", -37.5980, 144.9420],
    ["Epping VIC", -37.6510, 145.0260],
    ["South Morang", -37.6530, 145.0900],
    ["Mill Park", -37.6630, 145.0640],
    ["Dandenong", -37.9870, 145.2150],
    ["Cranbourne", -38.0990, 145.2840],
    ["Berwick", -38.0350, 145.3470],
    ["Narre Warren", -38.0200, 145.3040],
    ["Frankston", -38.1430, 145.1260],
    ["Mornington VIC", -38.2190, 145.0380],
    ["Cheltenham VIC", -37.9550, 145.0520],
    ["Moorabbin", -37.9380, 145.0440],
    ["Brighton VIC", -37.9070, 144.9870],
    ["Bentleigh", -37.9190, 145.0340],
    ["Clayton", -37.9250, 145.1200],
    ["Glen Waverley", -37.8790, 145.1650],
    ["Mount Waverley", -37.8770, 145.1290],
    // VIC regional
    ["Geelong", -38.1499, 144.3617],
    ["Ballarat", -37.5622, 143.8503],
    ["Bendigo", -36.7570, 144.2794],
    ["Shepparton", -36.3833, 145.3988],
    ["Wodonga", -36.1210, 146.8880],
    ["Warrnambool", -38.3818, 142.4878],
    ["Mildura", -34.1849, 142.1626],
    ["Traralgon", -38.1950, 146.5310],
    ["Sale VIC", -38.1060, 147.0660],
    ["Horsham VIC", -36.7120, 142.1990],
    ["Torquay VIC", -38.3310, 144.3260],
    ["Ocean Grove VIC", -38.2560, 144.5170],
  ],
  QLD: [
    // Brisbane metro — dense grid
    ["Brisbane CBD", -27.4698, 153.0251],
    ["Fortitude Valley", -27.4577, 153.0357],
    ["South Brisbane", -27.4810, 153.0200],
    ["West End QLD", -27.4830, 153.0090],
    ["New Farm", -27.4680, 153.0470],
    ["Paddington QLD", -27.4600, 153.0100],
    ["Milton QLD", -27.4720, 152.9980],
    ["Toowong", -27.4840, 152.9810],
    ["Indooroopilly", -27.5020, 152.9720],
    ["Kenmore", -27.5080, 152.9370],
    ["Carindale", -27.5058, 153.1017],
    ["Chermside", -27.3872, 153.0338],
    ["Nundah", -27.4020, 153.0570],
    ["Wynnum", -27.4520, 153.1570],
    ["Bulimba", -27.4560, 153.0660],
    ["Coorparoo", -27.4940, 153.0540],
    ["Moorooka", -27.5260, 153.0260],
    ["Sunnybank", -27.5790, 153.0610],
    ["Mount Gravatt", -27.5440, 153.0780],
    ["Upper Mount Gravatt", -27.5610, 153.0830],
    ["Eight Mile Plains", -27.5800, 153.0990],
    ["Springwood QLD", -27.6090, 153.1280],
    ["Logan", -27.6390, 153.1090],
    ["Browns Plains", -27.6640, 153.0530],
    ["Springfield QLD", -27.6570, 152.9070],
    ["Ipswich QLD", -27.6147, 152.7609],
    ["Redcliffe QLD", -27.2270, 153.0830],
    ["North Lakes", -27.2310, 152.9870],
    ["Caboolture", -27.0850, 152.9510],
    ["Strathpine", -27.3050, 152.9890],
    ["Mitchelton", -27.4170, 152.9710],
    ["Aspley", -27.3650, 153.0160],
    ["Stafford QLD", -27.4130, 153.0120],
    ["Everton Park", -27.4030, 152.9830],
    ["Ferny Grove", -27.4010, 152.9370],
    ["The Gap QLD", -27.4450, 152.9470],
    ["Ashgrove", -27.4440, 152.9870],
    // Gold Coast
    ["Gold Coast", -28.0167, 153.4000],
    ["Surfers Paradise", -28.0029, 153.4300],
    ["Broadbeach", -28.0260, 153.4310],
    ["Burleigh Heads", -28.0870, 153.4440],
    ["Palm Beach QLD", -28.1140, 153.4640],
    ["Coolangatta", -28.1680, 153.5370],
    ["Robina", -28.0810, 153.3850],
    ["Nerang", -28.0020, 153.3370],
    ["Southport", -27.9670, 153.4020],
    ["Helensvale", -27.9150, 153.3430],
    ["Coomera", -27.8640, 153.3310],
    // Sunshine Coast
    ["Sunshine Coast", -26.6500, 153.0667],
    ["Maroochydore", -26.6590, 153.1000],
    ["Noosa", -26.3940, 153.0580],
    ["Caloundra", -26.7980, 153.1290],
    ["Nambour", -26.6270, 152.9590],
    // QLD regional
    ["Toowoomba", -27.5598, 151.9507],
    ["Cairns", -16.9186, 145.7781],
    ["Townsville", -19.2590, 146.8169],
    ["Mackay", -21.1411, 149.1861],
    ["Rockhampton", -23.3791, 150.5100],
    ["Bundaberg", -24.8661, 152.3489],
    ["Hervey Bay", -25.2882, 152.8531],
    ["Gladstone QLD", -23.8489, 151.2660],
    ["Mount Isa", -20.7256, 139.4927],
  ],
  SA: [
    // Adelaide metro — dense grid
    ["Adelaide CBD", -34.9285, 138.6007],
    ["Glenelg", -34.9821, 138.5126],
    ["Norwood SA", -34.9218, 138.6316],
    ["Unley", -34.9499, 138.5937],
    ["Port Adelaide", -34.8469, 138.5034],
    ["Prospect SA", -34.8850, 138.5990],
    ["Semaphore", -34.8380, 138.4810],
    ["Henley Beach", -34.9190, 138.4940],
    ["Marion SA", -35.0140, 138.5570],
    ["Mitcham SA", -35.0060, 138.6220],
    ["Modbury", -34.8330, 138.6830],
    ["Elizabeth SA", -34.7180, 138.6730],
    ["Salisbury SA", -34.7630, 138.6450],
    ["Morphett Vale", -35.1300, 138.5240],
    ["Seaford SA", -35.1890, 138.4730],
    ["Mount Barker SA", -35.0680, 138.8580],
    ["Stirling SA", -35.0020, 138.7150],
    ["Brighton SA", -35.0250, 138.5210],
    ["Fulham Gardens", -34.9270, 138.5310],
    ["West Lakes", -34.8760, 138.5130],
    ["Mawson Lakes", -34.8060, 138.6100],
    ["Golden Grove SA", -34.7940, 138.7270],
    ["Tea Tree Gully", -34.8250, 138.7200],
    ["Campbelltown SA", -34.8810, 138.6670],
    ["Burnside SA", -34.9460, 138.6490],
    // SA regional
    ["Murray Bridge", -35.1198, 139.2734],
    ["Mount Gambier", -37.8305, 140.7825],
    ["Whyalla", -33.0315, 137.5246],
    ["Port Augusta", -32.4915, 137.7832],
    ["Port Lincoln", -34.7263, 135.8594],
    ["Victor Harbor", -35.5527, 138.6167],
  ],
  TAS: [
    // Hobart metro
    ["Hobart", -42.8821, 147.3272],
    ["Sandy Bay TAS", -42.9010, 147.3230],
    ["Glenorchy TAS", -42.8310, 147.2780],
    ["Kingston TAS", -42.9760, 147.3040],
    ["Moonah", -42.8490, 147.3020],
    ["Howrah TAS", -42.8830, 147.3830],
    ["Bridgewater TAS", -42.7410, 147.2300],
    // Launceston metro
    ["Launceston", -41.4332, 147.1441],
    ["Mowbray TAS", -41.4140, 147.1380],
    ["Newstead TAS", -41.4490, 147.1610],
    ["Prospect TAS", -41.4630, 147.1490],
    // TAS regional
    ["Devonport", -41.1796, 146.3513],
    ["Burnie", -41.0551, 145.9067],
    ["Ulverstone", -41.1580, 146.1710],
  ],
};

const OUTPUT_FIELDS = [
  "googlePlaceId",
  "name",
  "formattedAddress",
  "addressStreet",
  "addressSuburb",
  "addressState",
  "addressPostcode",
  "lat",
  "lng",
  "phone",
  "internationalPhone",
  "email",
  "website",
  "googleMapsUrl",
  "rating",
  "ratingCount",
  "businessStatus",
  "primaryType",
  "types",
  "description",
  "hoursMonday",
  "hoursTuesday",
  "hoursWednesday",
  "hoursThursday",
  "hoursFriday",
  "hoursSaturday",
  "hoursSunday",
  "photoCount",
  "photoRefs",
  "searchQuery",
  "searchLocation",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    state: get("--state")?.toUpperCase(),
    limit: get("--limit") ? parseInt(get("--limit")!) : undefined,
    radius: get("--radius") ? parseInt(get("--radius")!) : 20000, // 20km default
    output: get("--output"),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadProcessedIds(outputCsv: string): Set<string> {
  if (!fs.existsSync(outputCsv)) return new Set();
  const rows = parse(fs.readFileSync(outputCsv, "utf8"), { columns: true });
  return new Set(rows.map((r: any) => r.googlePlaceId));
}

function appendRow(outputCsv: string, row: Record<string, string>) {
  const isNew = !fs.existsSync(outputCsv);
  const line = stringify([row], { header: isNew, columns: OUTPUT_FIELDS });
  fs.appendFileSync(outputCsv, line, "utf8");
}

// Parse address components from Google Places API
function parseAddressComponents(
  components: any[]
): {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
} {
  const get = (type: string) =>
    components?.find((c: any) => c.types?.includes(type))?.longText || "";

  const streetNumber = get("street_number");
  const route = get("route");
  const street = [streetNumber, route].filter(Boolean).join(" ");
  const suburb = get("locality") || get("sublocality") || get("neighborhood") || "";
  const state = components?.find((c: any) => c.types?.includes("administrative_area_level_1"))?.shortText || "";
  const postcode = get("postal_code");

  return { street, suburb, state, postcode };
}

// Format opening hours into per-day strings
function formatHours(
  openingHours: any
): Record<string, string> {
  const result: Record<string, string> = {
    hoursMonday: "",
    hoursTuesday: "",
    hoursWednesday: "",
    hoursThursday: "",
    hoursFriday: "",
    hoursSaturday: "",
    hoursSunday: "",
  };

  if (!openingHours?.periods) return result;

  const dayMap: Record<number, string> = {
    0: "hoursSunday",
    1: "hoursMonday",
    2: "hoursTuesday",
    3: "hoursWednesday",
    4: "hoursThursday",
    5: "hoursFriday",
    6: "hoursSaturday",
  };

  for (const period of openingHours.periods) {
    const dayKey = dayMap[period.open?.day];
    if (!dayKey) continue;

    const openH = period.open?.hour ?? 0;
    const openM = period.open?.minute ?? 0;
    const closeH = period.close?.hour ?? 0;
    const closeM = period.close?.minute ?? 0;

    const fmt = (h: number, m: number) => {
      const suffix = h >= 12 ? "PM" : "AM";
      const hh = h % 12 || 12;
      return m === 0 ? `${hh}${suffix}` : `${hh}:${String(m).padStart(2, "0")}${suffix}`;
    };

    // 24-hour check
    if (openH === 0 && openM === 0 && closeH === 23 && closeM === 59) {
      result[dayKey] = "Open 24 hours";
    } else {
      const existing = result[dayKey];
      const slot = `${fmt(openH, openM)} - ${fmt(closeH, closeM)}`;
      result[dayKey] = existing ? `${existing}, ${slot}` : slot;
    }
  }

  return result;
}

// ── Google Places API (New) ──────────────────────────────────────────────────

const BASE_URL = "https://places.googleapis.com/v1/places:searchText";

interface SearchResult {
  places?: any[];
  nextPageToken?: string;
}

async function textSearch(
  query: string,
  lat: number,
  lng: number,
  radiusM: number,
  pageToken?: string
): Promise<SearchResult> {
  const body: any = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusM,
      },
    },
    maxResultCount: 20,
    languageCode: "en",
    regionCode: "AU",
  };

  if (pageToken) {
    body.pageToken = pageToken;
  }

  const resp = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY!,
      "X-Goog-FieldMask": DETAIL_FIELDS + ",nextPageToken",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Places API error ${resp.status}: ${errText.slice(0, 300)}`);
  }

  return resp.json();
}

function placeToRow(
  place: any,
  searchQuery: string,
  searchLocation: string
): Record<string, string> {
  const addr = parseAddressComponents(place.addressComponents);
  const hours = formatHours(place.regularOpeningHours);

  // Extract photo references (first 6)
  const photos = (place.photos || []).slice(0, 6);
  const photoRefs = photos
    .map((p: any) => p.name) // e.g. "places/ChIJ.../photos/AelY..."
    .join("|");

  return {
    googlePlaceId: place.id || "",
    name: place.displayName?.text || "",
    formattedAddress: place.formattedAddress || "",
    addressStreet: addr.street,
    addressSuburb: addr.suburb,
    addressState: addr.state,
    addressPostcode: addr.postcode,
    lat: String(place.location?.latitude || ""),
    lng: String(place.location?.longitude || ""),
    phone: place.nationalPhoneNumber || "",
    internationalPhone: place.internationalPhoneNumber || "",
    email: "", // Google Places doesn't return email directly
    website: place.websiteUri || "",
    googleMapsUrl: place.googleMapsUri || "",
    rating: String(place.rating || ""),
    ratingCount: String(place.userRatingCount || ""),
    businessStatus: place.businessStatus || "",
    primaryType: place.primaryTypeDisplayName?.text || place.primaryType || "",
    types: (place.types || []).join("|"),
    description: place.editorialSummary?.text || "",
    ...hours,
    photoCount: String(photos.length),
    photoRefs,
    searchQuery,
    searchLocation,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();
  const OUTPUT_CSV = path.resolve(opts.output ?? DEFAULT_OUTPUT);

  if (!API_KEY) {
    console.error("Error: GOOGLE_PLACES_API_KEY not found in environment or .env.local");
    process.exit(1);
  }

  // Determine which states to search
  const states = opts.state
    ? [opts.state]
    : Object.keys(SEARCH_LOCATIONS);

  const allLocations: { state: string; label: string; lat: number; lng: number }[] = [];
  for (const st of states) {
    const locs = SEARCH_LOCATIONS[st];
    if (!locs) {
      console.error(`Unknown state: ${st}. Available: ${Object.keys(SEARCH_LOCATIONS).join(", ")}`);
      process.exit(1);
    }
    for (const [label, lat, lng] of locs) {
      allLocations.push({ state: st, label, lat, lng });
    }
  }

  console.log(`Searching ${allLocations.length} locations across ${states.join(", ")}`);
  console.log(`Radius: ${(opts.radius / 1000).toFixed(0)}km | Output: ${OUTPUT_CSV}\n`);

  // Load already-processed place IDs for dedup
  const processed = loadProcessedIds(OUTPUT_CSV);
  console.log(`Already scraped: ${processed.size.toLocaleString()} place IDs\n`);

  const SEARCH_QUERIES = [
    "personal trainer",
    "personal training studio",
    "fitness coach",
    "PT studio",
    "strength coach",
    "boxing trainer",
    "pilates instructor",
    "yoga instructor",
    "CrossFit coach",
    "sports performance coach",
  ];

  let totalNew = 0;
  let totalSkipped = 0;
  let totalApiCalls = 0;

  for (const loc of allLocations) {
    for (const query of SEARCH_QUERIES) {
      const fullQuery = `${query} near ${loc.label}`;
      process.stdout.write(`🔍 "${fullQuery}" ... `);

      let pageToken: string | undefined;
      let locationNew = 0;
      let locationSkipped = 0;
      let pageNum = 0;

      // Paginate through all results
      do {
        try {
          totalApiCalls++;
          const result = await textSearch(
            fullQuery,
            loc.lat,
            loc.lng,
            opts.radius,
            pageToken
          );

          const places = result.places || [];
          pageNum++;

          for (const place of places) {
            const placeId = place.id;
            if (!placeId || processed.has(placeId)) {
              locationSkipped++;
              continue;
            }

            // Check it's in Australia
            const addr = parseAddressComponents(place.addressComponents);
            const country = place.addressComponents?.find(
              (c: any) => c.types?.includes("country")
            )?.shortText;
            if (country && country !== "AU") {
              locationSkipped++;
              continue;
            }

            processed.add(placeId);
            const row = placeToRow(place, query, loc.label);
            appendRow(OUTPUT_CSV, row);
            locationNew++;
          }

          pageToken = result.nextPageToken;
          if (pageToken) await sleep(DELAY_MS);
        } catch (err: any) {
          console.error(`\n  ERROR: ${err.message}`);
          pageToken = undefined;
        }
      } while (pageToken);

      totalNew += locationNew;
      totalSkipped += locationSkipped;
      console.log(
        `${locationNew} new, ${locationSkipped} dupes (${pageNum} page${pageNum > 1 ? "s" : ""})`
      );

      // Check limit
      if (opts.limit && totalNew >= opts.limit) {
        console.log(`\nReached --limit ${opts.limit}, stopping.`);
        break;
      }

      await sleep(DELAY_MS);
    }

    if (opts.limit && totalNew >= opts.limit) break;
  }

  // Summary
  console.log(`\n── Done ──`);
  console.log(`  New PTs scraped : ${totalNew}`);
  console.log(`  Duplicates skip : ${totalSkipped}`);
  console.log(`  API calls       : ${totalApiCalls}`);
  console.log(`  Total in file   : ${processed.size}`);
  console.log(`\nOutput: ${OUTPUT_CSV}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
