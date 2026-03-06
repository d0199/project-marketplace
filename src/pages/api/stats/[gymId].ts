import type { NextApiRequest, NextApiResponse } from "next";
import { statsStore, type GymStats, type StatEvent } from "@/lib/statsStore";

const VALID_EVENTS: StatEvent[] = [
  "pageViews",
  "websiteClicks",
  "phoneClicks",
  "emailClicks",
  "bookingClicks",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GymStats | { error: string }>
) {
  const gymId = req.query.gymId as string;

  if (req.method === "GET") {
    return res.status(200).json(await statsStore.get(gymId));
  }

  if (req.method === "POST") {
    const { event } = req.body as { event: StatEvent };
    if (!VALID_EVENTS.includes(event)) {
      return res.status(400).json({ error: "Invalid event" });
    }
    await statsStore.record(gymId, event);
    return res.status(200).json(await statsStore.get(gymId));
  }

  return res.status(405).json({ error: "Method not allowed" });
}
