import { NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import { Bot, PieChart, Receipt, type LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useScrollDirection } from "../hooks/useScrollDirection";
import { Button } from "./ui/Button";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** "chat" gets permanent brand-colored, larger styling so Finn stands out from the rest. */
  variant?: "chat";
}

const NAV_ITEMS: NavItem[] = [
  { to: "/spending", label: "Spending", icon: Receipt },
  { to: "/chat", label: "Finn", icon: Bot, variant: "chat" },
  { to: "/investments", label: "Investments", icon: PieChart },
];

/** Mobile bottom-nav icon: every item (including Finn) is tinted only while active, no permanent fill. */
function NavIconLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const isChat = item.variant === "chat";
  const size = isChat ? 56 : 48;
  return (
    <NavLink
      to={item.to}
      aria-label={item.label}
      title={item.label}
      className="relative flex items-center justify-center shrink-0 transition-colors"
      style={({ isActive }) => ({
        width: size,
        height: size,
        borderRadius: "var(--radius-control)",
        background: isActive ? "var(--brand-tint)" : "transparent",
        color: isActive ? "var(--brand)" : "var(--text-secondary)",
      })}
    >
      {({ isActive }) => <Icon size={isChat ? 28 : 24} strokeWidth={isActive ? 2.25 : 2} />}
    </NavLink>
  );
}

/** Desktop nav capsule item: icon + label, generous padding; every item (including Finn) is tinted only while active. */
function DesktopNavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const isChat = item.variant === "chat";
  return (
    <NavLink
      to={item.to}
      aria-label={item.label}
      className="relative flex items-center gap-2.5 shrink-0 font-medium text-sm transition-colors"
      style={({ isActive }) => ({
        padding: isChat ? "0.9rem 1.85rem" : "0.9rem 1.5rem",
        borderRadius: "var(--radius-control)",
        background: isActive ? "var(--brand-tint)" : "transparent",
        color: isActive ? "var(--brand)" : "var(--text-secondary)",
      })}
    >
      {({ isActive }) => (
        <>
          <Icon size={isChat ? 26 : 22} strokeWidth={isActive ? 2.25 : 2} />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

/** Swaps the FinanceKu wordmark for the Finn chat-buddy branding while on /chat. */
function BrandMark({ isChatPage, imgClassName }: { isChatPage: boolean; imgClassName: string }) {
  if (isChatPage) {
    return (
      <>
        <img
          src="/logo-mark.png"
          alt="Finn"
          className={clsx(imgClassName, "rounded-full")}
          style={{ background: "var(--brand-tint)" }}
        />
        <span style={{ color: "var(--text-heading)" }}>Finn</span>
      </>
    );
  }
  return (
    <>
      <img src="/logo-mark.png" alt="" className={imgClassName} />
      <span style={{ color: "var(--text-heading)" }}>
        Finance<span style={{ color: "var(--brand)" }}>Ku</span>
      </span>
    </>
  );
}

export function Layout() {
  const { logout, email } = useAuth();
  const initial = email ? email.trim()[0]?.toUpperCase() : "?";
  const scrollingDown = useScrollDirection();
  const isChatPage = useLocation().pathname === "/chat";

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      {/* Desktop: three floating capsules — logo, centered nav, account cluster */}
      <div
        className="hidden md:grid sticky top-4 z-40 items-center px-4 md:px-6"
        style={{ gridTemplateColumns: "1fr auto 1fr", columnGap: "1rem" }}
      >
        <div className="flex items-center">
          <h1
            className="flex items-center gap-2 text-base font-semibold px-4 py-2"
            style={{
              background: "var(--surface-1)",
              boxShadow: "var(--shadow-card)",
              borderRadius: "var(--radius-control)",
            }}
          >
            <BrandMark isChatPage={isChatPage} imgClassName="h-6 w-6" />
          </h1>
        </div>

        <nav
          className="flex items-center gap-1.5 px-3 py-2.5 justify-self-center"
          style={{
            background: "var(--surface-1)",
            boxShadow: "var(--shadow-card)",
            borderRadius: "var(--radius-control)",
          }}
        >
          {NAV_ITEMS.map((item) => (
            <DesktopNavLink key={item.to} item={item} />
          ))}
        </nav>

        <div
          className="flex items-center gap-2 px-3 py-2 justify-self-end"
          style={{
            background: "var(--surface-1)",
            boxShadow: "var(--shadow-card)",
            borderRadius: "var(--radius-control)",
          }}
        >
          <NavLink to="/settings" aria-label="Settings" title="Settings" className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-full text-xs font-semibold"
              style={{ width: 32, height: 32, background: "var(--brand-tint)", color: "var(--brand-hover)" }}
            >
              {initial}
            </div>
            <span className="text-sm hidden lg:inline" style={{ color: "var(--text-primary)" }}>
              {email ?? "Account"}
            </span>
          </NavLink>
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile: slim top bar (logo + account), nav lives in the fixed bottom bar below */}
      <header
        className={clsx(
          "md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 transition-transform duration-300",
          scrollingDown && "-translate-y-full"
        )}
        style={{
          background: "var(--surface-1)",
          boxShadow: "var(--shadow-card)",
          paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          paddingBottom: "0.75rem",
        }}
      >
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <BrandMark isChatPage={isChatPage} imgClassName="h-8 w-8" />
        </h1>
        <div className="flex items-center gap-2">
          <NavLink to="/settings" aria-label="Settings" title="Settings">
            <div
              className="flex items-center justify-center rounded-full text-sm font-semibold"
              style={{ width: 40, height: 40, background: "var(--brand-tint)", color: "var(--brand-hover)" }}
            >
              {initial}
            </div>
          </NavLink>
          <Button variant="outline" onClick={logout} style={{ paddingTop: "0.7rem", paddingBottom: "0.7rem" }}>
            Logout
          </Button>
        </div>
      </header>

      <main className="p-3 pb-28 md:p-4 overflow-x-hidden max-w-[1400px] mx-auto">
        <Outlet />
      </main>

      <nav
        className={clsx(
          "md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-2 py-3 transition-transform duration-300",
          scrollingDown && "translate-y-full"
        )}
        style={{
          background: "var(--surface-1)",
          boxShadow: "var(--shadow-card)",
          borderTop: "1px solid var(--border)",
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        }}
      >
        {NAV_ITEMS.map((item) => (
          <NavIconLink key={item.to} item={item} />
        ))}
      </nav>
    </div>
  );
}
