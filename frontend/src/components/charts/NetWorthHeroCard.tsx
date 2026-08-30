import { Sparkline } from "./Sparkline";

export interface HeroSecondaryStat {
  label: string;
  value: string;
}

/** The brand-gradient hero card used by both Overview (net worth) and Investments
 * (portfolio value) — a big tabular figure, a delta pill, a decorative sparkline,
 * and 2-4 compact secondary stats underneath. See the mockup's hero card, reused
 * as one component rather than two near-identical ones. `value` is pre-formatted
 * (formatMoney) by the caller, same convention as StatCard. */
export function NetWorthHeroCard({
  label,
  value,
  deltaText,
  deltaDirection,
  sparkline,
  secondaryStats,
}: {
  label: string;
  value: string;
  deltaText?: string;
  deltaDirection?: "up" | "down";
  sparkline?: number[];
  secondaryStats: HeroSecondaryStat[];
}) {
  return (
    <div
      className="rounded-card p-6 text-white"
      style={{
        background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-hover) 62%, var(--brand-hover) 100%)",
        boxShadow: "var(--shadow-card)",
        borderRadius: "var(--radius-card)",
      }}
    >
      <div className="text-[11px] font-mono tracking-wider" style={{ color: "rgba(255,255,255,0.72)" }}>
        {label.toUpperCase()}
      </div>
      <div className="text-4xl sm:text-5xl font-bold tabular-nums mt-2 mb-2">{value}</div>
      {deltaText && (
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            {deltaDirection === "down" ? "▼" : "▲"} {deltaText}
          </span>
        </div>
      )}
      {sparkline && sparkline.length >= 2 && (
        <div className="mt-4">
          <Sparkline points={sparkline} />
        </div>
      )}
      {secondaryStats.length > 0 && (
        <div className="flex gap-2 mt-4 flex-wrap">
          {secondaryStats.map((s) => (
            <div
              key={s.label}
              className="flex-1 min-w-[120px] rounded-2xl px-3.5 py-2.5"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <div className="text-[10.5px]" style={{ color: "rgba(255,255,255,0.78)" }}>
                {s.label}
              </div>
              <div className="text-base font-semibold tabular-nums mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
