import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import { LayoutDashboard, PieChart, Receipt, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useAccounts, useBalances } from "../hooks/api";
import { useFinnShortcut } from "../hooks/useFinnShortcut";
import { useScrollDirection } from "../hooks/useScrollDirection";
import { formatMoney } from "../lib/format";
import { Button } from "./ui/Button";
import { FinnAvatar } from "./FinnAvatar";
import { FinnDock } from "./FinnDock";
import { FinnFab } from "./FinnFab";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard },
  { to: "/spending", label: "Spending", icon: Receipt },
  { to: "/investments", label: "Investments", icon: PieChart },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

/** Mobile bottom-nav icon: every item is tinted only while active, no permanent fill. */
function NavIconLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      aria-label={item.label}
      title={item.label}
      className="relative flex items-center justify-center shrink-0 transition-colors"
      style={({ isActive }) => ({
        width: 48,
        height: 48,
        borderRadius: "var(--radius-control)",
        background: isActive ? "var(--brand-tint)" : "transparent",
        color: isActive ? "var(--brand)" : "var(--text-secondary)",
      })}
    >
      {({ isActive }) => <Icon size={24} strokeWidth={isActive ? 2.25 : 2} />}
    </NavLink>
  );
}

/** Desktop sidebar rail nav item: icon + label, generous rows. */
function SidebarNavLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className="flex items-center gap-2.75 px-3 py-2.75 text-sm font-medium transition-colors"
      style={({ isActive }) => ({
        borderRadius: "var(--radius-control)",
        background: isActive ? "var(--brand-tint)" : "transparent",
        color: isActive ? "var(--brand)" : "var(--text-secondary)",
      })}
    >
      {({ isActive }) => (
        <>
          <Icon size={20} strokeWidth={isActive ? 2.25 : 2} />
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
  const { logout, email, mainCurrency } = useAuth();
  const [dockOpen, setDockOpen] = useState(false);
  const initial = email ? email.trim()[0]?.toUpperCase() : "?";
  const isChatPage = useLocation().pathname === "/chat";
  const scrollingDown = useScrollDirection();
  const accountsQuery = useAccounts();
  const balancesQuery = useBalances(mainCurrency);

  useFinnShortcut(() => setDockOpen(true));

  const balanceByAccountId = new Map((balancesQuery.data?.balances ?? []).map((b) => [b.account_id, b.balance]));

  return (
    <div className="min-h-screen md:flex" style={{ background: "var(--page)" }}>
      {/* Desktop: fixed left sidebar rail — logo, nav, Ask Finn, accounts, user footer */}
      <aside
        className="hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen shrink-0 gap-5 px-3.5 py-5"
        style={{ width: 236, background: "var(--surface-1)", borderRight: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 px-2">
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <BrandMark isChatPage={isChatPage} imgClassName="h-6 w-6" />
          </h1>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <SidebarNavLink key={item.to} item={item} />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setDockOpen(true)}
          className="flex items-center gap-2.5 px-2.75 py-2.5 -mt-1 text-left"
          style={{
            borderRadius: "var(--radius-control)",
            background: "var(--brand-tint)",
            border: "1px solid color-mix(in srgb, var(--brand) 16%, transparent)",
          }}
        >
          <FinnAvatar size={24} />
          <span className="flex-1 text-sm font-medium" style={{ color: "var(--brand-hover)" }}>
            Ask Finn
          </span>
        </button>

        {(accountsQuery.data?.length ?? 0) > 0 && (
          <div className="px-2">
            <div className="text-[10px] font-mono tracking-wider mb-2.5" style={{ color: "var(--text-muted)" }}>
              ACCOUNTS
            </div>
            <div className="flex flex-col gap-2">
              {(accountsQuery.data ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 rounded-full" style={{ width: 7, height: 7, background: "var(--brand)" }} />
                    <span className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                      {a.name}
                    </span>
                  </span>
                  <span className="text-sm font-medium tabular-nums shrink-0" style={{ color: "var(--text-heading)" }}>
                    {balanceByAccountId.has(a.id) && balanceByAccountId.get(a.id) !== null
                      ? formatMoney(balanceByAccountId.get(a.id)!, a.currency)
                      : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          className="mt-auto flex items-center gap-2.25 px-2.5 py-2.25"
          style={{ borderRadius: "var(--radius-control)", background: "var(--field-bg)" }}
        >
          <div
            className="flex items-center justify-center rounded-full text-xs font-semibold shrink-0"
            style={{ width: 30, height: 30, background: "var(--brand-tint)", color: "var(--brand-hover)" }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {email ?? "Account"}
            </div>
            <button type="button" onClick={logout} className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Mobile: slim top bar (logo + account) — sidebar nav above replaces it on desktop */}
        <header
          className={clsx(
            "md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 transition-transform duration-300",
            scrollingDown && "-translate-y-full",
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

        <main className="p-3 pb-28 md:p-6 overflow-x-hidden max-w-[1400px] mx-auto md:mx-0">
          <Outlet />
        </main>
      </div>

      <FinnFab />
      <FinnDock open={dockOpen} onClose={() => setDockOpen(false)} />

      <nav
        className={clsx(
          "md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-2 py-3 transition-transform duration-300",
          scrollingDown && "translate-y-full",
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
