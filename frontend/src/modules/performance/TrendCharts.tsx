import { useState } from 'react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { LineChart } from '../../components/charts/LineChart'
import { usePerformanceTrends } from '../../hooks/useAnalytics'
import { formatCurrency, chartColors } from '../../lib/chartConfig'
import { format, parseISO, startOfISOWeek, endOfISOWeek, setISOWeek, setYear } from 'date-fns'

type Granularity = 'daily' | 'weekly' | 'monthly'

// Calculate moving average for an array of values
function calculateMovingAverage(data: number[], window: number): (number | null)[] {
  return data.map((_, index) => {
    if (index < window - 1) return null // Not enough data points yet
    const windowData = data.slice(index - window + 1, index + 1)
    const sum = windowData.reduce((a, b) => a + b, 0)
    return Math.round(sum / window)
  })
}

export function TrendCharts() {
  const [granularity, setGranularity] = useState<Granularity>('daily')
  const { data, isLoading, error, refetch } = usePerformanceTrends()

  // Get the appropriate data based on granularity
  const getChartData = () => {
    if (!data) return []

    switch (granularity) {
      case 'daily': {
        // Calculate 7-day moving average for daily data
        const revenues = data.daily.map(d => d.revenue)
        const movingAvg = calculateMovingAverage(revenues, 7)

        return data.daily.map((d, index) => ({
          label: d.date || '',
          revenue: d.revenue,
          transactions: d.transactions,
          movingAvg: movingAvg[index],
        }))
      }
      case 'weekly': {
        // Calculate 4-week moving average for weekly data
        const revenues = data.weekly.map(d => d.revenue)
        const movingAvg = calculateMovingAverage(revenues, 4)

        return data.weekly.map((d, index) => ({
          label: d.week || '',
          revenue: d.revenue,
          transactions: d.transactions,
          movingAvg: movingAvg[index],
        }))
      }
      case 'monthly':
        return data.monthly.map((d) => ({
          label: d.month || '',
          revenue: d.revenue,
          transactions: d.transactions,
        }))
    }
  }

  const chartData = getChartData()

  const formatLabel = (label: string) => {
    if (!label) return ''
    try {
      if (granularity === 'daily') {
        return format(parseISO(label), 'MMM d')
      }
      if (granularity === 'weekly') {
        // Format like "W1"
        const [, week] = label.split('-W')
        return `W${week}`
      }
      if (granularity === 'monthly') {
        // Format like "Jan 24"
        const [year, month] = label.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return format(date, "MMM ''yy")
      }
    } catch {
      return label
    }
    return label
  }

  // Format tooltip label with full date ranges for weeks
  const formatTooltipLabel = (label: string) => {
    if (!label) return ''
    try {
      if (granularity === 'daily') {
        return format(parseISO(label), 'EEEE, MMM d, yyyy')
      }
      if (granularity === 'weekly') {
        // Parse ISO week format "YYYY-WXX" and show date range
        const match = label.match(/(\d{4})-W(\d{2})/)
        if (match) {
          const year = parseInt(match[1])
          const week = parseInt(match[2])
          // Create a date from the ISO week
          const baseDate = setYear(setISOWeek(new Date(), week), year)
          const weekStart = startOfISOWeek(baseDate)
          const weekEnd = endOfISOWeek(baseDate)
          return `Week ${week}: ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
        }
        return label
      }
      if (granularity === 'monthly') {
        const [year, month] = label.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return format(date, 'MMMM yyyy')
      }
    } catch {
      return label
    }
    return label
  }

  return (
    <ChartContainer
      title="Revenue Trends"
      subtitle={`${granularity.charAt(0).toUpperCase() + granularity.slice(1)} performance`}
      loading={isLoading}
      empty={chartData.length === 0}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No trend data available"
      skeletonType="line"
      height={400}
    >
      <div className="space-y-4">
        {/* Granularity Tabs */}
        <div className="flex gap-2 px-1">
          {(['daily', 'weekly', 'monthly'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                granularity === g
                  ? 'bg-navy-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>

        {/* Chart */}
        <LineChart
          data={chartData}
          xKey="label"
          lines={[
            { key: 'revenue', name: 'Revenue', color: chartColors[0] },
            ...(granularity !== 'monthly'
              ? [
                  {
                    key: 'movingAvg',
                    name: granularity === 'daily' ? '7-Day Avg' : '4-Week Avg',
                    color: chartColors[1],
                    strokeDasharray: '5 5',
                  },
                ]
              : []),
          ]}
          formatY={formatCurrency}
          formatX={formatLabel}
          formatTooltipLabel={formatTooltipLabel}
          height={300}
          showGrid
          showLegend={granularity !== 'monthly'}
        />
      </div>
    </ChartContainer>
  )
}
