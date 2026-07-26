import type { ReactNode } from "react";

export function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--surface-1)", borderRadius: "var(--radius-card)", boxShadow: "var(--shadow-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
