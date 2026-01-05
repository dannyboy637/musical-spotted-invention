import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { useDayOfWeek } from '../../hooks/useAnalytics'
import { chartConfig, formatCurrency } from '../../lib/chartConfig'
import { format, parseISO } from 'date-fns'

const DAY_OPTIONS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
]

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: {
      date: string
      revenue: number
      transactions: number
      formattedDate: string
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
      <p className="font-medium text-slate-800 mb-1">{data.formattedDate}</p>
      <p className="text-sm text-slate-600">
        Revenue: {formatCurrency(data.revenue)}
      </p>
      <p className="text-sm text-slate-600">
        Transactions: {data.transactions.toLocaleString()}
      </p>
    </div>
  )
}

export function SameDayTrend() {
  const [selectedDay, setSelectedDay] = useState(5) // Default to Saturday
  const { data, isLoading, error, refetch } = useDayOfWeek({ dayFilter: selectedDay })

  // Process chart data
  const chartData = useMemo(() => {
    if (!data?.same_day_trend) return []

    return data.same_day_trend.map((d) => ({
      ...d,
      formattedDate: format(parseISO(d.date), 'MMM d, yyyy'),
      shortDate: format(parseISO(d.date), 'MMM d'),
    }))
  }, [data?.same_day_trend])

  // Calculate trend (compare last 4 weeks avg to previous 4 weeks avg)
  const trend = useMemo(() => {
    if (chartData.length < 8) return null

    const recent4 = chartData.slice(-4)
    const previous4 = chartData.slice(-8, -4)

    const recentAvg = recent4.reduce((sum, d) => sum + d.revenue, 0) / recent4.length
    const previousAvg = previous4.reduce((sum, d) => sum + d.revenue, 0) / previous4.length

    if (previousAvg === 0) return null

    const percentChange = ((recentAvg - previousAvg) / previousAvg) * 100
    return {
      value: Math.abs(percentChange).toFixed(1),
      direction: percentChange > 1 ? 'up' : percentChange < -1 ? 'down' : 'flat',
    }
  }, [chartData])

  const isEmpty = !isLoading && chartData.length === 0
  const selectedDayName = DAY_OPTIONS.find((d) => d.value === selectedDay)?.label || ''

  return (
    <ChartContainer
      title="Same-Day Performance"
      subtitle={`Track ${selectedDayName} performance over time`}
      loading={isLoading}
      empty={isEmpty}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No data available for the selected day"
      skeletonType="line"
      height={300}
    >
      {/* Day selector */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {DAY_OPTIONS.map((day) => (
            <button
              key={day.value}
              onClick={() => setSelectedDay(day.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                selectedDay === day.value
                  ? 'bg-navy-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>

        {/* Trend indicator */}
        {trend && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
              trend.direction === 'up'
                ? 'bg-emerald-50 text-emerald-700'
                : trend.direction === 'down'
                ? 'bg-red-50 text-red-700'
                : 'bg-slate-50 text-slate-600'
            }`}
          >
            {trend.direction === 'up' ? (
              <TrendingUp size={14} />
            ) : trend.direction === 'down' ? (
              <TrendingDown size={14} />
            ) : (
              <Minus size={14} />
            )}
            <span>{trend.value}%</span>
            <span className="text-xs opacity-70">vs prev 4 weeks</span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
          <CartesianGrid
            stroke={chartConfig.grid.stroke}
            strokeDasharray={chartConfig.grid.strokeDasharray}
          />
          <XAxis
            dataKey="shortDate"
            tick={chartConfig.axis.tick}
            axisLine={chartConfig.axis.axisLine}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={chartConfig.axis.tick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v)}
            width={70}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#0f4c81"
            strokeWidth={2}
            dot={{ fill: '#0f4c81', strokeWidth: 0, r: 3 }}
            activeDot={{ fill: '#0f4c81', strokeWidth: 2, stroke: '#fff', r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
