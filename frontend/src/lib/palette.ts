// Categorical hues in fixed order — never cycled/reassigned per filter state.
// Values are CSS custom properties (see index.css) so charts follow the
// user's orange/green theme automatically without re-render. As of the
// theme-coverage pass these are a monochrome ramp (light -> dark shades of
// the brand hue), not distinct hues — see the rationale comment on index.css's
// --series-1..8.
export const CATEGORICAL = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
] as const;

// A 9th+ series is never a generated/wrapped hue (that repaints two unrelated
// entities the same color) — it folds to this neutral instead.
export const NEUTRAL_FALLBACK = "var(--text-muted)";

// Bit-spread traversal of the 8 ramp slots so a low item count (the common
// case — 2-4 brokers/currencies, up to 8 expense categories) lands on
// well-separated shades instead of clustering at the lightest end, now that
// CATEGORICAL is a monochrome ramp rather than 8 distinct hues. A pure fixed
// reindex — colorForKey's "stable by key" guarantee is unaffected.
const SPREAD_ORDER = [0, 7, 3, 5, 1, 6, 2, 4];

export function categoricalColor(index: number): string {
  if (index < 0 || index >= CATEGORICAL.length) return NEUTRAL_FALLBACK;
  return CATEGORICAL[SPREAD_ORDER[index]];
}

// Stable key -> color assignment so a series keeps its color across
// filters/re-renders instead of repainting when the visible set changes.
// Keys beyond the 8 validated slots fold to the neutral fallback rather than
// wrapping onto (and colliding with) an earlier key's color.
export function colorForKey(key: string, knownKeys: string[]): string {
  return categoricalColor(knownKeys.indexOf(key));
}

// Salary and Investment are income-only (every category-colored chart filters to
// expenses, amount < 0) and "Other" is the generic catch-all, so those three fold to
// the neutral fallback rather than displacing one of the 8 validated hues away from
// a category that actually renders in these charts.
export const CATEGORY_COLOR_EXCLUDE = ["Salary", "Investment", "Other"];

// Per-user color order for category charts, built from the actual built-in +
// custom category list (see db.supabase.get_categories_for_user) rather than a
// hardcoded English name list — otherwise every custom category falls outside
// a fixed array and always folds to the neutral fallback.
export function categoryColorOrder(categories: string[]): string[] {
  return categories.filter((c) => !CATEGORY_COLOR_EXCLUDE.includes(c));
}

export const CHROME = {
  gridline: "var(--gridline)",
  baseline: "var(--baseline)",
  textMuted: "var(--text-muted)",
  textSecondary: "var(--text-secondary)",
  surface: "var(--surface-1)",
  border: "var(--border)",
} as const;

// Sequential single-hue ramp (brand hue), light -> dark, for the spending
// heatmap. CSS custom properties (see index.css) so it follows the user's
// orange/green theme choice automatically, same as CATEGORICAL above.
export const SEQUENTIAL = [
  "var(--sequential-1)",
  "var(--sequential-2)",
  "var(--sequential-3)",
  "var(--sequential-4)",
  "var(--sequential-5)",
] as const;
