import { useEffect, useState } from "react";
import { CATEGORICAL_A, CATEGORICAL_B, CHROME, NEUTRAL_FALLBACK, SEQUENTIAL } from "./palette";

// ECharts renders to <canvas> by default and cannot resolve CSS var() the way
// Recharts (SVG, styled via inline `stroke`/`fill` strings) can — canvas needs
// literal color values. This resolves palette.ts's CSS-variable tokens to the
// browser's actual computed colors so the pilot charts follow the current
// light/dark + green/orange theme exactly like every existing chart does.
export function resolveCssVar(token: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(token);
  if (!match) return token;
  const value = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
  return value || token;
}

function resolveAll(tokens: readonly string[]): string[] {
  return tokens.map(resolveCssVar);
}

export interface EchartsPalette {
  categoricalA: string[];
  categoricalB: string[];
  sequential: string[];
  neutral: string;
  brand: string;
  gridline: string;
  baseline: string;
  textMuted: string;
  textSecondary: string;
  surface: string;
  border: string;
}

function computePalette(): EchartsPalette {
  return {
    categoricalA: resolveAll(CATEGORICAL_A),
    categoricalB: resolveAll(CATEGORICAL_B),
    sequential: resolveAll(SEQUENTIAL),
    neutral: resolveCssVar(NEUTRAL_FALLBACK),
    brand: resolveCssVar("var(--brand)"),
    gridline: resolveCssVar(CHROME.gridline),
    baseline: resolveCssVar(CHROME.baseline),
    textMuted: resolveCssVar(CHROME.textMuted),
    textSecondary: resolveCssVar(CHROME.textSecondary),
    surface: resolveCssVar(CHROME.surface),
    border: resolveCssVar(CHROME.border),
  };
}

// Recomputes whenever the theme's data-theme attribute or the OS light/dark
// preference changes, mirroring how every CSS-var-driven Recharts chart
// already re-themes for free (see AuthContext.tsx::applyTheme).
export function useEchartsPalette(): EchartsPalette {
  const [palette, setPalette] = useState<EchartsPalette>(computePalette);

  useEffect(() => {
    const recompute = () => setPalette(computePalette());

    const observer = new MutationObserver(recompute);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", recompute);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", recompute);
    };
  }, []);

  return palette;
}
