import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { ArrowUp, Camera, MessageCircleQuestion, Paperclip, Send } from "lucide-react";
import { Button } from "../components/ui/Button";
import { FinnAvatar } from "../components/FinnAvatar";
import { useCyclingPhrase } from "../hooks/useCyclingPhrase";
import { useCommitUpload, useSendChatMessage, useUndoUpload, useUploadChatFile } from "../hooks/api";
import type { AccountCandidate, UploadSaved } from "../types";

interface ChatMessage {
  role: "user" | "assistant" | "error";
  content: string;
  timestamp: string;
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
const MAX_TEXTAREA_HEIGHT = 200;

function now(): string {
  return format(new Date(), "h:mm a");
}

function ThinkingIndicator() {
  const phrase = useCyclingPhrase(THINKING_PHRASES);

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
        {phrase}
      </span>
    </div>
  );
}

interface StarterChip {
  code: string;
  label: string;
  hint: string;
  bg: string;
  fg: string;
}

const STARTER_CHIPS: StarterChip[] = [
  { code: "TXT", label: "Spent 12 on lunch, DBS", hint: "Plain words, logged in a second", bg: "var(--tint-green-bg)", fg: "var(--tint-green-text)" },
  { code: "IMG", label: "Snap a receipt or bank screenshot", hint: "I read the lines and split them", bg: "var(--brand-tint)", fg: "var(--brand-hover)" },
  { code: "ASK", label: "How much did I spend on transport in July?", hint: "Answers straight from your data", bg: "var(--tint-amber-bg)", fg: "var(--tint-amber-text)" },
  { code: "TG", label: "Forward from Telegram", hint: "Same Finn, inside your chats", bg: "var(--tint-neutral-bg)", fg: "var(--tint-neutral-text)" },
];

/** `embedded` renders inside the desktop Finn dock overlay (FinnDock) instead of
 * as a full routed page — same content and logic, just sized to fill its parent
 * rather than the app's `<main>` (see the negative-margin height calc below,
 * which exists only to cancel `main`'s own padding on the full-page route). */
export function ChatPage({ embedded = false }: { embedded?: boolean } = {}) {
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
    setMessages((prev) => [...prev, { role: "user", content: text, timestamp: now() }]);
    setDraft("");
    sendMutation.mutate(text, {
      onSuccess: (data) => {
        if (data.needs_account_selection && data.data && data.candidates) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Which account should I log this to?",
              timestamp: now(),
              accountChoice: { data: data.data!, candidates: data.candidates! },
            },
          ]);
        } else if (data.summary != null) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: data.summary!,
              timestamp: now(),
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
          setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "", timestamp: now() }]);
        }
      },
      onError: () =>
        setMessages((prev) => [
          ...prev,
          { role: "error", content: "Something went wrong sending that — please try again.", timestamp: now() },
        ]),
    });
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  function handleStarterChip(chip: StarterChip) {
    if (chip.code === "IMG") {
      handleAttachClick();
      return;
    }
    if (chip.code === "TG") {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "You can also message me directly on Telegram — link your account from Settings, then chat with me there any time.",
          timestamp: now(),
        },
      ]);
      return;
    }
    setDraft(chip.label);
    textareaRef.current?.focus();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessages((prev) => [...prev, { role: "user", content: `📎 ${file.name}`, timestamp: now() }]);
    uploadMutation.mutate(file, {
      onSuccess: (result) => {
        if (result.needs_account_selection) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "Which account should I log this to?",
              timestamp: now(),
              accountChoice: { data: result.data, candidates: result.candidates },
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.summary, timestamp: now(), upload: result },
          ]);
        }
      },
      onError: () =>
        setMessages((prev) => [
          ...prev,
          { role: "error", content: "Couldn't parse that file — try again, or a clearer photo/PDF.", timestamp: now() },
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
            { role: "error", content: "Couldn't save that — please try again.", timestamp: now() },
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
  const isEmpty = messages.length === 0;
  const pageHeightClass = embedded
    ? "h-full"
    : "h-[calc(100vh-11.75rem)] md:h-[calc(100vh-5.5rem)] -mx-3 md:-mx-4 -mt-3 md:-mt-4 -mb-28 md:-mb-4";

  const inputBar = (
    <div
      className="flex items-end gap-1 px-2 py-3 mx-auto w-full max-w-2xl"
      style={{
        background: "rgba(255, 255, 255, 0.55)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.6)",
        borderRadius: 28,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleFileSelected}
      />
      <button
        type="button"
        onClick={handleAttachClick}
        disabled={isBusy}
        aria-label="Attach receipt or screenshot"
        className="flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/[0.04]"
        style={{ width: 36, height: 36, borderRadius: 9999, color: "var(--text-secondary)" }}
      >
        <Paperclip size={18} />
      </button>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message Finn…"
        rows={1}
        className="flex-1 px-2 py-1.5 text-base md:text-sm outline-none resize-none bg-transparent placeholder:text-[var(--brand-hover)] placeholder:opacity-80"
        style={{
          color: "var(--text-primary)",
          minHeight: 72,
          maxHeight: MAX_TEXTAREA_HEIGHT,
          overflowY: "auto",
        }}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={isBusy || !draft.trim()}
        aria-label="Send message"
        className="flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95"
        style={{ width: 36, height: 36, borderRadius: 9999, background: "var(--brand)", color: "white" }}
      >
        <ArrowUp size={18} />
      </button>
    </div>
  );

  if (isEmpty) {
    return (
      <div className={`flex flex-col ${pageHeightClass} items-center justify-center px-4 gap-6`}>
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <FinnAvatar size={56} />
          <h2 className="text-2xl font-semibold" style={{ color: "var(--text-heading)" }}>
            Hey, I'm Finn 👋
          </h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Ask me anything about your spending, holdings, or balances — attach a receipt/screenshot to
            record it, or just type it, like "spent 12 on lunch", and I'll log it directly.
          </p>
        </div>
        <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {STARTER_CHIPS.map((chip) => (
            <button
              key={chip.code}
              type="button"
              onClick={() => handleStarterChip(chip)}
              className="flex items-start gap-3 text-left px-3.5 py-3 rounded-2xl transition-colors hover:brightness-95"
              style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-card)" }}
            >
              <span
                className="shrink-0 flex items-center justify-center rounded-xl"
                style={{ width: 34, height: 34, background: chip.bg, color: chip.fg }}
              >
                {chip.code === "IMG" ? <Camera size={16} /> : chip.code === "ASK" ? <MessageCircleQuestion size={16} /> : chip.code === "TG" ? <Send size={16} /> : <ArrowUp size={16} />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {chip.label}
                </span>
                <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {chip.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="w-full max-w-2xl">{inputBar}</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${pageHeightClass}`}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mx-auto w-full max-w-2xl space-y-2">
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
                <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {m.timestamp}
                </div>
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
      </div>

      <div className="px-3 pb-8 md:pb-3 pt-2 shrink-0">{inputBar}</div>
    </div>
  );
}
