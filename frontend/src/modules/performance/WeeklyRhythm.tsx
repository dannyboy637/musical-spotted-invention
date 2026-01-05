import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { useDayOfWeek } from '../../hooks/useAnalytics'
import { chartConfig, formatCurrency } from '../../lib/chartConfig'

const DAY_LABELS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: {
      day_name: string
      avg_revenue: number
      avg_transactions: number
      total_days: number
    }
  }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const data = payload[0].payload

  return (
    <div
      className="bg-white border border-slate-200 rounded-md shadow-lg px-3 py-2"
      style={chartConfig.tooltip.contentStyle}
    >
      <p className="font-medium text-slate-800 mb-1">{data.day_name}</p>
      <p className="text-sm text-slate-600">
        Avg Revenue: {formatCurrency(data.avg_revenue)}
      </p>
      <p className="text-sm text-slate-600">
        Avg Transactions: {data.avg_transactions.toLocaleString()}
      </p>
      <p className="text-xs text-slate-400 mt-1">
        Based on {data.total_days} {data.day_name}s
      </p>
    </div>
  )
}

export function WeeklyRhythm() {
  const { data, isLoading, error, refetch } = useDayOfWeek()

  const chartData = data?.daily_averages.map((d) => ({
    ...d,
    label: DAY_LABELS_SHORT[d.day],
  })) || []

  // Find max for highlighting best day
  const maxRevenue = Math.max(...chartData.map((d) => d.avg_revenue), 0)

  const isEmpty = !isLoading && chartData.length === 0

  return (
    <ChartContainer
      title="Weekly Rhythm"
      subtitle={
        data?.best_day.day_name
          ? `Best: ${data.best_day.day_name} ${formatCurrency(data.best_day.avg_revenue)} avg  •  Worst: ${data.worst_day.day_name} ${formatCurrency(data.worst_day.avg_revenue)} avg`
          : 'Average revenue by day of week'
      }
      loading={isLoading}
      empty={isEmpty}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No weekly data available"
      skeletonType="bar"
      height={200}
    >
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
          <CartesianGrid
            stroke={chartConfig.grid.stroke}
            strokeDasharray={chartConfig.grid.strokeDasharray}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={chartConfig.axis.tick}
            axisLine={chartConfig.axis.axisLine}
            tickLine={false}
          />
          <YAxis
            tick={chartConfig.axis.tick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v)}
            width={70}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="avg_revenue" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.avg_revenue === maxRevenue ? '#059669' : '#0f4c81'}
                fillOpacity={entry.avg_revenue === maxRevenue ? 1 : 0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
