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
// entities the same color) — it folds to this neutral instead. 8 isn't an
// arbitrary cap: it's the measured ceiling for this ramp's hue/lightness
// range — `node scripts/validate_palette.js --ordinal` (dataviz skill) on a
// 9-step interpolation of these same endpoints fails the adjacent-ΔL >= 0.06
// check (steps land ~0.05 apart), so a 9th distinguishable shade isn't
// available in this hue without leaving the validated lightness band.
export const NEUTRAL_FALLBACK = "var(--text-muted)";

// Proportionally spreads however many series are actually present (up to the
// 8 validated slots) across the full light->dark range, so the ramp always
// reads as one smooth gradient scaled to the real count — 2 series land far
// apart (light + dark), 8 fill in every step — rather than a fixed lookup
// table tuned for one specific count. `total` beyond 8 still maps its first
// 8 keys 1:1 onto the 8 slots (no further compression, which would breach
// the validated ΔL floor above); a 9th+ key is caught by the range check.
function spreadIndex(index: number, total: number): number {
  const slots = Math.min(total, CATEGORICAL.length);
  if (slots <= 1) return 0;
  return Math.round((index * (CATEGORICAL.length - 1)) / (slots - 1));
}

export function categoricalColor(index: number, total: number = CATEGORICAL.length): string {
  if (index < 0 || index >= CATEGORICAL.length || index >= total) return NEUTRAL_FALLBACK;
  return CATEGORICAL[spreadIndex(index, total)];
}

// Stable key -> color assignment so a series keeps its color across
// filters/re-renders instead of repainting when the visible set changes.
// Keys beyond the 8 validated slots fold to the neutral fallback rather than
// wrapping onto (and colliding with) an earlier key's color.
export function colorForKey(key: string, knownKeys: string[]): string {
  return categoricalColor(knownKeys.indexOf(key), knownKeys.length);
}

// "Other" is the generic catch-all, so it folds to the neutral fallback rather than
// displacing one of the 8 validated hues away from a category that actually renders
// in these charts. Every non-"expense"-classified category (Salary/Transfer/Investment
// and any custom category marked as such) is excluded too — every category-colored
// chart only ever plots "expense"-classified spend, see db.supabase's
// get_category_classifications_for_user / CATEGORY_COLOR_EXCLUDE was the old,
// hardcoded-name version of this same rule.
const CATEGORY_COLOR_EXCLUDE_CATCHALL = ["Other"];

// Per-user color order for category charts, built from the actual built-in +
// custom category list (see db.supabase.get_categories_for_user) rather than a
// hardcoded English name list — otherwise every custom category falls outside
// a fixed array and always folds to the neutral fallback. `classifications` (from
// GET /api/meta's category_classifications) excludes any category that isn't
// "expense" — those never appear in a spend chart to begin with.
export function categoryColorOrder(categories: string[], classifications: Record<string, string>): string[] {
  return categories.filter(
    (c) => !CATEGORY_COLOR_EXCLUDE_CATCHALL.includes(c) && (classifications[c] ?? "expense") === "expense",
  );
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
