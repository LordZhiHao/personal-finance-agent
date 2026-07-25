import { CHROME } from "../../lib/palette";

export const tooltipStyle = {
  contentStyle: {
    background: "var(--surface-1)",
    border: `1px solid ${CHROME.border}`,
    borderRadius: 13,
    boxShadow: "var(--shadow-card)",
    fontSize: 12,
    color: "var(--text-primary)",
  },
  labelStyle: { color: "var(--text-secondary)" },
};

export const axisTickStyle = { fill: CHROME.textMuted, fontSize: 12 };
export const legendStyle = { fontSize: 12, color: "var(--text-secondary)" };
