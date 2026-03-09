import type { NextApiRequest, NextApiResponse } from "next";
import { ownerStore } from "@/lib/ownerStore";

interface GymNameEntry {
  id: string;
  name: string;
  suburb: string;
  state: string;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

// In-memory cache — rebuilt every 5 minutes
let cachedIndex: GymNameEntry[] = [];
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getIndex(): Promise<GymNameEntry[]> {
  const now = Date.now();
  if (cachedIndex.length > 0 && now - cacheTime < CACHE_TTL) return cachedIndex;

  const allGyms = await ownerStore.getAll();
  cachedIndex = allGyms
    .filter((g) => g.isActive !== false && !g.isTest)
    .map((g) => ({
      id: g.id,
      name: g.name,
      suburb: g.address?.suburb || "",
      state: g.address?.state || "",
    }));
  cacheTime = now;
  return cachedIndex;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<GymNameEntry[]>) {
  const q = normalize(String(req.query.q ?? ""));
  if (q.length < 2) return res.status(200).json([]);

  const index = await getIndex();
  const words = q.split(/\s+/).filter(Boolean);

  const matches = index
    .filter((g) => {
      const combined = normalize(`${g.name} ${g.suburb} ${g.state}`);
      return words.every((w) => combined.includes(w));
    })
    .sort((a, b) => {
      const aS = normalize(a.name).startsWith(words[0]) ? 0 : 1;
      const bS = normalize(b.name).startsWith(words[0]) ? 0 : 1;
      return aS - bS || a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.status(200).json(matches);
}
