import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "./ui/Button";

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

  return (
    <div className="min-h-screen" style={{ background: "var(--page)" }}>
      <header
        className="flex items-center gap-6 px-6 py-3"
        style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-card)" }}
      >
        <h1 className="text-base font-semibold shrink-0" style={{ color: "var(--text-heading)" }}>
          🍊 Finance Tracker
        </h1>
        <nav className="flex items-center gap-1 flex-1">
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
        <div className="flex items-center gap-3 shrink-0">
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
      <main className="p-6 overflow-x-hidden max-w-[1400px] mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
