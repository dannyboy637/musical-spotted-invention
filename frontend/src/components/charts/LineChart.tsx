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
  strokeDasharray?: string;
}

interface ReferenceLineConfig {
  y: number;
  label: string;
  color?: string;
  strokeDasharray?: string;
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
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={chartConfig.margin}>
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
        />
        <YAxis
          tick={chartConfig.axis.tick}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatY}
          width={60}
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
