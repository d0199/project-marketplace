import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuth";
import { datasetStore } from "@/lib/datasetStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;

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
    await datasetStore.update(id, entries ?? []);
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "id is required" });
    await datasetStore.delete(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
