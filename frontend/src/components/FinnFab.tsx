import { NavLink } from "react-router-dom";
import { FinnAvatar } from "./FinnAvatar";

/** Mobile floating Finn button, reachable from every screen — replaces Finn's old
 * spot as a co-equal bottom-nav tab (see the mockup's "sidebar rail on desktop,
 * 4-tab bar + Finn floating pill on mobile" move). Navigates straight to the full
 * /chat page rather than opening a dock overlay — unlike desktop's FinnDock, a
 * slide-over adds little value on a screen that's already full-width. Hidden on
 * /chat itself, since you're already there. Pinned bottom-LEFT (not the mockup's
 * bottom-right) because Spending/Investments already put their own "Add" Fab at
 * bottom-right — this avoids the two floating buttons overlapping on mobile. */
export function FinnFab() {
  return (
    <NavLink
      to="/chat"
      aria-label="Ask Finn"
      className={({ isActive }) =>
        `md:hidden fixed z-40 flex items-center justify-center rounded-full transition-transform ${isActive ? "hidden" : ""}`
      }
      style={{
        left: "1.25rem",
        bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
        width: "3.5rem",
        height: "3.5rem",
        background: "var(--brand)",
        boxShadow: "0 12px 28px rgba(17, 24, 39, 0.26)",
      }}
    >
      <FinnAvatar size={32} />
    </NavLink>
  );
}
