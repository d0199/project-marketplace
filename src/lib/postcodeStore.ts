import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";

interface PostcodeRow {
  postcode: string;
  suburb: string;
  state: string;
  lat: number;
  lng: number;
}

interface PostcodeCache {
  coords: Record<string, [number, number]>;
  suburbIndex: Array<{ name: string; postcode: string; state: string }>;
  suburbMap: Record<string, string>;
}

// Title-case a locality name (e.g. "MOUNT HAWTHORN" → "Mount Hawthorn")
function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Use global singleton so cache is shared across Next.js module boundaries
const g = globalThis as unknown as {
  __postcodeCache?: PostcodeCache;
  __postcodeCacheTime?: number;
};

async function loadAll(): Promise<PostcodeRow[]> {
  if (!isAmplifyConfigured()) return [];
  const rows: PostcodeRow[] = [];
  let nextToken: string | null | undefined;
  do {
    const res = await dataClient.models.Postcode.list({ limit: 1000, nextToken });
    for (const r of res.data ?? []) {
      rows.push({
        postcode: (r as Record<string, unknown>).postcode as string,
        suburb: (r as Record<string, unknown>).suburb as string,
        state: (r as Record<string, unknown>).state as string,
        lat: (r as Record<string, unknown>).lat as number,
        lng: (r as Record<string, unknown>).lng as number,
      });
    }
    nextToken = res.nextToken;
  } while (nextToken);
  return rows;
}

function buildCache(rows: PostcodeRow[]): PostcodeCache {
  // Average lat/lng per postcode
  const agg: Record<string, { sumLat: number; sumLng: number; count: number }> = {};
  for (const r of rows) {
    if (!agg[r.postcode]) agg[r.postcode] = { sumLat: 0, sumLng: 0, count: 0 };
    agg[r.postcode].sumLat += r.lat;
    agg[r.postcode].sumLng += r.lng;
    agg[r.postcode].count += 1;
  }
  const coords: Record<string, [number, number]> = {};
  for (const [pc, { sumLat, sumLng, count }] of Object.entries(agg)) {
    coords[pc] = [sumLat / count, sumLng / count];
  }

  // Suburb index — title-cased names
  const suburbIndex = rows.map((r) => ({
    name: toTitleCase(r.suburb),
    postcode: r.postcode,
    state: r.state,
  }));

  // Postcode → first suburb name
  const suburbMap: Record<string, string> = {};
  for (const r of rows) {
    if (!suburbMap[r.postcode]) suburbMap[r.postcode] = toTitleCase(r.suburb);
  }

  return { coords, suburbIndex, suburbMap };
}

async function getCache(): Promise<PostcodeCache> {
  if (g.__postcodeCache && g.__postcodeCacheTime && Date.now() - g.__postcodeCacheTime < CACHE_TTL) {
    return g.__postcodeCache;
  }
  const rows = await loadAll();
  const cache = buildCache(rows);
  g.__postcodeCache = cache;
  g.__postcodeCacheTime = Date.now();
  return cache;
}

export const postcodeStore = {
  /** Get averaged [lat, lng] for a single postcode */
  async getCoords(postcode: string): Promise<[number, number] | null> {
    const cache = await getCache();
    return cache.coords[postcode] ?? null;
  },

  /** Get full postcode → [lat, lng] map */
  async getAllCoords(): Promise<Record<string, [number, number]>> {
    const cache = await getCache();
    return cache.coords;
  },

  /** Get suburb search index (all rows, title-cased names) */
  async getSuburbIndex(): Promise<Array<{ name: string; postcode: string; state: string }>> {
    const cache = await getCache();
    return cache.suburbIndex;
  },

  /** Get postcode → first suburb name map */
  async getSuburbMap(): Promise<Record<string, string>> {
    const cache = await getCache();
    return cache.suburbMap;
  },

  /** Find nearest postcode to a given lat/lng */
  async findNearest(lat: number, lng: number): Promise<{ postcode: string; distance: number } | null> {
    const coords = await this.getAllCoords();
    const toRad = (d: number) => (d * Math.PI) / 180;
    let best: { postcode: string; distance: number } | null = null;
    for (const [pc, [pLat, pLng]] of Object.entries(coords)) {
      const dLat = toRad(pLat - lat);
      const dLng = toRad(pLng - lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(pLat)) * Math.sin(dLng / 2) ** 2;
      const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (!best || km < best.distance) best = { postcode: pc, distance: km };
    }
    return best;
  },

  /** Invalidate the in-memory cache */
  invalidate(): void {
    g.__postcodeCache = undefined;
    g.__postcodeCacheTime = undefined;
  },
};
