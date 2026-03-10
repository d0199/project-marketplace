import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";
import { datasetStore } from "@/lib/datasetStore";
import { ownerStore } from "@/lib/ownerStore";
import { ptStore } from "@/lib/ptStore";

/** Map dataset name → gym field that stores those values */
const DATASET_TO_GYM_FIELD: Record<string, "amenities" | "specialties" | "memberOffers"> = {
  amenities: "amenities",
  specialties: "specialties",
  "member-offers": "memberOffers",
};

/**
 * When entries are removed from a dataset, strip those values from every gym
 * or PT that currently has them set.
 */
async function cleanupRemovedEntries(datasetName: string, removedEntries: string[]) {
  if (removedEntries.length === 0) return 0;
  let updated = 0;
  const removedSet = new Set(removedEntries);

  // Clean PT specialties
  if (datasetName === "pt-specialties") {
    const allPTs = await ptStore.getAll();
    await Promise.all(
      allPTs.map(async (pt) => {
        const current = pt.specialties ?? [];
        const cleaned = current.filter((v) => !removedSet.has(v));
        if (cleaned.length < current.length) {
          await ptStore.update({ ...pt, specialties: cleaned });
          updated++;
        }
      })
    );
    if (updated > 0) {
      console.log(`[datasets] Removed ${removedEntries.length} entries from "pt-specialties" — cleaned ${updated} PT(s)`);
    }
    return updated;
  }

  // Clean PT member offers
  if (datasetName === "pt-member-offers") {
    const allPTs = await ptStore.getAll();
    await Promise.all(
      allPTs.map(async (pt) => {
        const current = pt.memberOffers ?? [];
        const cleaned = current.filter((v) => !removedSet.has(v));
        if (cleaned.length < current.length) {
          await ptStore.update({ ...pt, memberOffers: cleaned });
          updated++;
        }
      })
    );
    if (updated > 0) {
      console.log(`[datasets] Removed ${removedEntries.length} entries from "pt-member-offers" — cleaned ${updated} PT(s)`);
    }
    return updated;
  }

  // Clean gym fields
  const field = DATASET_TO_GYM_FIELD[datasetName];
  if (!field) return 0;

  const allGyms = await ownerStore.getAll();
  await Promise.all(
    allGyms.map(async (gym) => {
      const current: string[] = (gym[field] as string[] | undefined) ?? [];
      const cleaned = current.filter((v) => !removedSet.has(v));
      if (cleaned.length < current.length) {
        await ownerStore.update({ ...gym, [field]: cleaned });
        updated++;
      }
    })
  );

  if (updated > 0) {
    console.log(`[datasets] Removed ${removedEntries.length} entries from "${datasetName}" — cleaned ${updated} gym(s)`);
  }
  return updated;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET is available to all admins; mutations require super-admin
  if (req.method === "GET") {
    if (!(await requireAdmin(req, res))) return;
  } else {
    if (!(await requireSuperAdmin(req, res))) return;
  }

  if (req.method === "GET") {
    const name = req.query.name as string | undefined;
    if (name) {
      const ds = await datasetStore.getByName(name);
      return ds ? res.json(ds) : res.status(404).json({ error: "Not found" });
    }
    return res.json(await datasetStore.getAll());
  }

  if (req.method === "POST") {
    const { name, entries } = req.body;
    if (!name || typeof name !== "string") return res.status(400).json({ error: "name is required" });
    const existing = await datasetStore.getByName(name);
    if (existing) return res.status(409).json({ error: `Dataset "${name}" already exists` });
    const ds = await datasetStore.create(name.trim(), entries ?? []);
    return res.status(201).json(ds);
  }

  if (req.method === "PUT") {
    const { id, entries } = req.body;
    if (!id) return res.status(400).json({ error: "id is required" });

    try {
      // Find which entries were removed so we can clean them from gyms
      const allDatasets = await datasetStore.getAll();
      const current = allDatasets.find((d) => d.id === id);
      const newEntries: string[] = entries ?? [];

      // If this is a fallback dataset (not yet in DynamoDB), create it first
      let realId = id;
      if (id.startsWith("fallback-") && current) {
        const created = await datasetStore.create(current.name, newEntries);
        realId = created.id;
      } else {
        await datasetStore.update(id, newEntries);
      }

      let gymsUpdated = 0;
      if (current) {
        const newSet = new Set(newEntries);
        const removed = current.entries.filter((e) => !newSet.has(e));
        gymsUpdated = await cleanupRemovedEntries(current.name, removed);
      }

      return res.json({ ok: true, id: realId, gymsUpdated });
    } catch (err) {
      console.error("[datasets PUT] error:", err);
      return res.status(500).json({ error: err instanceof Error ? err.message : "Failed to save dataset" });
    }
  }

  if (req.method === "DELETE") {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "id is required" });

    // Remove all values from gyms before deleting the dataset
    const allDatasets = await datasetStore.getAll();
    const ds = allDatasets.find((d) => d.id === id);
    if (ds) {
      await cleanupRemovedEntries(ds.name, ds.entries);
    }

    await datasetStore.delete(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
