import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { chartConfig, getChartColor, formatNumber } from '../../lib/chartConfig';

interface LineConfig {
  key: string;
  color?: string;
  name?: string;
  tooltip?: string;
  strokeDasharray?: string;
}

interface ReferenceLineConfig {
  y: number;
  label: string;
  color?: string;
  strokeDasharray?: string;
}

interface AxisLabelConfig {
  text: string;
  tooltip?: string;
}

interface LineChartProps {
  data: Array<Record<string, string | number>>;
  xKey: string;
  lines: LineConfig[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  formatY?: (value: number) => string;
  formatX?: (value: string) => string;
  formatTooltipLabel?: (value: string) => string;
  referenceLines?: ReferenceLineConfig[];
  xAxisLabel?: string | AxisLabelConfig;
  yAxisLabel?: string | AxisLabelConfig;
  onDataPointClick?: (dataPoint: Record<string, string | number>, index: number) => void;
}

// Custom legend component with tooltip support
interface CustomLegendProps {
  payload?: ReadonlyArray<{
    value?: string | number;
    color?: string;
    dataKey?: unknown;
  }>;
  lines: LineConfig[];
}

function CustomLegend({ payload, lines }: CustomLegendProps) {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap justify-center gap-4 pt-4">
      {payload.map((entry, index) => {
        const lineConfig = lines.find((l) => l.key === String(entry.dataKey));
        const tooltip = lineConfig?.tooltip;

        return (
          <div key={index} className="group relative flex items-center gap-2">
            <div
              className="w-4 h-0.5"
              style={{
                backgroundColor: entry.color || '#64748b',
                borderStyle: lineConfig?.strokeDasharray ? 'dashed' : 'solid',
              }}
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

export function LineChart({
  data,
  xKey,
  lines,
  height = 300,
  showGrid = true,
  showLegend = false,
  formatY = formatNumber,
  formatX,
  formatTooltipLabel,
  referenceLines = [],
  xAxisLabel,
  yAxisLabel,
  onDataPointClick,
}: LineChartProps) {
  // Parse axis label configs
  const xLabel = typeof xAxisLabel === 'string' ? { text: xAxisLabel } : xAxisLabel;
  const yLabel = typeof yAxisLabel === 'string' ? { text: yAxisLabel } : yAxisLabel;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = (e: any) => {
    if (onDataPointClick && e?.activePayload?.[0]?.payload) {
      const payload = e.activePayload[0].payload as Record<string, string | number>;
      const index = data.findIndex((d) => d[xKey] === payload[xKey]);
      onDataPointClick(payload, index);
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart
        data={data}
        margin={chartConfig.margin}
        onClick={onDataPointClick ? handleChartClick : undefined}
        style={{ cursor: onDataPointClick ? 'pointer' : 'default' }}
      >
        {showGrid && (
          <CartesianGrid
            stroke={chartConfig.grid.stroke}
            strokeDasharray={chartConfig.grid.strokeDasharray}
            vertical={false}
          />
        )}
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
        <Tooltip
          contentStyle={chartConfig.tooltip.contentStyle}
          labelStyle={chartConfig.tooltip.labelStyle}
          formatter={(value, name) => [formatY(Number(value)), String(name)]}
          labelFormatter={formatTooltipLabel}
        />
        {showLegend && (
          <Legend
            wrapperStyle={{ paddingTop: 16 }}
            content={lines.some((l) => l.tooltip)
              ? (props) => <CustomLegend {...props} lines={lines} />
              : undefined
            }
            iconType="line"
          />
        )}
        {referenceLines.map((ref, index) => (
          <ReferenceLine
            key={`ref-${index}`}
            y={ref.y}
            stroke={ref.color || '#94a3b8'}
            strokeDasharray={ref.strokeDasharray || '5 5'}
            label={{
              value: ref.label,
              position: 'right',
              fill: '#64748b',
              fontSize: 11,
            }}
          />
        ))}
        {lines.map((line, index) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name || line.key}
            stroke={line.color || getChartColor(index)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            strokeDasharray={line.strokeDasharray}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
