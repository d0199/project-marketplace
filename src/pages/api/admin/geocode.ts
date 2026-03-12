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

  if (req.method !== "POST") return res.status(405).end();

  const { address } = req.body;
  if (!address || typeof address !== "string") {
    return res.status(400).json({ error: "address required" });
  }

  const apiKey = await getGoogleApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: "Google API key not configured" });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?${new URLSearchParams({
      address,
      key: apiKey,
      region: "au",
    })}`;
    const gRes = await fetch(url);
    const data = await gRes.json();

    if (data.status === "OK" && data.results?.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      return res.json({ lat, lng, formattedAddress: data.results[0].formatted_address });
    }

    return res.json({ lat: null, lng: null });
  } catch (err) {
    console.error("[geocode] Google API error:", err);
    return res.status(500).json({ error: "Geocoding failed" });
  }
}
