import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "./ui/Card";

/** Progressive-disclosure drawer for secondary charts that don't earn a spot in
 * the primary hero row — collapsed by default, matching the mockup's "3 primary
 * cards, the rest behind More insights" move. Rendered identically on mobile and
 * desktop (no viewport branching) — same as every other section on the page. */
export function MoreInsights({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Card padding={false}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold" style={{ color: "var(--text-heading)" }}>
          More insights
        </span>
        <ChevronDown
          size={18}
          style={{ color: "var(--text-secondary)", transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }}
        />
      </button>
      {open && <div className="px-5 pb-5 flex flex-col gap-3">{children}</div>}
    </Card>
  );
}
