import type { NextApiRequest, NextApiResponse } from "next";
import { ALL_SUBURB_INDEX } from "@/lib/utils";
import type { SuburbSuggestion } from "@/components/SearchBar";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuburbSuggestion[]>
) {
  const q = normalize(String(req.query.q ?? ""));
  if (q.length < 2) return res.status(200).json([]);

  const matches = ALL_SUBURB_INDEX
    .filter((s) => normalize(s.name).includes(q))
    .sort((a, b) => {
      const aS = normalize(a.name).startsWith(q) ? 0 : 1;
      const bS = normalize(b.name).startsWith(q) ? 0 : 1;
      return aS - bS || a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.status(200).json(matches);
}
