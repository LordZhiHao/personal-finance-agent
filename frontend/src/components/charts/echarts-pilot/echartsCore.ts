import * as echarts from "echarts/core";
import { LineChart, PieChart } from "echarts/charts";
import { GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Modular registration (only the chart types/components this pilot needs)
// instead of importing all of echarts-for-react's default bundle, so the
// pilot's actual bundle-size cost is honest if this ever needs evaluating.
echarts.use([LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

export { echarts };
