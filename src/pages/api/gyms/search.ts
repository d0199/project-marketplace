import type { NextApiRequest, NextApiResponse } from "next";
import { ownerStore } from "@/lib/ownerStore";
import { filterGyms, rankGyms, type GymWithDistance } from "@/lib/utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const postcode = String(req.query.postcode ?? "");
  const radiusKm = Number(req.query.radius) || 10;
  const amenities = req.query.amenities ? String(req.query.amenities).split(",").filter(Boolean) : [];
  const memberOffers = req.query.memberOffers ? String(req.query.memberOffers).split(",").filter(Boolean) : [];
  const sortBy = String(req.query.sort ?? "") as "" | "distance-asc" | "distance-desc" | "price-asc" | "price-desc";
  const includeTest = req.query.test === "1";

  const allGyms = await ownerStore.getAll();
  const visible = allGyms
    .filter((g) => g.isActive !== false)
    .filter((g) => includeTest || !g.isTest);

  const filtered = filterGyms(visible, { postcode: postcode || undefined, amenities, memberOffers, radiusKm });

  let results: GymWithDistance[];
  if (!sortBy) {
    const rotationSeed = Math.floor(Date.now() / (15 * 60 * 1000));
    results = rankGyms(filtered, rotationSeed);
  } else {
    results = [...filtered];
    const hasPublicPrice = (g: GymWithDistance) => g.priceVerified && g.pricePerWeek > 0;
    if (sortBy === "distance-asc") results.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    else if (sortBy === "distance-desc") results.sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0));
    else if (sortBy === "price-asc") results.sort((a, b) => {
      const aP = hasPublicPrice(a), bP = hasPublicPrice(b);
      if (aP && !bP) return -1;
      if (!aP && bP) return 1;
      if (!aP && !bP) return 0;
      return a.pricePerWeek - b.pricePerWeek;
    });
    else if (sortBy === "price-desc") results.sort((a, b) => {
      const aP = hasPublicPrice(a), bP = hasPublicPrice(b);
      if (aP && !bP) return -1;
      if (!aP && bP) return 1;
      if (!aP && !bP) return 0;
      return b.pricePerWeek - a.pricePerWeek;
    });
  }

  // Return only fields needed for GymCard display
  const cards = results.map((g) => ({
    id: g.id,
    ownerId: g.ownerId,
    name: g.name,
    description: g.description,
    address: g.address,
    amenities: g.amenities,
    specialties: g.specialties,
    images: g.images,
    imageFocalPoints: g.imageFocalPoints,
    pricePerWeek: g.pricePerWeek,
    priceVerified: g.priceVerified,
    isFeatured: g.isFeatured,
    isPaid: g.isPaid,
    memberOffers: g.memberOffers,
    memberOffersScroll: g.memberOffersScroll,
    memberScrollText: g.memberScrollText,
    website: g.website,
    phone: g.phone,
    email: g.email,
    lat: g.lat,
    lng: g.lng,
    distanceKm: g.distanceKm,
  }));

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  res.status(200).json(cards);
}
