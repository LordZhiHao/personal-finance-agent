import { X } from "lucide-react";
import { ChatPage } from "../pages/ChatPage";
import { FinnAvatar } from "./FinnAvatar";

/** Desktop slide-over that opens the existing Chat page's content in place,
 * without navigating away from whatever page you're on — see the mockup's
 * "Finn on desktop: three ways in" (sidebar button, Ctrl+Tab/Cmd+Tab, and the
 * full /chat page). Mobile doesn't get a dock: the floating Finn button (FinnFab)
 * just navigates to /chat instead, since a slide-over adds little value on a
 * screen that's already full-width. */
export function FinnDock({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="hidden md:block fixed inset-0 z-50" role="dialog" aria-label="Ask Finn">
      <div className="absolute inset-0" style={{ background: "rgba(17, 24, 39, 0.25)" }} onClick={onClose} />
      <div
        className="absolute top-4 right-4 bottom-4 flex flex-col overflow-hidden"
        style={{
          width: "min(480px, calc(100vw - 2rem))",
          background: "var(--surface-1)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="flex items-center justify-between gap-2 px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <FinnAvatar size={26} />
            <span className="font-semibold" style={{ color: "var(--text-heading)" }}>
              Finn
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center rounded-full hover:bg-black/[0.04]"
            style={{ width: 32, height: 32, color: "var(--text-secondary)" }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPage embedded />
        </div>
      </div>
    </div>
  );
}
