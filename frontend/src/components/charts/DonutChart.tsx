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
  tooltip?: string;
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

// Custom legend component with tooltip support
interface CustomLegendProps {
  payload?: ReadonlyArray<{
    value?: string | number;
    color?: string;
  }>;
  data: DonutDataItem[];
}

function CustomLegend({ payload, data }: CustomLegendProps) {
  if (!payload) return null;

  return (
    <div className="flex flex-col gap-2">
      {payload.map((entry, index) => {
        const dataItem = data.find((d) => d.name === String(entry.value));
        const tooltip = dataItem?.tooltip;

        return (
          <div key={index} className="group relative flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color || '#64748b' }}
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">{String(entry.value)}</span>
            {tooltip && (
              <span className="invisible group-hover:visible absolute left-full ml-2 px-3 py-2 text-xs text-white bg-slate-800 rounded-lg whitespace-normal w-48 shadow-lg z-50">
                {tooltip}
                <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
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
            content={data.some((d) => d.tooltip)
              ? (props) => <CustomLegend {...props} data={data} />
              : undefined
            }
            formatter={(value) => (
              <span className="text-sm text-slate-600">{value}</span>
            )}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
