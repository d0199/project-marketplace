import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuth";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";
import { featureFlagStore } from "@/lib/featureFlags";

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

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

function extractAddressField(components: AddressComponent[], type: string): string {
  const comp = components.find((c) => c.types.includes(type));
  return comp?.long_name ?? "";
}

function extractAddressFieldShort(components: AddressComponent[], type: string): string {
  const comp = components.find((c) => c.types.includes(type));
  return comp?.short_name ?? "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  const flags = await featureFlagStore.get();
  if (!flags.googleApi) {
    return res.status(503).json({ error: "Google Places API is currently disabled" });
  }

  if (req.method !== "GET") return res.status(405).end();

  const { placeId } = req.query;
  if (!placeId || typeof placeId !== "string") {
    return res.status(400).json({ error: "placeId query param required" });
  }

  const apiKey = await getGoogleApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: "Google API key not configured" });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?${new URLSearchParams({
      place_id: placeId,
      key: apiKey,
      fields: "address_components,geometry,formatted_address",
    })}`;
    const gRes = await fetch(url);
    const data = await gRes.json();

    if (data.status === "OK" && data.result) {
      const components: AddressComponent[] = data.result.address_components ?? [];
      const streetNumber = extractAddressField(components, "street_number");
      const route = extractAddressField(components, "route");
      const street = [streetNumber, route].filter(Boolean).join(" ");
      const suburb = extractAddressField(components, "locality");
      const state = extractAddressFieldShort(components, "administrative_area_level_1");
      const postcode = extractAddressField(components, "postal_code");
      const lat = data.result.geometry?.location?.lat ?? null;
      const lng = data.result.geometry?.location?.lng ?? null;

      return res.json({
        street,
        suburb,
        state,
        postcode,
        lat,
        lng,
        formattedAddress: data.result.formatted_address ?? "",
      });
    }

    return res.status(404).json({ error: "Place not found" });
  } catch (err) {
    console.error("[places-detail] Google API error:", err);
    return res.status(500).json({ error: "Place detail lookup failed" });
  }
}
