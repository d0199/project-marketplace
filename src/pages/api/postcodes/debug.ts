import type { NextApiRequest, NextApiResponse } from "next";
import { postcodeStore } from "@/lib/postcodeStore";
import { isAmplifyConfigured } from "@/lib/amplifyServerConfig";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const postcode = String(req.query.postcode ?? "6069");

  const amplifyOk = isAmplifyConfigured();
  let coords: [number, number] | null = null;
  let suburbMap: Record<string, string> = {};
  let cacheSize = 0;
  let error: string | null = null;

  try {
    coords = await postcodeStore.getCoords(postcode);
    const allCoords = await postcodeStore.getAllCoords();
    cacheSize = Object.keys(allCoords).length;
    const sm = await postcodeStore.getSuburbMap();
    // Only return a few entries for debugging
    const sample: Record<string, string> = {};
    let i = 0;
    for (const [k, v] of Object.entries(sm)) {
      sample[k] = v;
      if (++i >= 5) break;
    }
    suburbMap = sample;
  } catch (err) {
    error = String(err);
  }

  res.status(200).json({
    amplifyConfigured: amplifyOk,
    postcode,
    coords,
    cacheSize,
    suburbMapSample: suburbMap,
    error,
  });
}
