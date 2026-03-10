import type { NextApiRequest, NextApiResponse } from "next";
import { ptStore } from "@/lib/ptStore";
import { haversineKm, POSTCODE_COORDS } from "@/lib/utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const postcode = String(req.query.postcode ?? "");
  const radiusKm = Number(req.query.radius) || 10;

  const origin = POSTCODE_COORDS[postcode];
  if (!origin) return res.status(200).json([]);

  const allPTs = await ptStore.getAll();
  const visible = allPTs.filter((p) => p.isActive !== false && !p.isTest);

  const withDist = visible
    .map((p) => ({
      id: p.id,
      ownerId: p.ownerId,
      name: p.name,
      description: p.description,
      address: p.address,
      specialties: p.specialties,
      qualifications: p.qualifications,
      experienceYears: p.experienceYears,
      pricePerSession: p.pricePerSession,
      sessionDuration: p.sessionDuration,
      images: p.images,
      imageFocalPoints: p.imageFocalPoints,
      isFeatured: p.isFeatured,
      isPaid: p.isPaid,
      gender: p.gender,
      distanceKm: haversineKm(origin[0], origin[1], p.lat, p.lng),
    }))
    .filter((p) => (p.distanceKm ?? Infinity) <= radiusKm)
    .sort((a, b) => {
      // Featured first, then by distance
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
    });

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.status(200).json(withDist);
}
