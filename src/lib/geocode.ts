/**
 * Client-side: call the server geocode API route.
 * Server-side: uses Google Geocoding API with key from SSM/env.
 */
export async function geocodeAddress(address: {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
}): Promise<{ lat: number; lng: number } | null> {
  const q = [address.street, address.suburb, address.state, address.postcode, "Australia"]
    .filter(Boolean)
    .join(", ");
  if (!q.trim()) return null;

  try {
    const res = await fetch("/api/admin/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: q }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.lat && data.lng) return { lat: data.lat, lng: data.lng };
    return null;
  } catch {
    return null;
  }
}
