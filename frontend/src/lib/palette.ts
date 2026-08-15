// Two categorical ramps in fixed order — never cycled/reassigned per filter
// state. Values are CSS custom properties (see index.css) so charts follow
// the user's orange/green theme automatically without re-render. Each ramp
// on its own is a monochrome light -> dark shade of one hue (CATEGORICAL_A =
// the brand hue, CATEGORICAL_B = a second hue added for extra separation —
// blue in the green theme, maroon/red in the orange theme); colorForKey()
// below alternates between them per category index so adjacent categories
// differ in hue as well as lightness, not just lightness. See the rationale
// comments on index.css's --series-1..8 / --series-b-1..8.
export const CATEGORICAL_A = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
] as const;

export const CATEGORICAL_B = [
  "var(--series-b-1)",
  "var(--series-b-2)",
  "var(--series-b-3)",
  "var(--series-b-4)",
  "var(--series-b-5)",
  "var(--series-b-6)",
  "var(--series-b-7)",
  "var(--series-b-8)",
] as const;

const RAMP_LENGTH = CATEGORICAL_A.length; // 8, same for CATEGORICAL_B
const MAX_SLOTS = RAMP_LENGTH * 2; // 16 — 8 validated steps per ramp, 2 ramps

// A 17th+ series is never a generated/wrapped hue (that repaints two unrelated
// entities the same color) — it folds to this neutral instead. 8 isn't an
// arbitrary per-ramp cap: it's the measured ceiling for each ramp's hue/lightness
// range — `node scripts/validate_palette.js --ordinal` (dataviz skill) on a
// 9-step interpolation of either ramp's endpoints fails the adjacent-ΔL >= 0.06
// check, so a 9th distinguishable shade isn't available in either hue without
// leaving its validated lightness band.
export const NEUTRAL_FALLBACK = "var(--text-muted)";

// Proportionally spreads however many indices actually landed on this ramp
// (up to its 8 validated slots) across its full light->dark range, so it
// always reads as one smooth gradient scaled to the real count — rather than
// a fixed lookup table tuned for one specific count. `rampTotal` beyond 8
// still maps its first 8 indices 1:1 onto the 8 slots (no further compression,
// which would breach the validated ΔL floor); a 9th+ index on the same ramp
// is caught by the range check below.
function spreadIndex(rampIndex: number, rampTotal: number): number {
  const slots = Math.min(rampTotal, RAMP_LENGTH);
  if (slots <= 1) return 0;
  return Math.round((rampIndex * (RAMP_LENGTH - 1)) / (slots - 1));
}

export function categoricalColor(index: number, total: number = MAX_SLOTS): string {
  if (index < 0 || index >= MAX_SLOTS || index >= total) return NEUTRAL_FALLBACK;
  // Alternate ramp per index (even -> A, odd -> B) so adjacent categories in
  // the fixed order differ in hue, not just lightness. Each ramp gets its own
  // spreadIndex, computed against however many of the (up to 16) indices
  // share its parity, so within a ramp the steps still read as one gradient.
  const clampedTotal = Math.min(total, MAX_SLOTS);
  const ramp = index % 2 === 0 ? CATEGORICAL_A : CATEGORICAL_B;
  const rampIndex = Math.floor(index / 2);
  const rampTotal = index % 2 === 0 ? Math.ceil(clampedTotal / 2) : Math.floor(clampedTotal / 2);
  return ramp[spreadIndex(rampIndex, rampTotal)];
}

// Stable key -> color assignment so a series keeps its color across
// filters/re-renders instead of repainting when the visible set changes.
// Keys beyond the 16 validated slots (8 per ramp x 2 ramps) fold to the
// neutral fallback rather than wrapping onto (and colliding with) an earlier
// key's color.
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
// orange/green theme choice automatically, same as CATEGORICAL_A/CATEGORICAL_B above.
export const SEQUENTIAL = [
  "var(--sequential-1)",
  "var(--sequential-2)",
  "var(--sequential-3)",
  "var(--sequential-4)",
  "var(--sequential-5)",
] as const;
