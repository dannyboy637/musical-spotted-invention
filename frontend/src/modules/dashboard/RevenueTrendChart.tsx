import { useState, useMemo } from 'react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { LineChart } from '../../components/charts/LineChart'
import { usePerformanceTrends } from '../../hooks/useAnalytics'
import { formatCurrency, chartColors } from '../../lib/chartConfig'
import { format, parseISO } from 'date-fns'

export function RevenueTrendChart() {
  const { data, isLoading, error, refetch } = usePerformanceTrends()
  const [showDailyAvg, setShowDailyAvg] = useState(false)
  const [showMovingAvg, setShowMovingAvg] = useState(false)

  // Calculate daily average
  const dailyAverage = useMemo(() => {
    if (!data?.daily?.length) return 0
    const total = data.daily.reduce((sum, d) => sum + d.revenue, 0)
    return Math.round(total / data.daily.length)
  }, [data?.daily])

  // Calculate 7-day moving average and transform data
  const chartData = useMemo(() => {
    if (!data?.daily) return []

    return data.daily.map((d, index) => {
      const baseData = {
        date: d.date || '',
        revenue: d.revenue,
        transactions: d.transactions,
      }

      if (showMovingAvg && index >= 6) {
        // Calculate 7-day moving average
        const window = data.daily.slice(index - 6, index + 1)
        const avg = window.reduce((sum, item) => sum + item.revenue, 0) / 7
        return { ...baseData, movingAvg: Math.round(avg) }
      }

      return baseData
    })
  }, [data?.daily, showMovingAvg])

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d')
    } catch {
      return dateStr
    }
  }

  // Build reference lines array
  const referenceLines = showDailyAvg && dailyAverage > 0
    ? [{ y: dailyAverage, label: `Avg: ${formatCurrency(dailyAverage)}`, color: '#f59e0b' }]
    : []

  // Build lines array
  const lines = [
    { key: 'revenue', name: 'Revenue', color: chartColors[0] },
    ...(showMovingAvg ? [{ key: 'movingAvg', name: '7-Day MA', color: '#10b981', strokeDasharray: '5 5' }] : []),
  ]

  return (
    <ChartContainer
      title="Revenue Trend"
      subtitle="Daily revenue for selected period"
      loading={isLoading}
      empty={chartData.length === 0}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No revenue data available"
      emptyDescription="Try adjusting your date range or filters, or import transaction data to see trends."
      emptyActionLabel="Import Data"
      emptyActionHref="/data-management"
      skeletonType="line"
      height={420}
    >
      <div className="space-y-3">
        {/* Controls Row */}
        <div className="flex flex-wrap items-center gap-4 px-1">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showDailyAvg}
              onChange={(e) => setShowDailyAvg(e.target.checked)}
              className="rounded border-slate-300 text-navy-600 focus:ring-navy-500"
            />
            Daily Average
            {showDailyAvg && dailyAverage > 0 && (
              <span className="text-amber-600 font-medium">({formatCurrency(dailyAverage)})</span>
            )}
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showMovingAvg}
              onChange={(e) => setShowMovingAvg(e.target.checked)}
              className="rounded border-slate-300 text-navy-600 focus:ring-navy-500"
            />
            7-Day Moving Avg
          </label>
        </div>

        <LineChart
          data={chartData}
          xKey="date"
          lines={lines}
          formatY={formatCurrency}
          formatX={formatDate}
          height={340}
          showGrid
          showLegend={showMovingAvg}
          referenceLines={referenceLines}
        />
      </div>
    </ChartContainer>
  )
}
