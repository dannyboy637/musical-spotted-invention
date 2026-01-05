import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { chartConfig, getChartColor, formatNumber } from '../../lib/chartConfig';

interface DonutDataItem {
  name: string;
  value: number;
  color?: string;
  [key: string]: string | number | undefined;
}

interface DonutChartProps {
  data: DonutDataItem[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  formatValue?: (value: number) => string;
}

export function DonutChart({
  data,
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
  formatValue = formatNumber,
}: DonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  // When legend is shown, pie is shifted left
  const pieCx = showLegend ? '35%' : '50%';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx={pieCx}
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {data.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={entry.color || getChartColor(index)}
              stroke="none"
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={chartConfig.tooltip.contentStyle}
          labelStyle={chartConfig.tooltip.labelStyle}
          formatter={(value, name) => {
            const numValue = Number(value);
            const percent = ((numValue / total) * 100).toFixed(1);
            return [`${formatValue(numValue)} (${percent}%)`, String(name)];
          }}
        />
        {showLegend && (
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={10}
            formatter={(value) => (
              <span className="text-sm text-slate-600">{value}</span>
            )}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
