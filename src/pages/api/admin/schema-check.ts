import type { NextApiRequest, NextApiResponse } from "next";
import { dataClient, isAmplifyConfigured } from "@/lib/amplifyServerConfig";
import { requireAdmin } from "@/lib/adminAuth";

// Debug endpoint — returns what the Amplify client knows about the Gym schema
// and fetches one raw gym record so you can see which fields DynamoDB actually returns.
// GET /api/admin/schema-check
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "GET") return res.status(405).end();

  const configured = isAmplifyConfigured();

  if (!configured) {
    return res.status(200).json({ configured: false, note: "Amplify not configured — using gyms.json fallback" });
  }

  try {
    // Fetch one gym record raw (no toGym mapping) to see what fields DynamoDB actually returns
    const { data: gyms, errors } = await dataClient.models.Gym.list({ limit: 1 });
    const rawRecord = gyms?.[0] ?? null;

    return res.status(200).json({
      configured: true,
      errors: errors ?? null,
      sampleRecord: rawRecord,
      hasIsTest: rawRecord ? "isTest" in rawRecord : null,
      hasPriceVerified: rawRecord ? "priceVerified" in rawRecord : null,
      hasIsFeatured: rawRecord ? "isFeatured" in rawRecord : null,
    });
  } catch (err) {
    return res.status(500).json({ configured: true, error: String(err) });
  }
}
