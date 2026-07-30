import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/Button";
import { useCommitUpload, useSendChatMessage, useUndoUpload, useUploadChatFile } from "../hooks/api";
import type { AccountCandidate, UploadSaved } from "../types";

interface ChatMessage {
  role: "user" | "assistant" | "error";
  content: string;
  upload?: UploadSaved & { undone?: boolean };
  accountChoice?: { data: Record<string, unknown>; candidates: AccountCandidate[]; resolved?: boolean };
}

const BUBBLE_STYLE: Record<ChatMessage["role"], React.CSSProperties> = {
  user: { background: "var(--field-bg)", color: "var(--text-primary)" },
  assistant: { background: "var(--brand-tint)", color: "var(--text-primary)" },
  error: { background: "var(--tint-red-bg)", color: "var(--tint-red-text)" },
};

const THINKING_PHRASES = [
  "Finn is crunching your numbers…",
  "Counting your coins…",
  "Peeking at the receipt…",
  "Almost there…",
];

// Textarea grows with content (WhatsApp-style) up to this height, then scrolls internally.
const MAX_TEXTAREA_HEIGHT = 128;

function FinnAvatar({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/logo-mark.png"
      alt="Finn"
      className="rounded-full shrink-0"
      style={{ width: size, height: size, background: "var(--brand-tint)" }}
    />
  );
}

function ThinkingIndicator() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-end gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="rounded-full animate-bounce"
            style={{
              width: 6,
              height: 6,
              background: "var(--brand)",
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {THINKING_PHRASES[phraseIndex]}
      </span>
    </div>
  );
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMutation = useSendChatMessage();
  const uploadMutation = useUploadChatFile();
  const commitMutation = useCommitUpload();
  const undoMutation = useUndoUpload();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sendMutation.isPending, uploadMutation.isPending]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [draft]);

  function handleSend() {
    const text = draft.trim();
    if (!text || sendMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setDraft("");
    sendMutation.mutate(text, {
      onSuccess: (data) => {
        if (data.needs_account_selection && data.data && data.candidates) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Which account should I log this to?",
              accountChoice: { data: data.data!, candidates: data.candidates! },
            },
          ]);
        } else if (data.summary != null) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.summary!,
              upload: {
                needs_account_selection: false,
                summary: data.summary!,
                lines: data.lines ?? [],
                transaction_ids: data.transaction_ids ?? [],
                portfolio_event_ids: data.portfolio_event_ids ?? [],
              },
            },
          ]);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "" }]);
        }
      },
      onError: () =>
        setMessages((prev) => [
          ...prev,
          { role: "error", content: "Something went wrong sending that — please try again." },
        ]),
    });
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessages((prev) => [...prev, { role: "user", content: `📎 ${file.name}` }]);
    uploadMutation.mutate(file, {
      onSuccess: (result) => {
        if (result.needs_account_selection) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Which account should I log this to?",
              accountChoice: { data: result.data, candidates: result.candidates },
            },
          ]);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: result.summary, upload: result }]);
        }
      },
      onError: () =>
        setMessages((prev) => [
          ...prev,
          { role: "error", content: "Couldn't parse that file — try again, or a clearer photo/PDF." },
        ]),
    });
  }

  function handleAccountChoice(index: number, accountId: string) {
    const msg = messages[index];
    if (!msg.accountChoice || msg.accountChoice.resolved) return;
    commitMutation.mutate(
      { data: msg.accountChoice.data, accountId },
      {
        onSuccess: (result) =>
          setMessages((prev) =>
            prev.map((m, i) =>
              i === index
                ? { ...m, content: result.summary, upload: result, accountChoice: { ...m.accountChoice!, resolved: true } }
                : m,
            ),
          ),
        onError: () =>
          setMessages((prev) => [
            ...prev,
            { role: "error", content: "Couldn't save that — please try again." },
          ]),
      },
    );
  }

  function handleUndo(index: number) {
    const msg = messages[index];
    if (!msg.upload || msg.upload.undone) return;
    undoMutation.mutate(
      { transactionIds: msg.upload.transaction_ids, portfolioEventIds: msg.upload.portfolio_event_ids },
      {
        onSuccess: () =>
          setMessages((prev) =>
            prev.map((m, i) => (i === index ? { ...m, upload: { ...m.upload!, undone: true } } : m)),
          ),
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isBusy = sendMutation.isPending || uploadMutation.isPending;

  return (
    <div className="flex flex-col h-[calc(100vh-4.75rem)] md:h-[calc(100vh-5.5rem)] -mx-3 md:-mx-4 -mt-3 md:-mt-4">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex items-start gap-2">
            <FinnAvatar />
            <p
              className="max-w-[85%] px-3 py-2 text-sm"
              style={{ ...BUBBLE_STYLE.assistant, borderRadius: "var(--radius-control)" }}
            >
              Hey, I'm Finn! Ask me anything about your spending, holdings, or balances — attach a
              receipt/screenshot to record it, or just type it, like "spent 12 on lunch", and I'll log it
              directly.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role !== "user" && <FinnAvatar />}
            <div
              className="max-w-[85%] px-3 py-2 text-sm whitespace-pre-wrap"
              style={{ ...BUBBLE_STYLE[m.role], borderRadius: "var(--radius-control)" }}
            >
              {m.content}
              {m.upload && m.upload.lines.length > 0 && (
                <div className="mt-1 text-xs space-y-0.5" style={{ color: "var(--text-secondary)" }}>
                  {m.upload.lines.map((line, li) => (
                    <div key={li}>{line}</div>
                  ))}
                </div>
              )}
              {m.upload && (
                <div className="mt-2">
                  {m.upload.undone ? (
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      ↩️ Undone
                    </span>
                  ) : (
                    <Button variant="ghost" onClick={() => handleUndo(i)} disabled={undoMutation.isPending}>
                      {undoMutation.isPending ? "Undoing…" : "↩️ Undo"}
                    </Button>
                  )}
                </div>
              )}
              {m.accountChoice && !m.accountChoice.resolved && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.accountChoice.candidates.map((a) => (
                    <Button
                      key={a.id}
                      variant="outline"
                      onClick={() => handleAccountChoice(i, a.id)}
                      disabled={commitMutation.isPending}
                    >
                      {a.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isBusy && (
          <div className="flex items-start gap-2">
            <FinnAvatar />
            <div
              className="max-w-[85%] px-3 py-2"
              style={{ ...BUBBLE_STYLE.assistant, borderRadius: "var(--radius-control)" }}
            >
              <ThinkingIndicator />
            </div>
          </div>
        )}
      </div>

      <div
        className="flex items-end gap-2 px-3 py-3 shrink-0"
        style={{ borderTop: "1px solid var(--border)", background: "var(--surface-1)" }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileSelected}
        />
        <Button
          variant="outline"
          onClick={handleAttachClick}
          disabled={isBusy}
          aria-label="Attach receipt or screenshot"
        >
          📎
        </Button>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question or log a transaction…"
          rows={1}
          className="flex-1 px-3 py-2 text-sm outline-none resize-none focus:border-[var(--brand)]"
          style={{
            background: "var(--field-bg)",
            color: "var(--text-primary)",
            border: "1px solid transparent",
            borderRadius: "var(--radius-control)",
            maxHeight: MAX_TEXTAREA_HEIGHT,
            overflowY: "auto",
          }}
        />
        <Button variant="primary" onClick={handleSend} disabled={isBusy || !draft.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
