import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuth";
import { datasetStore } from "@/lib/datasetStore";
import { featureFlagStore } from "@/lib/featureFlags";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

// Hardcoded icon names that already exist in AmenityIcon.tsx — skip these
const HARDCODED_AMENITY_ICONS = new Set([
  "pool", "spa", "sauna", "free weights", "cardio", "group classes",
  "boxing/mma", "yoga/pilates", "parking", "showers", "lockers",
  "childcare", "café", "24/7 access", "personal training",
]);

const HARDCODED_MEMBER_OFFER_ICONS = new Set([
  "no contract", "contract", "new member trial", "referral scheme",
  "multiple location access", "gym or community app", "casual classes",
]);

let anthropicKey = "";

async function getAnthropicKey(): Promise<string> {
  if (anthropicKey) return anthropicKey;
  if (process.env.ANTHROPIC_API_KEY) {
    anthropicKey = process.env.ANTHROPIC_API_KEY;
    return anthropicKey;
  }
  try {
    const appId = process.env.AMPLIFY_APP_ID ?? "d36uz2q25gygnh";
    const region = process.env.AWS_REGION ?? "ap-southeast-2";
    const client = new SSMClient({ region });
    const result = await client.send(
      new GetParametersCommand({
        Names: [
          `/amplify/shared/${appId}/ANTHROPIC_API_KEY`,
        ],
        WithDecryption: true,
      })
    );
    for (const param of result.Parameters ?? []) {
      if (param.Value) { anthropicKey = param.Value; break; }
    }
  } catch (err) {
    console.error("[generate-icons] SSM fetch failed:", err);
  }
  return anthropicKey;
}

const SVG_PROMPT = `You generate simple, clean SVG icons for a fitness/gym directory website.

Each icon must follow these EXACT specifications:
- viewBox="0 0 24 24"
- fill="none"
- stroke="currentColor"
- stroke-width="1.75"
- stroke-linecap="round"
- stroke-linejoin="round"
- Use only <svg>, <path>, <rect>, <circle>, <line>, <polyline>, <ellipse> elements
- Keep it simple — 2-5 elements max, like a typical Lucide/Feather icon
- No text elements, no gradients, no filters
- The icon should be recognisable at 16x16px

Return ONLY a JSON object mapping each entry name to its SVG markup string.
Example: {"pool": "<svg viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"1.75\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"><path d=\\"M3 16c1.5-2.5 3-2.5 4.5 0s3 2.5 4.5 0\\"/></svg>"}

No markdown, no explanation, no code blocks. ONLY valid JSON.`;

// ---------------------------------------------------------------------------
// SVG sanitiser — allowlist of elements and attributes
// ---------------------------------------------------------------------------
const ALLOWED_ELEMENTS = new Set([
  "svg", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "g",
]);

const ALLOWED_ATTRS = new Set([
  "viewbox", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry",
  "width", "height", "points", "transform", "opacity", "stroke-dasharray",
  "stroke-dashoffset", "fill-rule", "clip-rule", "none",
]);

function sanitizeSvg(raw: string): string | null {
  // Must start with <svg and end with </svg>
  const trimmed = raw.trim();
  if (!trimmed.startsWith("<svg") || !trimmed.endsWith("</svg>")) return null;

  // Strip any <script>, <style>, on* attributes, javascript: URLs, data: URLs
  let svg = trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\bon\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\bon\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:/gi, "");

  // Remove any elements not in allowlist
  svg = svg.replace(/<\/?([a-z][a-z0-9]*)\b/gi, (match, tag) => {
    return ALLOWED_ELEMENTS.has(tag.toLowerCase()) ? match : "";
  });

  // Remove any attributes not in allowlist (preserve element structure)
  svg = svg.replace(/<([a-z][a-z0-9]*)\s+([^>]*?)(\/?)\s*>/gi, (match, tag, attrs, selfClose) => {
    if (!ALLOWED_ELEMENTS.has(tag.toLowerCase())) return "";
    const cleanAttrs = (attrs as string)
      .match(/[a-z][a-z-]*\s*=\s*(?:"[^"]*"|'[^']*')/gi)
      ?.filter((attr) => {
        const name = attr.split("=")[0].trim().toLowerCase();
        return ALLOWED_ATTRS.has(name);
      })
      .join(" ") ?? "";
    return `<${tag}${cleanAttrs ? " " + cleanAttrs : ""}${selfClose ? "/" : ""}>`;
  });

  // Final check: must still be a valid-looking SVG
  if (!svg.includes("<svg") || !svg.includes("</svg>")) return null;

  return svg;
}

async function generateSvgIcons(entries: string[], key: string): Promise<Record<string, string>> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SVG_PROMPT,
      messages: [{
        role: "user",
        content: `Generate SVG icons for these fitness/gym related items:\n${JSON.stringify(entries)}`,
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[generate-icons] Anthropic error:", response.status, err);
    throw new Error("AI icon generation failed");
  }

  const data = await response.json();
  const raw = data.content?.[0]?.text ?? "{}";
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const flags = await featureFlagStore.get();
  if (!flags.claudeApi) {
    return res.status(503).json({ error: "AI features are currently disabled" });
  }

  const key = await getAnthropicKey();
  if (!key) return res.status(503).json({ error: "AI service not configured" });

  // Target datasets that use icons
  const iconDatasets = ["amenities", "member-offers", "pt-member-offers"];
  const hardcodedSets: Record<string, Set<string>> = {
    "amenities": HARDCODED_AMENITY_ICONS,
    "member-offers": HARDCODED_MEMBER_OFFER_ICONS,
    "pt-member-offers": HARDCODED_MEMBER_OFFER_ICONS,
  };

  const results: { dataset: string; generated: string[] }[] = [];

  for (const dsName of iconDatasets) {
    const ds = await datasetStore.getByName(dsName);
    if (!ds || ds.entries.length === 0) continue;

    const hardcoded = hardcodedSets[dsName] ?? new Set();
    const existingIcons = ds.icons ?? {};

    // Find entries missing icons (not hardcoded AND not already generated)
    const missing = ds.entries.filter(
      (e) => !hardcoded.has(e) && !existingIcons[e]
    );

    if (missing.length === 0) continue;

    try {
      const raw = await generateSvgIcons(missing, key);

      // Sanitise each generated SVG — reject any that fail
      const generated: Record<string, string> = {};
      for (const [name, svg] of Object.entries(raw)) {
        const clean = sanitizeSvg(svg);
        if (clean) {
          generated[name] = clean;
        } else {
          console.warn(`[generate-icons] Rejected unsafe SVG for "${name}"`);
        }
      }

      // Merge with existing dynamic icons
      const merged = { ...existingIcons, ...generated };

      // Save back to DynamoDB
      if (ds.id.startsWith("fallback-")) {
        // Promote to DynamoDB first
        const created = await datasetStore.create(ds.name, ds.entries);
        await datasetStore.updateIcons(created.id, merged);
      } else {
        await datasetStore.updateIcons(ds.id, merged);
      }

      results.push({ dataset: dsName, generated: Object.keys(generated) });
    } catch (err) {
      console.error(`[generate-icons] Failed for ${dsName}:`, err);
      results.push({ dataset: dsName, generated: [] });
    }
  }

  return res.status(200).json({ ok: true, results });
}
