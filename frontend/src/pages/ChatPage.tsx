import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui";
import { useAccounts, useSendChatMessage, useUndoUpload, useUploadChatFile } from "../hooks/api";
import type { UploadResult } from "../types";

interface ChatMessage {
  role: "user" | "assistant" | "error";
  content: string;
  upload?: UploadResult & { undone?: boolean };
}

const BUBBLE_STYLE: Record<ChatMessage["role"], React.CSSProperties> = {
  user: { background: "var(--field-bg)", color: "var(--text-primary)" },
  assistant: { background: "var(--brand-tint)", color: "var(--text-primary)" },
  error: { background: "var(--tint-red-bg)", color: "var(--tint-red-text)" },
};

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [accountId, setAccountId] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sendMutation = useSendChatMessage();
  const uploadMutation = useUploadChatFile();
  const undoMutation = useUndoUpload();
  const accountsQuery = useAccounts();
  const accounts = accountsQuery.data ?? [];

  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sendMutation.isPending, uploadMutation.isPending]);

  function handleSend() {
    const text = draft.trim();
    if (!text || sendMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setDraft("");
    sendMutation.mutate(text, {
      onSuccess: (data) => setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]),
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
    if (!file || !accountId) return;
    setMessages((prev) => [...prev, { role: "user", content: `📎 ${file.name}` }]);
    uploadMutation.mutate(
      { file, accountId },
      {
        onSuccess: (result) =>
          setMessages((prev) => [...prev, { role: "assistant", content: result.summary, upload: result }]),
        onError: () =>
          setMessages((prev) => [
            ...prev,
            { role: "error", content: "Couldn't parse that file — try again, or a clearer photo/PDF." },
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
    <div className="flex flex-col h-[calc(100vh-6.5rem)]">
      <h1 className="text-xl font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
        💬 Chat
      </h1>
      <div
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
        style={{
          background: "var(--surface-1)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Ask me anything about your spending, holdings, or balances — or attach a receipt/screenshot to
              record it directly.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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
              </div>
            </div>
          ))}
          {isBusy && (
            <div className="flex justify-start">
              <div
                className="max-w-[85%] px-3 py-2 text-sm"
                style={{ ...BUBBLE_STYLE.assistant, borderRadius: "var(--radius-control)" }}
              >
                {uploadMutation.isPending ? "Extracting…" : "Thinking…"}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 px-3 py-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          {accounts.length > 1 && (
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-48">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
          <div className="flex items-end gap-2">
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
              disabled={isBusy || !accountId}
              aria-label="Attach receipt or screenshot"
            >
              📎
            </Button>
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
            <Button variant="primary" onClick={handleSend} disabled={isBusy || !draft.trim()}>
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
