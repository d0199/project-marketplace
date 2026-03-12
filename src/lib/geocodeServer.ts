import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

let cachedKey: string | null = null;

async function getGoogleApiKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  if (process.env.GOOGLE_PLACES_API_KEY) {
    cachedKey = process.env.GOOGLE_PLACES_API_KEY;
    return cachedKey;
  }
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

/** Server-side geocode: resolve address to lat/lng via Google Geocoding API */
export async function geocodeAddressServer(address: {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
}): Promise<{ lat: number; lng: number } | null> {
  const q = [address.street, address.suburb, address.state, address.postcode, "Australia"]
    .filter(Boolean)
    .join(", ");
  if (!q.trim()) return null;

  const apiKey = await getGoogleApiKey();
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?${new URLSearchParams({
      address: q,
      key: apiKey,
      region: "au",
    })}`;
    const gRes = await fetch(url);
    const data = await gRes.json();
    if (data.status === "OK" && data.results?.length > 0) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }
    return null;
  } catch {
    return null;
  }
}
