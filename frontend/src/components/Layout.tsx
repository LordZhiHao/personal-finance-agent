import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./ui/Button";
import { ChatWidget } from "./ChatWidget";

const NAV_ITEMS = [
  { to: "/spending", label: "💸 Spending" },
  { to: "/investments", label: "📈 Investments" },
  { to: "/portfolio", label: "📊 Portfolio" },
  { to: "/balances", label: "💳 Balances" },
  { to: "/settings", label: "⚙️ Settings" },
];

export function Layout() {
  const { logout, email } = useAuth();
  const initial = email ? email.trim()[0]?.toUpperCase() : "?";
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="flex items-center gap-3 md:gap-6 px-4 py-3 md:px-6"
        style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-card)" }}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden text-xl leading-none px-1"
          style={{ color: "var(--text-primary)" }}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
        <h1 className="flex items-center gap-2 text-base font-semibold shrink-0">
          <img src="/logo-mark.png" alt="" className="h-7 w-7" />
          <span style={{ color: "var(--text-heading)" }}>
            Finance<span style={{ color: "var(--brand)" }}>Ku</span>
          </span>
        </h1>
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? "" : "border-transparent hover:opacity-80"
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? "var(--brand)" : "var(--text-secondary)",
                borderColor: isActive ? "var(--brand)" : "transparent",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 shrink-0 ml-auto md:ml-0">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-full text-xs font-semibold"
              style={{ width: 32, height: 32, background: "var(--brand-tint)", color: "var(--brand-hover)" }}
            >
              {initial}
            </div>
            <span className="text-sm hidden sm:inline" style={{ color: "var(--text-primary)" }}>
              {email ?? "Account"}
            </span>
          </div>
          <Button variant="outline" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>
      {menuOpen && (
        <nav
          className="md:hidden flex flex-col px-4 py-2"
          style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-card)" }}
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="px-2 py-3 text-sm font-medium border-b"
              style={({ isActive }) => ({
                color: isActive ? "var(--brand)" : "var(--text-secondary)",
                borderColor: "var(--gridline)",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
      <main className="p-4 md:p-6 overflow-x-hidden max-w-[1400px] mx-auto">
        <Outlet />
      </main>
      <ChatWidget />
    </div>
  );
}
