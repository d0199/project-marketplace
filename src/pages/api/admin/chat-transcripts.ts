import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuth";
import { chatTranscriptStore } from "@/lib/chatTranscriptStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  if (req.method === "GET") {
    const transcripts = await chatTranscriptStore.getAll();
    return res.json(transcripts);
  }

  if (req.method === "DELETE") {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: "id is required" });
    await chatTranscriptStore.delete(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
