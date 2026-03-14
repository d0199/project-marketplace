import type { NextApiRequest, NextApiResponse } from "next";
import { postcodeStore } from "@/lib/postcodeStore";
import type { SuburbSuggestion } from "@/components/SearchBar";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuburbSuggestion[]>
) {
  const q = normalize(String(req.query.q ?? ""));
  if (q.length < 2) return res.status(200).json([]);

  const suburbIndex = await postcodeStore.getSuburbIndex();
  const isDigits = /^\d+$/.test(q);

  let matches: SuburbSuggestion[];

  if (isDigits) {
    // Postcode prefix search — show all suburbs for matching postcodes
    matches = [];
    for (const s of suburbIndex) {
      if (!s.postcode.startsWith(q)) continue;
      matches.push(s);
      if (matches.length >= 12) break;
    }
  } else {
    // Suburb name search
    matches = suburbIndex
      .filter((s) => normalize(s.name).includes(q))
      .sort((a, b) => {
        const aS = normalize(a.name).startsWith(q) ? 0 : 1;
        const bS = normalize(b.name).startsWith(q) ? 0 : 1;
        return aS - bS || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }

  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.status(200).json(matches);
}
