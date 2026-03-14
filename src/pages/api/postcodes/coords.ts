import type { NextApiRequest, NextApiResponse } from "next";
import { postcodeStore } from "@/lib/postcodeStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const postcode = String(req.query.postcode ?? "").trim();
  if (!/^\d{4}$/.test(postcode)) {
    return res.status(400).json({ error: "Invalid postcode" });
  }

  const coords = await postcodeStore.getCoords(postcode);
  if (!coords) {
    return res.status(404).json({ error: "Postcode not found" });
  }

  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
  res.status(200).json({ lat: coords[0], lng: coords[1] });
}
