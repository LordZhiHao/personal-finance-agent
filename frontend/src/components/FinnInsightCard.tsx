import type { ReactNode } from "react";
import { FinnAvatar } from "./FinnAvatar";
import { Button } from "./ui/Button";

export interface FinnInsightAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "outline" | "ghost";
  disabled?: boolean;
}

/** The "Finn noticed something" card — same gradient-tinted treatment on every
 * page it appears on (Overview, Spending, Investments), each page supplying its
 * own heuristic headline/body/actions. See CLAUDE.md's Finance Q&A Agent section
 * for the real persisted-nudge system this stands in for (deferred this phase —
 * this card is a client-side heuristic over already-fetched data, not a tool). */
export function FinnInsightCard({
  eyebrow = "Finn noticed something",
  subeyebrow,
  body,
  actions,
}: {
  eyebrow?: string;
  subeyebrow?: string;
  body: ReactNode;
  actions?: FinnInsightAction[];
}) {
  return (
    <div
      className="rounded-card p-5"
      style={{
        background: "linear-gradient(160deg, var(--surface-1) 0%, var(--brand-tint) 150%)",
        boxShadow: "var(--shadow-card)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <FinnAvatar size={32} />
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
            {eyebrow}
          </div>
          {subeyebrow && (
            <div className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
              {subeyebrow}
            </div>
          )}
        </div>
      </div>
      <div className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-primary)" }}>
        {body}
      </div>
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.label} variant={a.variant ?? "primary"} onClick={a.onClick} disabled={a.disabled}>
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
