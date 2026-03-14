import type { NextApiRequest, NextApiResponse } from "next";
import { ptStore } from "@/lib/ptStore";
import { haversineKm } from "@/lib/utils";
import { postcodeStore } from "@/lib/postcodeStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const postcode = String(req.query.postcode ?? "");
  const radiusKm = Number(req.query.radius) || 10;

  const origin = await postcodeStore.getCoords(postcode);
  if (!origin) return res.status(200).json([]);

  const allPTs = await ptStore.getAll();
  console.log(`[pts/search] total PTs: ${allPTs.length}, postcode: ${postcode}, radius: ${radiusKm}`);
  const visible = allPTs.filter((p) => p.isActive !== false && !p.isTest);
  console.log(`[pts/search] visible (active, non-test): ${visible.length}`);

  const withDist = visible
    .map((p) => {
      const actualDistanceKm = haversineKm(origin[0], origin[1], p.lat, p.lng);
      const isNational = p.isNational ?? false;
      const inServiceArea = p.serviceAreas?.includes(postcode) ?? false;
      const withinRadius = actualDistanceKm <= radiusKm;

      // Classify match type:
      // "local"   — PT's profile suburb is within search radius
      // "service" — PT is outside radius but has this postcode in their service areas
      // "online"  — PT is a national/online PT, not local and not in service area
      let matchType: "local" | "service" | "online";
      let distanceKm: number;

      if (withinRadius) {
        matchType = "local";
        distanceKm = actualDistanceKm;
      } else if (inServiceArea) {
        matchType = "service";
        distanceKm = 2.5; // Sort near top but behind local results
      } else if (isNational) {
        matchType = "online";
        distanceKm = 5; // Sort after service-area PTs
      } else {
        return null; // Not a match
      }

      return {
        id: p.id,
        slug: p.slug,
        suburbSlug: p.suburbSlug,
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
        distanceKm,
        matchType,
        inServiceArea,
        isNational,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => {
      // Featured first, then by distance
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
    });

  // Debug: if ?debug=1, include diagnostic info
  if (req.query.debug === "1") {
    const chantelle = allPTs.find((p) => p.slug === "chantelle" || p.name.toLowerCase().includes("chantelle"));
    return res.status(200).json({
      totalPTs: allPTs.length,
      visiblePTs: visible.length,
      matchedPTs: withDist.length,
      postcode,
      radiusKm,
      origin,
      chantelleDebug: chantelle ? {
        id: chantelle.id,
        name: chantelle.name,
        slug: chantelle.slug,
        isActive: chantelle.isActive,
        isTest: chantelle.isTest,
        lat: chantelle.lat,
        lng: chantelle.lng,
        addressPostcode: chantelle.address.postcode,
        distanceKm: haversineKm(origin[0], origin[1], chantelle.lat, chantelle.lng),
      } : "NOT FOUND in getAll()",
      results: withDist,
    });
  }

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.status(200).json(withDist);
}
