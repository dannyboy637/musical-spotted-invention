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
}: BarChartProps) {
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
            />
            <YAxis
              type="category"
              dataKey={xKey}
              tick={chartConfig.axis.tick}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatX}
              width={80}
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
            />
            <YAxis
              tick={chartConfig.axis.tick}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatY}
              width={60}
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
