import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { BarChart } from '../../components/charts/BarChart'
import { useYoYSummary } from '../../hooks/useAnalytics'

function formatCurrency(value: number): string {
  return (value / 100).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

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

export function YoYComparisonChart() {
  const { data, isLoading } = useYoYSummary()

  // Prepare chart data
  const chartData = data?.months.map((month) => ({
    month: month.month_name.slice(0, 3), // Abbreviate month names
    current: month.current_revenue / 100,
    prior: (month.prior_revenue ?? 0) / 100,
  })) ?? []

  const hasData = chartData.length > 0 && chartData.some((d) => d.current > 0 || d.prior > 0)

  // Calculate trend icon
  const overallChange = data?.overall_yoy_change_pct
  const TrendIcon = overallChange ? (overallChange > 0 ? TrendingUp : TrendingDown) : Minus
  const trendColor = overallChange ? (overallChange > 0 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-500'

  return (
    <ChartContainer
      title="Year-over-Year Revenue Comparison"
      subtitle={data?.prior_year
        ? `${data.current_year} vs ${data.prior_year} monthly revenue`
        : `${data?.current_year ?? new Date().getFullYear()} monthly revenue`
      }
      loading={isLoading}
      empty={!hasData}
      emptyDescription="No revenue data available for comparison."
    >
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-navy-50 rounded-lg p-4">
          <p className="text-sm text-navy-600 mb-1">Current Year ({data?.current_year})</p>
          <p className="text-2xl font-bold text-navy-900">
            {formatCurrency(data?.total_current_revenue ?? 0)}
          </p>
        </div>
        {data?.total_prior_revenue != null && (
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-sm text-slate-600 mb-1">Prior Year ({data?.prior_year})</p>
            <p className="text-2xl font-bold text-slate-700">
              {formatCurrency(data.total_prior_revenue)}
            </p>
          </div>
        )}
        {overallChange != null && (
          <div className={`rounded-lg p-4 ${overallChange >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <p className={`text-sm mb-1 ${overallChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              YoY Change
            </p>
            <div className="flex items-center gap-2">
              <TrendIcon className={`h-6 w-6 ${trendColor}`} />
              <p className={`text-2xl font-bold ${trendColor}`}>
                {overallChange > 0 ? '+' : ''}{overallChange.toFixed(1)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      {hasData && (
        <BarChart
          data={chartData}
          xKey="month"
          bars={[
            { key: 'current', name: `${data?.current_year}`, color: '#1e3a5f' },
            ...(data?.prior_year ? [{ key: 'prior', name: `${data?.prior_year}`, color: '#94a3b8' }] : []),
          ]}
          height={300}
          showGrid
          showLegend
          formatY={(v) => formatCompactCurrency(v * 100)}
        />
      )}

      {/* Monthly breakdown table */}
      {data?.months && data.months.length > 0 && data.prior_year && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Monthly Breakdown</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 font-medium text-right">{data.current_year}</th>
                  <th className="pb-2 font-medium text-right">{data.prior_year}</th>
                  <th className="pb-2 font-medium text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((month) => (
                  <tr key={month.month} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">{month.month_name}</td>
                    <td className="py-2 text-right text-slate-700">
                      {formatCurrency(month.current_revenue)}
                    </td>
                    <td className="py-2 text-right text-slate-500">
                      {month.prior_revenue != null ? formatCurrency(month.prior_revenue) : '-'}
                    </td>
                    <td className="py-2 text-right">
                      {month.yoy_change_pct != null ? (
                        <span className={month.yoy_change_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {month.yoy_change_pct > 0 ? '+' : ''}{month.yoy_change_pct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ChartContainer>
  )
}
