export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
    >
      <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="text-2xl font-medium tabular-nums mt-1" style={{ color: "var(--text-primary)" }}>
        {value}
      </div>
    </div>
  );
}
