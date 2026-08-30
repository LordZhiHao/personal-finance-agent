import { formatMoney } from "../../lib/format";

export interface RingCategoryRow {
  name: string;
  color: string;
  amount: number;
  /** 0-100, this category's amount relative to the largest category shown. */
  widthPct: number;
  /** Signed vs. the prior period — omitted when there's no comparable prior data. */
  deltaPct?: number;
}

/** Insight-first "you've spent $X of $Y" card — headline sentence + a % ring
 * (CSS conic-gradient, no charting library needed for a single-value ring),
 * plus a ranked list of top categories with mini bars and deltas. Replaces the
 * old four-equal-StatCard KPI row as the page's primary, hierarchy-first read —
 * see the mockup's "insight-first cards" move in FinanceKu Mockups.dc.html. */
export function SpendRingCard({
  headline,
  pctUsed,
  categories,
  currency,
  footnote,
}: {
  headline: React.ReactNode;
  /** null when there's no plan/budget to measure against — ring is hidden, headline still shows. */
  pctUsed: number | null;
  categories: RingCategoryRow[];
  currency: string;
  footnote?: React.ReactNode;
}) {
  const clamped = pctUsed === null ? null : Math.max(0, Math.min(100, pctUsed));

  return (
    <div
      className="rounded-card p-5 h-full"
      style={{ background: "var(--surface-1)", boxShadow: "var(--shadow-card)", borderRadius: "var(--radius-card)" }}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <h3 className="text-base sm:text-lg font-semibold leading-snug max-w-[34ch]" style={{ color: "var(--text-heading)" }}>
          {headline}
        </h3>
        {clamped !== null && (
          <div
            className="shrink-0 rounded-full flex items-center justify-center"
            style={{
              width: 72,
              height: 72,
              background: `conic-gradient(var(--brand) 0 ${clamped}%, var(--gridline) ${clamped}% 100%)`,
            }}
          >
            <div
              className="rounded-full flex flex-col items-center justify-center"
              style={{ width: 54, height: 54, background: "var(--surface-1)" }}
            >
              <span className="text-base font-semibold tabular-nums" style={{ color: "var(--text-heading)" }}>
                {Math.round(clamped)}%
              </span>
              <span className="text-[8px] font-mono" style={{ color: "var(--text-muted)" }}>
                USED
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {categories.map((c) => (
          <div key={c.name}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: c.color }} />
                {c.name}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-sm font-medium tabular-nums" style={{ color: "var(--text-heading)" }}>
                  {formatMoney(c.amount, currency)}
                </span>
                {c.deltaPct !== undefined && (
                  <span
                    className="text-xs w-11 text-right tabular-nums"
                    style={{ color: c.deltaPct > 0 ? "var(--tint-red-text)" : "var(--tint-green-text)" }}
                  >
                    {c.deltaPct > 0 ? "+" : ""}
                    {Math.round(c.deltaPct)}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--gridline)" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, c.widthPct)}%`, background: c.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {footnote && (
        <div
          className="mt-3.5 pt-3 flex items-center justify-between text-sm"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {footnote}
        </div>
      )}
    </div>
  );
}
