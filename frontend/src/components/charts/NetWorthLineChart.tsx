import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format, parseISO } from "date-fns";
import { CHROME } from "../../lib/palette";
import { axisTickStyle, tooltipStyle } from "./chartTheme";

export interface NetWorthPoint {
  date: string;
  value: number;
}

export function NetWorthLineChart({ points }: { points: NetWorthPoint[] }) {
  const data = points.map((p) => ({ ...p, label: format(parseISO(p.date), "d MMM yyyy") }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHROME.gridline} vertical={false} />
        <XAxis dataKey="label" tick={axisTickStyle} axisLine={{ stroke: CHROME.baseline }} tickLine={false} />
        <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Line type="monotone" dataKey="value" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
