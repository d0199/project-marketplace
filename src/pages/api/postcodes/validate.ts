import type { NextApiRequest, NextApiResponse } from "next";
import { postcodeStore } from "@/lib/postcodeStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const postcode = String(req.query.postcode ?? "").trim();
  if (!/^\d{4}$/.test(postcode)) {
    return res.status(200).json({ valid: false });
  }

  const coords = await postcodeStore.getCoords(postcode);
  if (!coords) {
    return res.status(200).json({ valid: false });
  }

  const suburbMap = await postcodeStore.getSuburbMap();
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.status(200).json({
    valid: true,
    suburb: suburbMap[postcode] ?? "",
    lat: coords[0],
    lng: coords[1],
  });
}
