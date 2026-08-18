import type { ReactNode } from "react";

// Tailwind needs literal class strings to survive purge — this lookup keeps
// every span used across the app statically visible to the build, rather
// than interpolating `lg:col-span-${n}` (which purge can't see).
const COL_SPAN: Record<number, string> = {
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
};

/**
 * A desktop pair (8/4 columns by default, overridable via leftSpan/rightSpan)
 * that collapses gracefully when one side is hidden by the user's "Customize
 * Dashboard" preference — the visible side takes the full row instead of
 * leaving an empty gap, and the row renders nothing at all when both sides
 * are hidden.
 */
export function SectionPairRow({
  left,
  leftVisible,
  right,
  rightVisible,
  className,
  leftSpan = 8,
  rightSpan = 4,
}: {
  left: ReactNode;
  leftVisible: boolean;
  right: ReactNode;
  rightVisible: boolean;
  className?: string;
  leftSpan?: number;
  rightSpan?: number;
}) {
  if (leftVisible && rightVisible) {
    return (
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${className ?? ""}`}>
        <div className={COL_SPAN[leftSpan]}>{left}</div>
        <div className={COL_SPAN[rightSpan]}>{right}</div>
      </div>
    );
  }
  if (leftVisible) return <>{left}</>;
  if (rightVisible) return <>{right}</>;
  return null;
}
