import { useEffect, useState, useCallback } from "react";
import { adminFetch } from "@/lib/adminFetch";

interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface ChatTranscript {
  id: string;
  sessionId: string;
  messages: TranscriptMessage[];
  messageCount: number;
  startedAt: string;
  lastMessageAt: string;
  userAgent: string;
  page: string;
}

export default function ChatTranscriptsTab() {
  const [transcripts, setTranscripts] = useState<ChatTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChatTranscript | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminFetch("/api/admin/chat-transcripts");
      setTranscripts(await r.json());
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    await adminFetch(`/api/admin/chat-transcripts?id=${id}`, { method: "DELETE" });
    setSelected(null);
    load();
  }

  if (loading) {
    return <p className="text-gray-500 py-8 text-center">Loading transcripts...</p>;
  }

  if (selected) {
    return (
      <div>
        <button onClick={() => setSelected(null)} className="text-sm text-brand-orange hover:underline mb-4">
          &larr; Back to all transcripts
        </button>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Conversation — {selected.messageCount} messages
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Started {new Date(selected.startedAt).toLocaleString("en-AU")}
                  {selected.page && <> on <span className="font-mono">{selected.page}</span></>}
                </p>
              </div>
              <button
                onClick={() => handleDelete(selected.id)}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="px-6 py-4 space-y-3 max-h-[600px] overflow-y-auto">
            {selected.messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-brand-orange text-white rounded-br-md"
                    : "bg-gray-100 text-gray-800 rounded-bl-md"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${
                      msg.role === "user" ? "text-white/70" : "text-brand-orange"
                    }`}>
                      {msg.role === "user" ? "Human" : "Bot"}
                    </span>
                    {msg.timestamp && (
                      <span className={`text-[10px] ${msg.role === "user" ? "text-white/50" : "text-gray-400"}`}>
                        {new Date(msg.timestamp).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer meta */}
          {selected.userAgent && (
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-[10px] text-gray-400 font-mono truncate">{selected.userAgent}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Chat Transcripts</h2>
          <p className="text-sm text-gray-500 mt-0.5">{transcripts.length} conversation{transcripts.length !== 1 ? "s" : ""} logged</p>
        </div>
      </div>

      {transcripts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium text-gray-500 mb-1">No chat transcripts yet</p>
          <p className="text-sm">Conversations will appear here once users interact with the chatbot.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-gray-600">
              <tr>
                <th className="py-2.5 px-4 font-medium">Started</th>
                <th className="py-2.5 px-4 font-medium">Messages</th>
                <th className="py-2.5 px-4 font-medium">Page</th>
                <th className="py-2.5 px-4 font-medium">First Message</th>
                <th className="py-2.5 px-4 font-medium w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transcripts.map((t) => {
                const firstUser = t.messages.find((m) => m.role === "user");
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-4 text-gray-600 whitespace-nowrap">
                      {new Date(t.startedAt).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-gray-900 font-medium">{t.messageCount}</span>
                        <span className="text-xs text-gray-400">
                          ({t.messages.filter((m) => m.role === "user").length} human / {t.messages.filter((m) => m.role === "assistant").length} bot)
                        </span>
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 font-mono text-xs truncate max-w-[150px]">
                      {t.page || "—"}
                    </td>
                    <td className="py-2.5 px-4 text-gray-600 truncate max-w-[250px]">
                      {firstUser?.content ?? "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      <button
                        onClick={() => setSelected(t)}
                        className="text-brand-orange hover:text-brand-orange-dark font-medium text-xs"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
