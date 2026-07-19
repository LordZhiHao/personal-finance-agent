// Categorical hues in fixed order — never cycled/reassigned per filter state.
// Values are CSS custom properties (see index.css) so charts follow light/dark
// mode automatically without re-render.
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

export function categoricalColor(index: number): string {
  return index >= 0 && index < CATEGORICAL.length ? CATEGORICAL[index] : NEUTRAL_FALLBACK;
}

// Stable key -> color assignment so a series keeps its color across
// filters/re-renders instead of repainting when the visible set changes.
// Keys beyond the 8 validated slots fold to the neutral fallback rather than
// wrapping onto (and colliding with) an earlier key's color.
export function colorForKey(key: string, knownKeys: string[]): string {
  return categoricalColor(knownKeys.indexOf(key));
}

// Fixed color-assignment order for the 11 categories in utils/constants.py::CATEGORIES.
// Salary and Investment are income-only (every category-colored chart filters to
// expenses, amount < 0) and "Other" is the generic catch-all, so those three fold to
// the neutral fallback rather than displacing one of the 8 validated hues away from
// the categories that actually render in these charts.
export const EXPENSE_CATEGORY_COLOR_ORDER = [
  "Food & Drink",
  "Transport",
  "Shopping",
  "Groceries",
  "Entertainment",
  "Health",
  "Utilities",
  "Transfer",
];

export function colorForCategory(category: string): string {
  return colorForKey(category, EXPENSE_CATEGORY_COLOR_ORDER);
}

export const CHROME = {
  gridline: "var(--gridline)",
  baseline: "var(--baseline)",
  textMuted: "var(--text-muted)",
  textSecondary: "var(--text-secondary)",
  surface: "var(--surface-1)",
  border: "var(--border)",
} as const;

// Sequential single-hue ramp (blue), light -> dark, for the spending heatmap.
export const SEQUENTIAL_BLUE = ["#cde2fb", "#9ec5f4", "#5598e7", "#2a78d6", "#184f95"] as const;
