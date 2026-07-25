import clsx from "clsx";

export function TabToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      className="inline-flex gap-1 p-1"
      style={{ background: "var(--field-bg)", borderRadius: "var(--radius-control)" }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={clsx(
              "px-3 py-1.5 text-sm font-medium transition-colors rounded-[calc(var(--radius-control)-4px)]",
              active ? "text-white" : "hover:bg-black/[0.03]"
            )}
            style={{
              background: active ? "var(--brand)" : "transparent",
              color: active ? "#fff" : "var(--text-secondary)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
