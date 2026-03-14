import type { NextApiRequest, NextApiResponse } from "next";
import { postcodeStore } from "@/lib/postcodeStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const lat = parseFloat(String(req.query.lat ?? ""));
  const lng = parseFloat(String(req.query.lng ?? ""));
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: "Invalid lat/lng" });
  }

  const result = await postcodeStore.findNearest(lat, lng);
  if (!result) {
    return res.status(404).json({ error: "No postcodes available" });
  }

  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  res.status(200).json(result);
}
