import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/router";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GREETING =
  "G'day! I'm the mynextgym.com.au AI Assistant. I can help you find gyms, understand our platform, or answer questions about listing your business. What can I help with?";

const STORAGE_KEY = "mng-chat";

interface StoredChat {
  sessionId: string;
  messages: Message[];
  isOpen: boolean;
}

function loadChat(): StoredChat | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveChat(data: StoredChat) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — ignore */ }
}

function generateSessionId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatWidget() {
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  // Restore from sessionStorage on mount
  const stored = useRef(loadChat());
  const [isOpen, setIsOpen] = useState(stored.current?.isOpen ?? false);
  const [messages, setMessages] = useState<Message[]>(
    stored.current?.messages ?? [{ role: "assistant", content: GREETING }]
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef(stored.current?.sessionId ?? generateSessionId());

  // Persist chat state to sessionStorage on every change
  useEffect(() => {
    saveChat({
      sessionId: sessionIdRef.current,
      messages,
      isOpen,
    });
  }, [messages, isOpen]);

  // Check feature flag on mount and every 5 minutes (for schedule changes)
  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const res = await fetch("/api/chatbot-status");
        const data = await res.json();
        if (mounted) setEnabled(data.enabled === true);
      } catch {
        if (mounted) setEnabled(false);
      }
    }
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // Intercept clicks on internal links inside chat messages
  const handleMessageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (href && href.startsWith("/")) {
      e.preventDefault();
      router.push(href);
    }
  }, [router]);

  // Don't render anything until flag is checked, or if disabled
  if (enabled !== true) return null;

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);

    try {
      const apiMessages = updated.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          sessionId: sessionIdRef.current,
          page: window.location.pathname,
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || "Sorry, something went wrong. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  // Render markdown-lite: bold, links, line breaks
  function formatMessage(text: string) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[(.+?)\]\((.+?)\)/g, (_m, label, href) => {
        const isInternal = href.startsWith("/");
        return `<a href="${href}" class="underline text-brand-orange font-medium"${isInternal ? "" : ' target="_blank" rel="noopener noreferrer"'}>${label}</a>`;
      })
      .replace(/\n/g, "<br/>");
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-brand-orange hover:bg-brand-orange-dark shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label="Open chat assistant"
      >
        <span className="text-white text-xs font-bold tracking-tight">MNG</span>
      </button>
    );
  }

  return (
    <div
      className="fixed z-50 bottom-0 right-0 w-full h-full sm:bottom-6 sm:right-6 sm:w-[380px] sm:h-[520px] flex flex-col bg-white sm:rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
      role="dialog"
      aria-label="Chat assistant"
    >
      {/* Header */}
      <div className="bg-brand-orange px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">MNG</span>
          </div>
          <div>
            <h2 className="text-white text-sm font-semibold leading-tight">AI Assistant</h2>
            <p className="text-white/70 text-[10px]">Powered by AI</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white/80 hover:text-white p-1 transition-colors"
          aria-label="Close chat"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 shrink-0">
        <p className="text-[10px] text-amber-700 text-center">
          AI-powered responses — may not always be accurate. Not a substitute for professional advice.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50" onClick={handleMessageClick}>
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-brand-orange text-white rounded-br-md"
                  : "bg-white text-gray-800 border border-gray-200 rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" && (
                <span className="inline-block text-[9px] font-semibold text-brand-orange bg-orange-50 px-1.5 py-0.5 rounded-full mb-1.5 uppercase tracking-wide">
                  AI
                </span>
              )}
              <div
                dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
              />
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-3 py-3 shrink-0 pb-safe">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask a question..."
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 focus:border-brand-orange"
            disabled={isLoading}
            maxLength={500}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="w-9 h-9 rounded-full bg-brand-orange hover:bg-brand-orange-dark disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
            aria-label="Send message"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3 3l18 9-18 9 3-9zm0 0h9" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
