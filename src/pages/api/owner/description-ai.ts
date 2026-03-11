import type { NextApiRequest, NextApiResponse } from "next";
import { AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";
import { getCognitoAdmin, USER_POOL_ID } from "@/lib/cognitoAdmin";

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
    console.error("[description-ai] SSM fetch failed:", err);
  }

  return anthropicKey;
}

/**
 * Validate the request comes from an authenticated Cognito user.
 * Returns { email, isAdmin } on success, or sends 401 and returns null.
 */
async function requireAuth(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ email: string; isAdmin: boolean } | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization" });
    return null;
  }

  const token = auth.slice(7);
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    const username = payload.username ?? payload["cognito:username"] ?? payload.sub;
    if (!username) {
      res.status(401).json({ error: "Invalid token" });
      return null;
    }

    const cognito = getCognitoAdmin();
    const { UserAttributes = [] } = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: username })
    );
    const attrs = Object.fromEntries(
      UserAttributes.map((a) => [a.Name, a.Value])
    );

    const email = attrs.email ?? username;
    const isAdmin = attrs["custom:isAdmin"] === "true" || email.endsWith("@mynextgym.com.au");

    return { email, isAdmin };
  } catch (err) {
    console.error("[description-ai] auth failed:", err);
    res.status(401).json({ error: "Invalid or expired token" });
    return null;
  }
}

interface GymContext {
  name: string;
  suburb: string;
  postcode: string;
  state?: string;
  amenities: string[];
  specialties?: string[];
  memberOffers?: string[];
  pricePerWeek?: number;
  website?: string;
  description?: string;
  hours?: Record<string, string>;
}

interface PTContext {
  name: string;
  suburb: string;
  postcode: string;
  state?: string;
  specialties: string[];
  qualifications: string[];
  experienceYears?: number;
  languages?: string[];
  memberOffers?: string[];
  pricePerSession?: number;
  sessionDuration?: number;
  availability?: string;
  website?: string;
  description?: string;
  gender?: string;
}

function buildGymPrompt(ctx: GymContext): string {
  const parts: string[] = [
    `Gym name: ${ctx.name}`,
    `Location: ${ctx.suburb}, ${ctx.postcode}${ctx.state ? ` ${ctx.state}` : ""}`,
  ];
  if (ctx.amenities.length) parts.push(`Amenities: ${ctx.amenities.join(", ")}`);
  if (ctx.specialties?.length) parts.push(`Specialties: ${ctx.specialties.join(", ")}`);
  if (ctx.memberOffers?.length) parts.push(`Member offers: ${ctx.memberOffers.join(", ")}`);
  if (ctx.pricePerWeek) parts.push(`Price: $${ctx.pricePerWeek}/week`);
  if (ctx.website) parts.push(`Website: ${ctx.website}`);
  if (ctx.hours) {
    const h = Object.entries(ctx.hours).filter(([, v]) => v).map(([d, v]) => `${d}: ${v}`).join(", ");
    if (h) parts.push(`Hours: ${h}`);
  }
  if (ctx.description) parts.push(`Existing description (rewrite/improve): ${ctx.description}`);

  return `Write a compelling, SEO-optimized description for this gym listing on mynextgym.com.au. The description should be 100–200 words, written in plain text (no HTML, no markdown, no headings). Use Australian English spelling.

Emphasise the gym's amenities, location, and what makes it stand out. Naturally include the suburb name for local SEO. The tone should be professional but approachable — as if the gym owner is talking to a potential member.

Do NOT include the gym name at the start (it's already shown as the page title). Do NOT use bullet points or lists. Write flowing paragraphs only. Return only the description text, nothing else.

Profile details:
${parts.join("\n")}`;
}

function buildPTPrompt(ctx: PTContext): string {
  const parts: string[] = [
    `Name: ${ctx.name}`,
    `Location: ${ctx.suburb}, ${ctx.postcode}${ctx.state ? ` ${ctx.state}` : ""}`,
  ];
  if (ctx.gender && ctx.gender !== "Not specified") parts.push(`Gender: ${ctx.gender}`);
  if (ctx.specialties.length) parts.push(`Specialties: ${ctx.specialties.join(", ")}`);
  if (ctx.qualifications.length) parts.push(`Qualifications: ${ctx.qualifications.join(", ")}`);
  if (ctx.experienceYears) parts.push(`Experience: ${ctx.experienceYears} years`);
  if (ctx.languages?.length) parts.push(`Languages: ${ctx.languages.join(", ")}`);
  if (ctx.memberOffers?.length) parts.push(`Member offers: ${ctx.memberOffers.join(", ")}`);
  if (ctx.pricePerSession) parts.push(`Price: $${ctx.pricePerSession}/session${ctx.sessionDuration ? ` (${ctx.sessionDuration} mins)` : ""}`);
  if (ctx.availability) parts.push(`Availability: ${ctx.availability}`);
  if (ctx.website) parts.push(`Website: ${ctx.website}`);
  if (ctx.description) parts.push(`Existing description (rewrite/improve): ${ctx.description}`);

  return `Write a compelling, SEO-optimized description for this personal trainer listing on mynextgym.com.au. The description should be 100–200 words, written in plain text (no HTML, no markdown, no headings). Use Australian English spelling.

Emphasise their specialties, qualifications, and experience. Naturally include the suburb name for local SEO. The tone should be professional and confident — written in third person as if the directory is introducing the trainer to a potential client.

Do NOT include the trainer's name at the start (it's already shown as the page title). Do NOT use bullet points or lists. Write flowing paragraphs only. Return only the description text, nothing else.

Profile details:
${parts.join("\n")}`;
}

const SYSTEM_PROMPT = `You are an SEO content specialist for mynextgym.com.au, an Australian gym and personal trainer directory. You write engaging descriptions that rank well on Google while being genuinely helpful. Use Australian English spelling. Keep content natural — avoid keyword stuffing.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const user = await requireAuth(req, res);
  if (!user) return;

  const { type, context } = req.body as { type: "gym" | "pt"; context: GymContext | PTContext };

  if (!type || !["gym", "pt"].includes(type)) {
    return res.status(400).json({ error: "Invalid type — must be 'gym' or 'pt'" });
  }

  if (!context) {
    return res.status(400).json({ error: "Context is required" });
  }

  const prompt = type === "gym"
    ? buildGymPrompt(context as GymContext)
    : buildPTPrompt(context as PTContext);

  const key = await getAnthropicKey();
  if (!key) {
    return res.status(503).json({ error: "AI service not configured" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[description-ai] Anthropic error:", response.status, err);
      let detail = "AI request failed";
      try { detail = JSON.parse(err)?.error?.message || detail; } catch { /* use default */ }
      return res.status(502).json({ error: detail });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    return res.status(200).json({ result: text.trim() });
  } catch (err) {
    console.error("[description-ai] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
