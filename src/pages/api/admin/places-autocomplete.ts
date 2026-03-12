import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuth";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

let cachedKey: string | null = null;

async function getGoogleApiKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  // Try env first
  if (process.env.GOOGLE_PLACES_API_KEY) {
    cachedKey = process.env.GOOGLE_PLACES_API_KEY;
    return cachedKey;
  }

  // Fetch from SSM
  const appId = process.env.AMPLIFY_APP_ID ?? "d36uz2q25gygnh";
  const region = process.env.AWS_REGION ?? "ap-southeast-2";
  const client = new SSMClient({ region });
  try {
    const result = await client.send(
      new GetParametersCommand({
        Names: [`/amplify/shared/${appId}/GOOGLE_PLACES_API_KEY`],
        WithDecryption: true,
      })
    );
    cachedKey = result.Parameters?.[0]?.Value ?? "";
  } catch {
    cachedKey = "";
  }
  return cachedKey;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  if (req.method !== "GET") return res.status(405).end();

  const { input } = req.query;
  if (!input || typeof input !== "string") {
    return res.status(400).json({ error: "input query param required" });
  }

  const apiKey = await getGoogleApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: "Google API key not configured" });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${new URLSearchParams({
      input,
      key: apiKey,
      components: "country:au",
      types: "address",
    })}`;
    const gRes = await fetch(url);
    const data = await gRes.json();

    if (data.status === "OK" && data.predictions?.length > 0) {
      const predictions = data.predictions.map(
        (p: { place_id: string; description: string }) => ({
          placeId: p.place_id,
          description: p.description,
        })
      );
      return res.json({ predictions });
    }

    return res.json({ predictions: [] });
  } catch (err) {
    console.error("[places-autocomplete] Google API error:", err);
    return res.status(500).json({ error: "Autocomplete failed" });
  }
}
