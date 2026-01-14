import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { chartConfig, getChartColor, formatNumber } from '../../lib/chartConfig';

interface BarConfig {
  key: string;
  color?: string;
  name?: string;
  tooltip?: string;
}

interface AxisLabelConfig {
  text: string;
  tooltip?: string;
}

interface BarChartProps {
  data: Array<Record<string, string | number>>;
  xKey: string;
  bars: BarConfig[];
  height?: number;
  layout?: 'vertical' | 'horizontal';
  showGrid?: boolean;
  showLegend?: boolean;
  formatY?: (value: number) => string;
  formatX?: (value: string) => string;
  colorByIndex?: boolean;
  xAxisLabel?: string | AxisLabelConfig;
  yAxisLabel?: string | AxisLabelConfig;
}

// Custom legend component with tooltip support
interface CustomLegendProps {
  payload?: ReadonlyArray<{
    value?: string | number;
    color?: string;
    dataKey?: unknown;
  }>;
  bars: BarConfig[];
}

function CustomLegend({ payload, bars }: CustomLegendProps) {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap justify-center gap-4 pt-4">
      {payload.map((entry, index) => {
        const barConfig = bars.find((b) => b.key === String(entry.dataKey));
        const tooltip = barConfig?.tooltip;

        return (
          <div key={index} className="group relative flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color || '#64748b' }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-400">{String(entry.value)}</span>
            {tooltip && (
              <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 text-xs text-white bg-slate-800 rounded-lg whitespace-normal w-48 text-center shadow-lg z-50">
                {tooltip}
                <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-800" />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BarChart({
  data,
  xKey,
  bars,
  height = 300,
  layout = 'vertical',
  showGrid = true,
  showLegend = false,
  formatY = formatNumber,
  formatX,
  colorByIndex = false,
  xAxisLabel,
  yAxisLabel,
}: BarChartProps) {
  // Parse axis label configs
  const xLabel = typeof xAxisLabel === 'string' ? { text: xAxisLabel } : xAxisLabel;
  const yLabel = typeof yAxisLabel === 'string' ? { text: yAxisLabel } : yAxisLabel;
  const isHorizontal = layout === 'horizontal';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={isHorizontal ? 'vertical' : 'horizontal'}
        margin={{
          ...chartConfig.margin,
          left: isHorizontal ? 80 : chartConfig.margin.left,
        }}
      >
        {showGrid && (
          <CartesianGrid
            stroke={chartConfig.grid.stroke}
            strokeDasharray={chartConfig.grid.strokeDasharray}
            horizontal={!isHorizontal}
            vertical={isHorizontal}
          />
        )}
        {isHorizontal ? (
          <>
            <XAxis
              type="number"
              tick={chartConfig.axis.tick}
              axisLine={chartConfig.axis.axisLine}
              tickLine={false}
              tickFormatter={formatY}
              label={xLabel ? {
                value: xLabel.text,
                position: 'bottom',
                offset: 0,
                fill: '#64748b',
                fontSize: 12,
              } : undefined}
            />
            <YAxis
              type="category"
              dataKey={xKey}
              tick={chartConfig.axis.tick}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatX}
              width={80}
              label={yLabel ? {
                value: yLabel.text,
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fill: '#64748b',
                fontSize: 12,
              } : undefined}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={xKey}
              tick={chartConfig.axis.tick}
              axisLine={chartConfig.axis.axisLine}
              tickLine={false}
              tickFormatter={formatX}
              label={xLabel ? {
                value: xLabel.text,
                position: 'bottom',
                offset: 0,
                fill: '#64748b',
                fontSize: 12,
              } : undefined}
            />
            <YAxis
              tick={chartConfig.axis.tick}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatY}
              width={60}
              label={yLabel ? {
                value: yLabel.text,
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fill: '#64748b',
                fontSize: 12,
              } : undefined}
            />
          </>
        )}
        <Tooltip
          contentStyle={chartConfig.tooltip.contentStyle}
          labelStyle={chartConfig.tooltip.labelStyle}
          formatter={(value, name) => [formatY(Number(value)), String(name)]}
          cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ paddingTop: 16 }}
            content={bars.some((b) => b.tooltip)
              ? (props) => <CustomLegend {...props} bars={bars} />
              : undefined
            }
            iconType="square"
          />
        )}
        {bars.map((bar, barIndex) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name || bar.key}
            fill={bar.color || getChartColor(barIndex)}
            radius={[4, 4, 0, 0]}
          >
            {colorByIndex &&
              data.map((_, dataIndex) => (
                <Cell key={dataIndex} fill={getChartColor(dataIndex)} />
              ))}
          </Bar>
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
