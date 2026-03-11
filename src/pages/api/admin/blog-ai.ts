import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdmin } from "@/lib/adminAuth";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

let anthropicKey = "";

async function getAnthropicKey(): Promise<string> {
  if (anthropicKey) return anthropicKey;

  // Try process.env first (dev / .env.production)
  if (process.env.ANTHROPIC_API_KEY) {
    anthropicKey = process.env.ANTHROPIC_API_KEY;
    return anthropicKey;
  }

  // SSM fetch for Lambda runtime — try shared path first, then branch-specific
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
    console.error("[blog-ai] SSM fetch failed:", err);
  }

  return anthropicKey;
}

type AiAction = "title" | "excerpt" | "content" | "tags" | "seo";

const SYSTEM_PROMPT = `You are an SEO content specialist for mynextgym.com.au, an Australian gym and personal trainer directory. Your goal is to write engaging, SEO-optimized content that ranks well on Google while being genuinely helpful to readers. Use Australian English spelling. Keep content natural — avoid keyword stuffing.`;

const ACTION_PROMPTS: Record<AiAction, (ctx: string) => string> = {
  title: (ctx) =>
    `Generate 3 SEO-optimized blog post title options for the following topic/content. Each title should be under 60 characters, include relevant keywords naturally, and be compelling to click. Return only the 3 titles, one per line, numbered.\n\nContext:\n${ctx}`,

  excerpt: (ctx) =>
    `Write a compelling meta description / excerpt for this blog post. It must be between 120-155 characters, include the primary keyword naturally, and entice clicks from search results. Return only the excerpt text, nothing else.\n\nPost content:\n${ctx}`,

  content: (ctx) =>
    `Write or expand the blog post section below. Use proper HTML formatting with <h2>, <h3>, <p>, <ul>/<li>, <strong>, and <em> tags. Make it SEO-rich with natural keyword usage, helpful subheadings, and actionable advice. Aim for 300-500 words. Do NOT wrap in a code block — return raw HTML only.\n\nTopic/instructions:\n${ctx}`,

  tags: (ctx) =>
    `Suggest 5-8 relevant tags for this blog post. Tags should be lowercase, 1-3 words each, relevant to gym/fitness/personal training audiences searching on Google. Return them as a JSON array of strings, e.g. ["tag one", "tag two"]. Nothing else.\n\nPost content:\n${ctx}`,

  seo: (ctx) =>
    `Generate an SEO-optimized title and meta description for this blog post.\n- Title: under 60 characters, includes primary keyword\n- Description: 120-155 characters, compelling for search results\n\nReturn as JSON: {"seoTitle": "...", "seoDescription": "..."}\n\nPost content:\n${ctx}`,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const adminEmail = await requireAdmin(req, res);
  if (!adminEmail) return;

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, context } = req.body as { action: AiAction; context: string };

  if (!action || !ACTION_PROMPTS[action]) {
    return res.status(400).json({ error: "Invalid action" });
  }

  if (!context?.trim()) {
    return res.status(400).json({ error: "Context is required" });
  }

  const key = await getAnthropicKey();
  if (!key) {
    return res.status(503).json({ error: "Anthropic API key not configured. Add ANTHROPIC_API_KEY to SSM or .env" });
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
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: ACTION_PROMPTS[action](context.slice(0, 4000)) }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[blog-ai] Anthropic error:", response.status, err);
      // Surface actual error to admin for debugging
      let detail = "AI request failed";
      try { detail = JSON.parse(err)?.error?.message || detail; } catch { /* use default */ }
      return res.status(502).json({ error: detail });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    return res.status(200).json({ result: text });
  } catch (err) {
    console.error("[blog-ai] Error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
