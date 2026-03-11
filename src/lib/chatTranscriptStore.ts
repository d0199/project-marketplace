import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";

export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatTranscript {
  id: string;
  sessionId: string;
  messages: TranscriptMessage[];
  messageCount: number;
  startedAt: string;
  lastMessageAt: string;
  userAgent: string;
  page: string;
  createdAt?: string;
  updatedAt?: string;
}

type RawRecord = Record<string, unknown>;

function toTranscript(r: RawRecord): ChatTranscript {
  let messages: TranscriptMessage[] = [];
  try {
    messages = JSON.parse(String(r.messages ?? "[]"));
  } catch { /* */ }

  return {
    id: String(r.id ?? ""),
    sessionId: String(r.sessionId ?? ""),
    messages,
    messageCount: Number(r.messageCount ?? 0),
    startedAt: String(r.startedAt ?? ""),
    lastMessageAt: String(r.lastMessageAt ?? ""),
    userAgent: String(r.userAgent ?? ""),
    page: String(r.page ?? ""),
    createdAt: String(r.createdAt ?? ""),
    updatedAt: String(r.updatedAt ?? ""),
  };
}

export const chatTranscriptStore = {
  async save(
    sessionId: string,
    messages: TranscriptMessage[],
    meta: { userAgent?: string; page?: string }
  ): Promise<void> {
    if (!isAmplifyConfigured()) return;

    const now = new Date().toISOString();
    const messagesJson = JSON.stringify(messages);

    try {
      // Try to find existing transcript for this session
      const all = await this.getBySessionId(sessionId);
      if (all) {
        await dataClient.models.ChatTranscript.update({
          id: all.id,
          messages: messagesJson,
          messageCount: messages.length,
          lastMessageAt: now,
        });
      } else {
        await dataClient.models.ChatTranscript.create({
          sessionId,
          messages: messagesJson,
          messageCount: messages.length,
          startedAt: now,
          lastMessageAt: now,
          userAgent: meta.userAgent?.slice(0, 500) ?? "",
          page: meta.page?.slice(0, 200) ?? "",
        });
      }
    } catch (err) {
      console.error("[chatTranscript] Save failed:", err);
    }
  },

  async getBySessionId(sessionId: string): Promise<ChatTranscript | null> {
    if (!isAmplifyConfigured()) return null;
    try {
      const results: RawRecord[] = [];
      let nextToken: string | null | undefined;
      do {
        const res = await dataClient.models.ChatTranscript.list({ limit: 1000, nextToken });
        results.push(...(res.data ?? []));
        nextToken = res.nextToken;
      } while (nextToken);
      const match = results.find((r) => String(r.sessionId) === sessionId);
      return match ? toTranscript(match) : null;
    } catch {
      return null;
    }
  },

  async getAll(): Promise<ChatTranscript[]> {
    if (!isAmplifyConfigured()) return [];
    const results: RawRecord[] = [];
    let nextToken: string | null | undefined;
    do {
      const res = await dataClient.models.ChatTranscript.list({ limit: 1000, nextToken });
      results.push(...(res.data ?? []));
      nextToken = res.nextToken;
    } while (nextToken);
    return results.map(toTranscript).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  },

  async delete(id: string): Promise<void> {
    if (!isAmplifyConfigured()) return;
    await dataClient.models.ChatTranscript.delete({ id });
  },
};
