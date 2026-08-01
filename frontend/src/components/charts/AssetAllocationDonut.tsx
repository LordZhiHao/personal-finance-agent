import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { colorForKey } from "../../lib/palette";
import { legendStyle, tooltipStyle } from "./chartTheme";

export interface AllocationSlice {
  name: string;
  value: number;
}

export function AssetAllocationDonut({ data, fill = false }: { data: AllocationSlice[]; fill?: boolean }) {
  const names = data.map((d) => d.name);

  return (
    <ResponsiveContainer width="100%" height={fill ? "100%" : 280} minHeight={fill ? 280 : undefined}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={1}>
          {data.map((d) => (
            <Cell key={d.name} fill={colorForKey(d.name, names)} stroke="var(--surface-1)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={legendStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}
