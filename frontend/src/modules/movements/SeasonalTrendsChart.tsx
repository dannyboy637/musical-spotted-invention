import { Sun, Snowflake } from 'lucide-react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { BarChart } from '../../components/charts/BarChart'
import { useSeasonalTrends } from '../../hooks/useAnalytics'

function formatCompactCurrency(value: number): string {
  const amount = value / 100
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`
  }
  return amount.toFixed(0)
}

function formatCurrency(value: number): string {
  return (value / 100).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export function SeasonalTrendsChart() {
  const { data, isLoading } = useSeasonalTrends()

  // Prepare chart data
  const chartData = data?.monthly_averages.map((month) => ({
    month: month.month_name.slice(0, 3),
    revenue: month.avg_revenue / 100,
    transactions: month.avg_transactions,
    yearCount: month.year_count,
  })) ?? []

  const hasData = chartData.length > 0 && chartData.some((d) => d.revenue > 0)

  return (
    <ChartContainer
      title="Seasonal Trends"
      subtitle="Average monthly performance across all available years"
      loading={isLoading}
      empty={!hasData}
      emptyDescription="Not enough historical data to show seasonal patterns."
    >
      {/* Peak and Low Months */}
      {data && (data.peak_month.avg_revenue > 0 || data.low_month.avg_revenue > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {data.peak_month.avg_revenue > 0 && (
            <div className="flex items-center gap-4 bg-gold-50 rounded-lg p-4 border border-gold-200">
              <div className="flex-shrink-0 p-3 bg-gold-100 rounded-full">
                <Sun className="h-6 w-6 text-gold-600" />
              </div>
              <div>
                <p className="text-sm text-gold-700 font-medium">Peak Month</p>
                <p className="text-xl font-bold text-gold-900">{data.peak_month.month_name}</p>
                <p className="text-sm text-gold-600">
                  Avg: {formatCurrency(data.peak_month.avg_revenue)}
                </p>
              </div>
            </div>
          )}
          {data.low_month.avg_revenue > 0 && (
            <div className="flex items-center gap-4 bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex-shrink-0 p-3 bg-slate-100 rounded-full">
                <Snowflake className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="text-sm text-slate-600 font-medium">Slowest Month</p>
                <p className="text-xl font-bold text-slate-900">{data.low_month.month_name}</p>
                <p className="text-sm text-slate-500">
                  Avg: {formatCurrency(data.low_month.avg_revenue)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      {hasData && (
        <BarChart
          data={chartData}
          xKey="month"
          bars={[{ key: 'revenue', name: 'Avg Revenue', color: '#b45309' }]}
          height={280}
          showGrid
          formatY={(v) => formatCompactCurrency(v * 100)}
        />
      )}

      {/* Monthly details */}
      {data?.monthly_averages && data.monthly_averages.some((m) => m.year_count > 0) && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Monthly Averages</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {data.monthly_averages.map((month) => (
              <div
                key={month.month}
                className={`p-3 rounded-lg border ${
                  month.month_name === data.peak_month.month_name
                    ? 'bg-gold-50 border-gold-200'
                    : month.month_name === data.low_month.month_name
                    ? 'bg-slate-100 border-slate-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <p className="text-xs text-slate-500 mb-1">{month.month_name.slice(0, 3)}</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatCompactCurrency(month.avg_revenue)}
                </p>
                <p className="text-xs text-slate-400">
                  {month.avg_transactions.toLocaleString()} txns
                </p>
                {month.year_count > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    ({month.year_count} yr{month.year_count > 1 ? 's' : ''})
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartContainer>
  )
}
