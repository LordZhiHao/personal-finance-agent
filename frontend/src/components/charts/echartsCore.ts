import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Modular registration (only the chart types/components the app actually
// uses) instead of importing all of echarts-for-react's default bundle, so
// bundle size stays honest as more charts migrate onto this shared instance.
// Add new entries here as new chart types are needed elsewhere.
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

export { echarts };
