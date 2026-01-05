import { useState } from 'react'
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
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { useYearOverYear } from '../../hooks/useAnalytics'
import { chartConfig, formatCurrency } from '../../lib/chartConfig'

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

// Default to previous month
const getDefaultMonth = () => {
  const now = new Date()
  const prevMonth = now.getMonth() // 0-11, so current month - 1
  return prevMonth === 0 ? 12 : prevMonth // If January, show December
}

const YEAR_COLORS = ['#0f4c81', '#3b82f6', '#93c5fd']

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: {
      year: number
      revenue: number
      transactions: number
      avg_ticket: number
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
      <p className="font-medium text-slate-800 mb-1">{data.year}</p>
      <p className="text-sm text-slate-600">
        Revenue: {formatCurrency(data.revenue)}
      </p>
      <p className="text-sm text-slate-600">
        Transactions: {data.transactions.toLocaleString()}
      </p>
      <p className="text-sm text-slate-600">
        Avg Ticket: {formatCurrency(data.avg_ticket)}
      </p>
    </div>
  )
}

export function YearOverYearChart() {
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth)
  const { data, isLoading, error, refetch } = useYearOverYear({ month: selectedMonth })

  const chartData = data?.periods || []
  const isEmpty = !isLoading && chartData.length === 0
  const growthYoY = data?.growth_yoy

  return (
    <ChartContainer
      title="Year-over-Year Comparison"
      subtitle={`Compare ${data?.month_name || MONTH_OPTIONS[selectedMonth - 1]?.label} across years`}
      loading={isLoading}
      empty={isEmpty}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No historical data available for this month"
      skeletonType="bar"
      height={300}
    >
      {/* Month selector and YoY indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Month:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
          >
            {MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>

        {/* YoY Growth indicator */}
        {growthYoY !== null && growthYoY !== undefined && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
              growthYoY > 0
                ? 'bg-emerald-50 text-emerald-700'
                : growthYoY < 0
                ? 'bg-red-50 text-red-700'
                : 'bg-slate-50 text-slate-600'
            }`}
          >
            {growthYoY > 0 ? (
              <TrendingUp size={14} />
            ) : growthYoY < 0 ? (
              <TrendingDown size={14} />
            ) : (
              <Minus size={14} />
            )}
            <span>{growthYoY > 0 ? '+' : ''}{growthYoY}%</span>
            <span className="text-xs opacity-70">YoY</span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, bottom: 10, left: 50 }}
        >
          <CartesianGrid
            stroke={chartConfig.grid.stroke}
            strokeDasharray={chartConfig.grid.strokeDasharray}
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={chartConfig.axis.tick}
            axisLine={chartConfig.axis.axisLine}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v)}
          />
          <YAxis
            type="category"
            dataKey="year"
            tick={chartConfig.axis.tick}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell
                key={index}
                fill={YEAR_COLORS[index % YEAR_COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Revenue labels */}
      {chartData.length > 0 && (
        <div className="flex flex-col gap-1 mt-2">
          {chartData.map((period, index) => (
            <div key={period.year} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded"
                style={{ backgroundColor: YEAR_COLORS[index % YEAR_COLORS.length] }}
              />
              <span className="text-slate-600 font-medium">{period.year}:</span>
              <span className="text-slate-800">{formatCurrency(period.revenue)}</span>
            </div>
          ))}
        </div>
      )}
    </ChartContainer>
  )
}
