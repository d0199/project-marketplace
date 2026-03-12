import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuth";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";
import { datasetStore } from "@/lib/datasetStore";
import { featureFlagStore } from "@/lib/featureFlags";

let anthropicKey = "";

async function getAnthropicKey(): Promise<string> {
  if (anthropicKey) return anthropicKey;

  if (process.env.ANTHROPIC_API_KEY) {
    anthropicKey = process.env.ANTHROPIC_API_KEY;
    return anthropicKey;
  }

  try {
    const appId = process.env.AMPLIFY_APP_ID ?? "d36uz2q25gygnh";
    const branch = process.env.AWS_BRANCH ?? "staging";
    const region = process.env.AWS_REGION ?? "ap-southeast-2";
    const client = new SSMClient({ region });
    const result = await client.send(
      new GetParametersCommand({
        Names: [
          `/amplify/shared/${appId}/ANTHROPIC_API_KEY`,
          `/amplify/${appId}/${branch}/ANTHROPIC_API_KEY`,
        ],
        WithDecryption: true,
      })
    );
    for (const param of result.Parameters ?? []) {
      if (param.Value) { anthropicKey = param.Value; break; }
    }
  } catch (err) {
    console.error("[scrape-profile] SSM fetch failed:", err);
  }

  return anthropicKey;
}

/** Strip HTML to a manageable plain-text representation */
function htmlToText(html: string): string {
  return html
    // Remove script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    // Preserve link hrefs
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    // Replace block elements with newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br\s*\/?)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Clean whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

/** Fetch current dataset lists for dynamic prompt building */
async function getDatasetEntries(name: string): Promise<string[]> {
  try {
    const ds = await datasetStore.getByName(name);
    return ds?.entries ?? [];
  } catch { return []; }
}

function buildGymPrompt(amenities: string[], specialties: string[]): string {
  const amenitiesList = amenities.length > 0 ? JSON.stringify(amenities) : '["24/7 Access", "Group Classes", "Personal Training", "Pool", "Sauna", "Showers", "Parking", "Childcare", "Cardio Equipment", "Free Weights", "Functional Training", "Boxing", "Yoga", "Pilates", "Spin/Cycle", "CrossFit", "HIIT", "Basketball Court", "Tennis Court", "Squash Court", "Martial Arts", "Climbing Wall", "Juice Bar", "Supplement Shop", "Towel Service", "WiFi", "Air Conditioning", "Women Only Area", "Outdoor Area", "Recovery/Ice Bath", "Physiotherapy", "Massage"]';
  const specialtiesHint = specialties.length > 0
    ? `array of specialties/programs — prefer entries from this list: ${JSON.stringify(specialties.slice(0, 40))}`
    : 'array of specialties/programs (e.g. "Hyrox", "F45", "Olympic Lifting", "Powerlifting", "Rehab", "Seniors Fitness")';

  return `You are analyzing a gym/fitness centre website. Extract as much useful profile information as possible from the page content.

Return a JSON object with ONLY the fields you can confidently extract. Omit any field you cannot find or are unsure about. Do NOT guess or make up data.

Fields to look for:
- "phone": phone number (Australian format preferred)
- "email": email address
- "website": the canonical website URL (if different from the one provided)
- "instagram": Instagram profile URL
- "facebook": Facebook page URL
- "bookingUrl": online booking URL (Mindbody, Glofox, etc.)
- "amenities": array of amenities from this list ONLY: ${amenitiesList}
- "specialties": ${specialtiesHint}
- "description": write an SEO-rich 100-200 word description of the gym based on the page content. Highlight key selling points, unique features, location, and target audience. Use a professional, engaging tone suitable for a gym listing directory. Do NOT copy text verbatim from the website — rewrite it in your own words
- "pricePerWeek": weekly membership price as a number (calculate from weekly/fortnightly/monthly if needed)
- "hours": object with keys monday-sunday, values as opening hours strings (e.g. "5:00am - 9:00pm")
- "memberOffers": array of member offer tags from this list ONLY: ["no contract", "contract", "new member trial", "referral scheme", "multiple location access", "gym or community app"]

Return ONLY valid JSON. No markdown, no explanation, no code blocks.`;
}

function buildPtPrompt(specialties: string[]): string {
  const specialtiesHint = specialties.length > 0
    ? `array of training specialties — prefer entries from this list: ${JSON.stringify(specialties.slice(0, 40))}`
    : 'array of training specialties (e.g. "Weight Loss", "Strength Training", "HIIT", "Boxing", "Yoga", "Pre/Post Natal", "Rehabilitation", "Sports Performance", "Bodybuilding", "Functional Training", "Hyrox", "CrossFit")';

  return `You are analyzing a personal trainer's website. Extract as much useful profile information as possible from the page content.

Return a JSON object with ONLY the fields you can confidently extract. Omit any field you cannot find or are unsure about. Do NOT guess or make up data.

Fields to look for:
- "phone": phone number (Australian format preferred)
- "email": email address
- "website": the canonical website URL (if different from the one provided)
- "instagram": Instagram profile URL
- "facebook": Facebook page URL
- "tiktok": TikTok profile URL
- "bookingUrl": online booking URL
- "specialties": ${specialtiesHint}
- "qualifications": array of qualifications/certifications found
- "description": a brief bio or about text
- "pricePerSession": per-session price as a number
- "sessionDuration": session duration in minutes as a number
- "availability": availability text (e.g. "Mon-Fri 6am-8pm")
- "languages": array of languages spoken
- "experienceYears": years of experience as a number

Return ONLY valid JSON. No markdown, no explanation, no code blocks.`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const flags = await featureFlagStore.get();
  if (!flags.claudeApi) {
    return res.status(503).json({ error: "AI features are currently disabled" });
  }

  const { url, type } = req.body as { url?: string; type?: "gym" | "pt" };

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!type || !["gym", "pt"].includes(type)) {
    return res.status(400).json({ error: "Type must be 'gym' or 'pt'" });
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  // Fetch the website
  let pageText: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; mynextgym.com.au bot; +https://www.mynextgym.com.au)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({ error: `Website returned ${response.status}` });
    }

    const html = await response.text();
    pageText = htmlToText(html);

    // Cap at ~8000 chars to stay within token limits
    if (pageText.length > 8000) {
      pageText = pageText.slice(0, 8000);
    }
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError"
      ? "Website took too long to respond (10s timeout)"
      : "Could not fetch website";
    return res.status(502).json({ error: message });
  }

  if (pageText.length < 50) {
    return res.status(422).json({ error: "Website returned very little content — it may require JavaScript to render." });
  }

  const key = await getAnthropicKey();
  if (!key) {
    return res.status(503).json({ error: "AI service not configured" });
  }

  try {
    // Build prompt with current dataset lists
    let systemPrompt: string;
    if (type === "gym") {
      const [amenities, specialties] = await Promise.all([
        getDatasetEntries("amenities"),
        getDatasetEntries("specialties"),
      ]);
      systemPrompt = buildGymPrompt(amenities, specialties);
    } else {
      const ptSpecialties = await getDatasetEntries("pt-specialties");
      systemPrompt = buildPtPrompt(ptSpecialties);
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `Website URL: ${parsedUrl.toString()}\n\nPage content:\n${pageText}`,
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[scrape-profile] Anthropic error:", response.status, err);
      return res.status(502).json({ error: "AI extraction failed" });
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text ?? "{}";

    // Parse the JSON response
    let extracted: Record<string, unknown>;
    try {
      // Strip any markdown code block wrapper the model might add
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      extracted = JSON.parse(cleaned);
    } catch {
      console.error("[scrape-profile] Failed to parse AI response:", raw);
      return res.status(502).json({ error: "AI returned invalid data" });
    }

    return res.status(200).json({ fields: extracted, sourceUrl: parsedUrl.toString() });
  } catch (err) {
    console.error("[scrape-profile] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
