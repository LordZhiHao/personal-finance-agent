import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const NAV_ITEMS = [
  { to: "/spending", label: "💸 Spending" },
  { to: "/investments", label: "📈 Investments" },
  { to: "/portfolio", label: "📊 Portfolio" },
  { to: "/balances", label: "💳 Balances" },
];

export function Layout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex" style={{ background: "var(--page)" }}>
      <aside
        className="w-56 shrink-0 p-4 flex flex-col gap-1"
        style={{ borderRight: "1px solid var(--border)", background: "var(--surface-1)" }}
      >
        <h1 className="text-base font-medium mb-4 px-2" style={{ color: "var(--text-primary)" }}>
          Finance Tracker
        </h1>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded px-3 py-2 text-sm ${isActive ? "font-medium" : ""}`
            }
            style={({ isActive }) => ({
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
              background: isActive ? "var(--page)" : "transparent",
            })}
          >
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={logout}
          className="mt-auto rounded px-3 py-2 text-sm text-left"
          style={{ color: "var(--text-muted)" }}
        >
          Log out
        </button>
      </aside>
      <main className="flex-1 p-6 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
