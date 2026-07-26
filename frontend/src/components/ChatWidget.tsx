import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { useSendChatMessage } from "../hooks/api";

interface ChatMessage {
  role: "user" | "assistant" | "error";
  content: string;
}

const BUBBLE_STYLE: Record<ChatMessage["role"], React.CSSProperties> = {
  user: { background: "var(--field-bg)", color: "var(--text-primary)" },
  assistant: { background: "var(--brand-tint)", color: "var(--text-primary)" },
  error: { background: "var(--tint-red-bg)", color: "var(--tint-red-text)" },
};

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const mutation = useSendChatMessage();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, mutation.isPending]);

  function handleSend() {
    const text = draft.trim();
    if (!text || mutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setDraft("");
    mutation.mutate(text, {
      onSuccess: (data) => setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]),
      onError: () =>
        setMessages((prev) => [
          ...prev,
          { role: "error", content: "Something went wrong sending that — please try again." },
        ]),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div
          className="flex flex-col w-80 sm:w-96 h-[28rem] max-h-[70vh] overflow-hidden"
          style={{
            background: "var(--surface-1)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
              💬 Ask about your finances
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="text-lg leading-none"
              style={{ color: "var(--text-secondary)" }}
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Ask me anything about your spending, holdings, or balances.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap"
                  style={{ ...BUBBLE_STYLE[m.role], borderRadius: "var(--radius-control)" }}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {mutation.isPending && (
              <div className="flex justify-start">
                <div
                  className="max-w-[85%] px-3 py-2 text-sm"
                  style={{ ...BUBBLE_STYLE.assistant, borderRadius: "var(--radius-control)" }}
                >
                  Thinking…
                </div>
              </div>
            )}
          </div>

          <div className="flex items-end gap-2 px-3 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a question…"
              rows={1}
              className="flex-1 px-3 py-2 text-sm outline-none resize-none focus:border-[var(--brand)]"
              style={{
                background: "var(--field-bg)",
                color: "var(--text-primary)",
                border: "1px solid transparent",
                borderRadius: "var(--radius-control)",
                maxHeight: "5rem",
              }}
            />
            <Button variant="primary" onClick={handleSend} disabled={mutation.isPending || !draft.trim()}>
              Send
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close chat" : "Open chat"}
        className="flex items-center justify-center rounded-full text-xl hover:brightness-95 transition-colors"
        style={{
          width: 56,
          height: 56,
          background: "var(--brand)",
          color: "white",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {isOpen ? "✕" : "💬"}
      </button>
    </div>
  );
}
