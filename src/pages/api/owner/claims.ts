import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";

/**
 * GET /api/owner/claims?email=owner@example.com
 *   Returns all claims submitted by this email address.
 *
 * PUT /api/owner/claims?id=<claimId>
 *   Resubmit a rejected claim with an optional note.
 *   Body: { message?: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAmplifyConfigured()) {
    return res.status(503).json({ error: "Backend not configured" });
  }

  if (req.method === "GET") {
    const email = String(req.query.email ?? "").toLowerCase();
    if (!email) return res.status(400).json({ error: "Missing email" });

    // Scan claims filtered by claimantEmail (no GSI — claim volume is low)
    const results: Record<string, unknown>[] = [];
    let nextToken: string | null | undefined;
    do {
      const r = await dataClient.models.Claim.list({ limit: 1000, nextToken });
      results.push(...(r.data ?? []));
      nextToken = r.nextToken;
    } while (nextToken);

    const mine = results.filter(
      (c) => String(c.claimantEmail ?? "").toLowerCase() === email
    );

    return res.status(200).json(mine);
  }

  if (req.method === "PUT") {
    const id = String(req.query.id ?? "");
    if (!id) return res.status(400).json({ error: "Missing claim id" });

    const { message } = req.body ?? {};

    // Fetch current claim
    const { data: claim } = await dataClient.models.Claim.get({ id });
    if (!claim) return res.status(404).json({ error: "Claim not found" });

    if (claim.status !== "rejected") {
      return res.status(400).json({ error: "Only rejected claims can be resubmitted" });
    }

    // Resubmit: set back to pending, append note
    const existingNotes = claim.notes ? `${claim.notes}\n---\n` : "";
    await dataClient.models.Claim.update({
      id,
      status: "pending",
      notes: `${existingNotes}Resubmitted by owner${message ? `: ${message}` : ""}`,
    });

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const id = String(req.query.id ?? "");
    if (!id) return res.status(400).json({ error: "Missing claim id" });

    const { data: claim } = await dataClient.models.Claim.get({ id });
    if (!claim) return res.status(404).json({ error: "Claim not found" });

    if (claim.status !== "pending" && claim.status !== "rejected") {
      return res.status(400).json({ error: "Only pending or rejected claims can be deleted" });
    }

    await dataClient.models.Claim.delete({ id });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).end();
}
