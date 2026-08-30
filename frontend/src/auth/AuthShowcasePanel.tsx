/** Static, desktop-only product showcase for the split-panel login/signup layout (mockup #1h). */
export function AuthShowcasePanel({ className }: { className?: string }) {
  return (
    <div
      className={`${className ?? ""} flex-col p-10`}
      style={{
        background: "linear-gradient(150deg, var(--brand-hover) 0%, #016b43 58%, #014b30 100%)",
        color: "#ffffff",
      }}
    >
      <div className="flex items-center gap-2.5">
        <img
          src="/logo-mark.png"
          alt=""
          className="h-[30px] w-[30px] rounded-[9px]"
          style={{ background: "rgba(255,255,255,.16)" }}
        />
        <span style={{ font: "600 19px 'Source Serif 4', Georgia, serif" }}>FinanceKu</span>
      </div>

      <div className="mt-12" style={{ maxWidth: "26ch" }}>
        <h1 style={{ font: "600 38px/1.2 'Source Serif 4', Georgia, serif" }}>
          Tell Finn what you spent. Get the whole picture back.
        </h1>
        <p
          className="mt-3"
          style={{ fontFamily: "var(--font-plex-sans)", fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,.78)" }}
        >
          One message, one receipt, one forwarded bank alert — filed, categorised and charted before you put the
          phone down.
        </p>
      </div>

      <div className="mt-9 flex flex-col gap-2 items-end">
        <div
          className="rounded-2xl px-4 py-2.5"
          style={{ background: "rgba(255,255,255,.16)", fontFamily: "var(--font-plex-sans)", fontSize: 13.5 }}
        >
          spent 12 on lunch at maxwell
        </div>
        <div
          className="rounded-2xl p-4 w-full"
          style={{ background: "#ffffff", color: "var(--text-primary, #111827)", maxWidth: 290 }}
        >
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: "var(--font-plex-sans)", fontWeight: 500, fontSize: 13.5 }}>
              Maxwell Food Centre
            </span>
            <span style={{ font: "600 14px 'Source Serif 4', Georgia, serif", fontVariantNumeric: "tabular-nums" }}>
              −S$12.00
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5"
              style={{
                background: "var(--brand-tint)",
                color: "var(--brand-hover)",
                fontFamily: "var(--font-plex-sans)",
                fontSize: 11.5,
                fontWeight: 500,
              }}
            >
              Food & Drink
            </span>
            <span style={{ fontFamily: "var(--font-plex-sans)", fontSize: 11.5, color: "#9ca3af" }}>
              DBS Multiplier · 12:48
            </span>
          </div>
          <div
            className="mt-2 pt-2"
            style={{ borderTop: "1px solid rgba(17,24,39,.06)", fontFamily: "var(--font-plex-sans)", fontSize: 11.5, color: "#6b7280" }}
          >
            S$742 on Food & Drink this month · 92% of plan used
          </div>
        </div>
      </div>

      <div className="mt-auto pt-10 flex items-end gap-8">
        {[
          { value: "4s", label: "to log a receipt" },
          { value: "No bank login", label: "your numbers, your control" },
          { value: "SGD", label: "built for SG banks" },
        ].map((stat) => (
          <div key={stat.label}>
            <div style={{ font: "600 21px 'Source Serif 4', Georgia, serif" }}>{stat.value}</div>
            <div
              className="mt-1"
              style={{ fontFamily: "var(--font-plex-sans)", fontSize: 11.5, color: "rgba(255,255,255,.72)" }}
            >
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
