import type { NextApiRequest, NextApiResponse } from "next";
import { ptStore } from "@/lib/ptStore";
import { ownerStore } from "@/lib/ownerStore";
import { affiliationStore } from "@/lib/affiliationStore";

/**
 * DEV-ONLY endpoint to stage affiliation test data.
 *
 * POST /api/dev/stage-affiliations
 *
 * Sets up two owners, each with a PT and a gym, plus cross-owner
 * pending affiliations so you can test the full approval flow.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).end();
  }
  if (req.method !== "POST") return res.status(405).end();

  const log: string[] = [];

  try {
    // ── Discover existing test entities ────────────────────────────────
    const allPTs = await ptStore.getAll();
    const allGyms = await ownerStore.getAll();

    // Find distinct owners who have at least one entity
    const ptsByOwner = new Map<string, typeof allPTs>();
    for (const pt of allPTs) {
      if (!ptsByOwner.has(pt.ownerId)) ptsByOwner.set(pt.ownerId, []);
      ptsByOwner.get(pt.ownerId)!.push(pt);
    }
    const gymsByOwner = new Map<string, typeof allGyms>();
    for (const gym of allGyms) {
      if (!gymsByOwner.has(gym.ownerId)) gymsByOwner.set(gym.ownerId, []);
      gymsByOwner.get(gym.ownerId)!.push(gym);
    }

    // Find two distinct owners to use
    const ownerIds = new Set([...ptsByOwner.keys(), ...gymsByOwner.keys()]);
    ownerIds.delete("unclaimed");
    ownerIds.delete("owner-3");
    const owners = [...ownerIds].slice(0, 2);

    if (owners.length < 2) {
      return res.status(400).json({ error: "Need at least 2 distinct owners. Found: " + owners.join(", ") });
    }

    const [ownerA, ownerB] = owners;
    log.push(`Owner A: ${ownerA}`);
    log.push(`Owner B: ${ownerB}`);

    // ── Ensure Owner A has a PT ────────────────────────────────────────
    let ptA = (ptsByOwner.get(ownerA) ?? [])[0];
    if (!ptA) {
      ptA = await ptStore.create({
        ownerId: ownerA,
        isActive: true,
        isTest: true,
        isPaid: true,
        isFeatured: false,
        name: "Test PT (Owner A)",
        description: "Staging PT for affiliation testing.",
        address: { street: "", suburb: "Perth", state: "WA", postcode: "6000" },
        phone: "", email: "test-a@demo.test", website: "",
        lat: -31.95, lng: 115.86,
        images: [], gymIds: [], specialties: ["Strength Training"],
        qualifications: ["Cert IV"], memberOffers: [], languages: ["English"],
      });
      log.push(`Created PT for Owner A: ${ptA.name} (${ptA.id})`);
    } else {
      log.push(`Owner A PT: ${ptA.name} (${ptA.id})`);
    }

    // ── Ensure Owner A has a gym ───────────────────────────────────────
    let gymA = (gymsByOwner.get(ownerA) ?? [])[0];
    if (!gymA) {
      gymA = await ownerStore.create({
        ownerId: ownerA,
        isActive: true,
        isTest: true,
        isFeatured: false,
        isPaid: false,
        priceVerified: false,
        name: "Test Gym A",
        description: "Staging gym for affiliation testing.",
        address: { street: "", suburb: "Perth", state: "WA", postcode: "6000" },
        phone: "", email: "", website: "",
        lat: -31.95, lng: 115.86,
        images: [], amenities: [],
        hours: { monday: "", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" },
        pricePerWeek: 0,
      });
      log.push(`Created Gym for Owner A: ${gymA.name} (${gymA.id})`);
    } else {
      log.push(`Owner A Gym: ${gymA.name} (${gymA.id})`);
    }

    // ── Ensure Owner B has a PT ────────────────────────────────────────
    let ptB = (ptsByOwner.get(ownerB) ?? [])[0];
    if (!ptB) {
      ptB = await ptStore.create({
        ownerId: ownerB,
        isActive: true,
        isTest: true,
        isPaid: true,
        isFeatured: false,
        name: "Test PT (Owner B)",
        description: "Staging PT for affiliation testing.",
        address: { street: "", suburb: "Northbridge", state: "WA", postcode: "6003" },
        phone: "", email: "test-b@demo.test", website: "",
        lat: -31.947, lng: 115.86,
        images: [], gymIds: [], specialties: ["HIIT"],
        qualifications: ["Cert III"], memberOffers: [], languages: ["English"],
      });
      log.push(`Created PT for Owner B: ${ptB.name} (${ptB.id})`);
    } else {
      log.push(`Owner B PT: ${ptB.name} (${ptB.id})`);
    }

    // ── Ensure Owner B has a gym ───────────────────────────────────────
    let gymB = (gymsByOwner.get(ownerB) ?? [])[0];
    if (!gymB) {
      gymB = await ownerStore.create({
        ownerId: ownerB,
        isActive: true,
        isTest: true,
        isFeatured: false,
        isPaid: false,
        priceVerified: false,
        name: "Test Gym B",
        description: "Staging gym for affiliation testing.",
        address: { street: "", suburb: "Northbridge", state: "WA", postcode: "6003" },
        phone: "", email: "", website: "",
        lat: -31.947, lng: 115.86,
        images: [], amenities: [],
        hours: { monday: "", tuesday: "", wednesday: "", thursday: "", friday: "", saturday: "", sunday: "" },
        pricePerWeek: 0,
      });
      log.push(`Created Gym for Owner B: ${gymB.name} (${gymB.id})`);
    } else {
      log.push(`Owner B Gym: ${gymB.name} (${gymB.id})`);
    }

    // ── Create pending affiliation: Owner A's PT → Owner B's gym ──────
    const affsA = await affiliationStore.getByPtId(ptA.id);
    const dupA = affsA.find((a) => a.gymId === gymB.id && (a.status === "pending" || a.status === "approved"));
    if (dupA) {
      log.push(`Affiliation exists (${dupA.status}): ${ptA.name} → ${gymB.name}`);
    } else {
      const aff = await affiliationStore.create({
        ptId: ptA.id, ptName: ptA.name,
        gymId: gymB.id, gymName: gymB.name,
        requestedBy: "pt", status: "pending",
      });
      log.push(`Created PENDING: ${ptA.name} → ${gymB.name} (${aff.id})`);
    }

    // ── Create pending affiliation: Owner B's PT → Owner A's gym ──────
    const affsB = await affiliationStore.getByPtId(ptB.id);
    const dupB = affsB.find((a) => a.gymId === gymA.id && (a.status === "pending" || a.status === "approved"));
    if (dupB) {
      log.push(`Affiliation exists (${dupB.status}): ${ptB.name} → ${gymA.name}`);
    } else {
      const aff = await affiliationStore.create({
        ptId: ptB.id, ptName: ptB.name,
        gymId: gymA.id, gymName: gymA.name,
        requestedBy: "pt", status: "pending",
      });
      log.push(`Created PENDING: ${ptB.name} → ${gymA.name} (${aff.id})`);
    }

    return res.json({
      success: true,
      log,
      testFlow: {
        ownerA: {
          ownerId: ownerA,
          pt: { id: ptA.id, name: ptA.name },
          gym: { id: gymA.id, name: gymA.name },
          actions: [
            "Log in → /billing → Affiliations",
            `PT Affiliations: see outbound request (${ptA.name} → ${gymB.name}) [pending]`,
            `Gym Affiliations: see inbound request (${ptB.name} → ${gymA.name}) → Approve/Reject`,
          ],
        },
        ownerB: {
          ownerId: ownerB,
          pt: { id: ptB.id, name: ptB.name },
          gym: { id: gymB.id, name: gymB.name },
          actions: [
            "Log in → /billing → Affiliations",
            `PT Affiliations: see outbound request (${ptB.name} → ${gymA.name}) [pending]`,
            `Gym Affiliations: see inbound request (${ptA.name} → ${gymB.name}) → Approve/Reject`,
          ],
        },
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message, log });
  }
}
