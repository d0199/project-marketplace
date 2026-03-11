import type { NextApiRequest, NextApiResponse } from "next";
import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chatSystemPrompt";

let anthropicKey = "";

async function getAnthropicKey(): Promise<string> {
  if (anthropicKey) return anthropicKey;

  if (process.env.ANTHROPIC_API_KEY) {
    anthropicKey = process.env.ANTHROPIC_API_KEY;
    return anthropicKey;
  }

  const appId = process.env.AMPLIFY_APP_ID ?? "d36uz2q25gygnh";
  const branch = process.env.AWS_BRANCH ?? "master";
  const region = process.env.AWS_REGION ?? "ap-southeast-2";

  try {
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
      if (param.Value) {
        anthropicKey = param.Value;
        break;
      }
    }
  } catch (err) {
    console.error("[chat] SSM fetch failed:", err);
  }

  return anthropicKey;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages } = req.body as { messages?: unknown };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  // Validate and sanitize messages — only allow user/assistant roles, cap at 20
  const clean: ChatMessage[] = messages
    .filter(
      (m: unknown): m is ChatMessage =>
        typeof m === "object" &&
        m !== null &&
        "role" in m &&
        "content" in m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0
    )
    .slice(-20)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, 2000), // cap individual message length
    }));

  if (clean.length === 0 || clean[clean.length - 1].role !== "user") {
    return res.status(400).json({ error: "Last message must be from user" });
  }

  const key = await getAnthropicKey();
  if (!key) {
    return res.status(503).json({ error: "Chat service temporarily unavailable" });
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
        system: CHAT_SYSTEM_PROMPT,
        messages: clean,
      }),
    });

    if (!response.ok) {
      console.error("[chat] Anthropic API error:", response.status, await response.text());
      return res.status(502).json({ error: "Chat service error. Please try again." });
    }

    const data = await response.json();
    const reply = data?.content?.[0]?.text ?? "Sorry, I couldn't generate a response.";

    return res.json({ reply });
  } catch (err) {
    console.error("[chat] Request failed:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
