/** Small decorative trend line for hero cards — not a real chart (no axes/tooltip),
 * just a normalized area+line path, matching the mockup's hand-drawn hero sparklines.
 * Renders nothing (rather than a flat/misleading line) when there isn't enough data. */
export function Sparkline({
  points,
  height = 64,
  stroke = "#fff",
  fill = "rgba(255, 255, 255, 0.17)",
}: {
  points: number[];
  height?: number;
  stroke?: string;
  fill?: string;
}) {
  if (points.length < 2) return null;

  const width = 340;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / range) * (height - 8) - 4;
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width} ${height} L0 ${height} Z`;
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height, display: "block" }}
    >
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={4} fill={stroke} />
    </svg>
  );
}
