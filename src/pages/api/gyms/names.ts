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

export default async function handler(req: NextApiRequest, res: NextApiResponse<GymNameEntry[]>) {
  const q = normalize(String(req.query.q ?? ""));
  if (q.length < 2) return res.status(200).json([]);

  const allGyms = await ownerStore.getAll();
  const words = q.split(/\s+/).filter(Boolean);

  const matches = allGyms
    .filter((g) => g.isActive !== false && !g.isTest)
    .filter((g) => {
      const combined = normalize(`${g.name} ${g.address?.suburb || ""} ${g.address?.state || ""}`);
      return words.every((w) => combined.includes(w));
    })
    .sort((a, b) => {
      const aS = normalize(a.name).startsWith(words[0]) ? 0 : 1;
      const bS = normalize(b.name).startsWith(words[0]) ? 0 : 1;
      return aS - bS || a.name.localeCompare(b.name);
    })
    .slice(0, 8)
    .map((g) => ({
      id: g.id,
      name: g.name,
      suburb: g.address?.suburb || "",
      state: g.address?.state || "",
    }));

  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.status(200).json(matches);
}
