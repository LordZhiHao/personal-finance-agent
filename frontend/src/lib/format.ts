export function formatMoney(amount: number, currency: string): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${currency} ${Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
