import clsx from "clsx";

/** Mobile-only sticky subheader that lets a long page (Spending/Investments/Portfolio)
 * switch between its sections instead of scrolling through all of them at once.
 * Desktop is unaffected — each page keeps showing every section via its own `md:block`
 * override on the panel wrapping each section. */
export function MobileSectionTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      className="md:hidden sticky top-0 z-20 -mx-3 px-3 py-2"
      style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex gap-1 p-1" style={{ background: "var(--field-bg)", borderRadius: "var(--radius-control)" }}>
        {tabs.map((tab) => {
          const isActive = tab.value === active;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onChange(tab.value)}
              className={clsx(
                "flex-1 px-2 py-1.5 text-sm font-medium text-center transition-colors rounded-[calc(var(--radius-control)-4px)]",
                !isActive && "hover:bg-black/[0.03]"
              )}
              style={{
                background: isActive ? "var(--brand)" : "transparent",
                color: isActive ? "#fff" : "var(--text-secondary)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
