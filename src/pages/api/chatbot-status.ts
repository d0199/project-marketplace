import type { NextApiRequest, NextApiResponse } from "next";
import { featureFlagStore } from "@/lib/featureFlags";

/**
 * Public endpoint — returns whether the chatbot should be shown right now.
 * Checks the chatbot feature flag + schedule (AEST timezone).
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const flags = await featureFlagStore.get();

    if (!flags.chatbot) {
      return res.json({ enabled: false });
    }

    // If no schedule, chatbot is always on when flag is true
    if (!flags.chatbotSchedule) {
      return res.json({ enabled: true });
    }

    // Parse schedule "HH:MM-HH:MM" in AEST
    const match = flags.chatbotSchedule.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
    if (!match) {
      // Invalid schedule format — treat as always on
      return res.json({ enabled: true });
    }

    const startMinutes = parseInt(match[1]) * 60 + parseInt(match[2]);
    const endMinutes = parseInt(match[3]) * 60 + parseInt(match[4]);

    // Get current time in AEST (UTC+10)
    const now = new Date();
    const aest = new Date(now.getTime() + 10 * 60 * 60 * 1000);
    const currentMinutes = aest.getUTCHours() * 60 + aest.getUTCMinutes();

    let enabled: boolean;
    if (startMinutes <= endMinutes) {
      // Normal range: e.g. 06:00-22:00
      enabled = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight range: e.g. 22:00-06:00
      enabled = currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }

    return res.json({ enabled });
  } catch {
    // On error, default to hidden (safe fallback)
    return res.json({ enabled: false });
  }
}
