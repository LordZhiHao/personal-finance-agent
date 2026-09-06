import clsx from "clsx";
import { addMonths, format as formatDate, subMonths } from "date-fns";

// Shared "‹ Month Year ›" stepper — previously hand-duplicated (in two
// slightly different layouts) across SpendByCategoryDonut, DividendsByCurrencyDonut,
// SpendingHeatmap, and DividendCalendar. `allowAllTime` covers the nullable
// "All Time" reset variant (SpendByCategoryDonut/DividendsByCurrencyDonut);
// omit it for the non-nullable, always-a-specific-month variant
// (SpendingHeatmap/DividendCalendar) — `onChange` is never called with `null`
// unless `allowAllTime` is set, so callers with a non-nullable `Date` state
// can safely fall back with `(d) => setMonth(d ?? new Date())`.
export function MonthStepper({
  value,
  onChange,
  format = "MMMM yyyy",
  allowAllTime = false,
  className,
}: {
  value: Date | null;
  onChange: (date: Date | null) => void;
  format?: string;
  allowAllTime?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center justify-center gap-3 text-sm", className)}>
      {allowAllTime && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="px-2 py-1 rounded font-medium"
          style={{
            color: value === null ? "var(--brand)" : "var(--text-secondary)",
            background: value === null ? "var(--brand-tint)" : "transparent",
          }}
        >
          All Time
        </button>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(subMonths(value ?? new Date(), 1))}
          className="px-2 py-1"
          style={{ color: "var(--text-secondary)" }}
        >
          ‹
        </button>
        <span style={{ color: "var(--text-primary)", minWidth: 110, textAlign: "center" }}>
          {formatDate(value ?? new Date(), format)}
        </span>
        <button
          type="button"
          onClick={() => onChange(addMonths(value ?? new Date(), 1))}
          className="px-2 py-1"
          style={{ color: "var(--text-secondary)" }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
