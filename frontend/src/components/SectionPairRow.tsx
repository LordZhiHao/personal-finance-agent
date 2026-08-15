import type { ReactNode } from "react";

/**
 * An 8/4-column desktop pair that collapses gracefully when one side is
 * hidden by the user's "Customize Dashboard" preference — the visible side
 * takes the full row instead of leaving an empty gap, and the row renders
 * nothing at all when both sides are hidden.
 */
export function SectionPairRow({
  left,
  leftVisible,
  right,
  rightVisible,
  className,
}: {
  left: ReactNode;
  leftVisible: boolean;
  right: ReactNode;
  rightVisible: boolean;
  className?: string;
}) {
  if (leftVisible && rightVisible) {
    return (
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${className ?? ""}`}>
        <div className="lg:col-span-8">{left}</div>
        <div className="lg:col-span-4">{right}</div>
      </div>
    );
  }
  if (leftVisible) return <>{left}</>;
  if (rightVisible) return <>{right}</>;
  return null;
}
