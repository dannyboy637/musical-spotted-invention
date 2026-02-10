import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { TrendingUp, TrendingDown, Clock, Package, DollarSign, Users } from 'lucide-react'
import { BarChart } from '../charts/BarChart'
import { Spinner } from '../ui/Spinner'
import { useDayBreakdown, type TopItemData } from '../../hooks/useDayBreakdown'
import { formatCurrency, chartColors, getHourLabelCompact } from '../../lib/chartConfig'
import { useSettingsStore } from '../../stores/settingsStore'

interface DayDeepDiveContentProps {
  date: string
}

function StatCard({
  icon: Icon,
  label,
  value,
  change,
  changeLabel,
}: {
  icon: typeof TrendingUp
  label: string
  value: string
  change?: number | null
  changeLabel?: string
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
      {change !== undefined && change !== null && (
        <div className={`flex items-center gap-1 text-sm mt-1 ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>
            {change >= 0 ? '+' : ''}
            {change.toFixed(1)}% {changeLabel}
          </span>
        </div>
      )}
    </div>
  )
}

function ItemsList({
  title,
  items,
  variant,
}: {
  title: string
  items: TopItemData[]
  variant: 'top' | 'bottom'
}) {
  const numberFormat = useSettingsStore((state) => state.numberFormat)
  const colorClass =
    variant === 'top' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h4 className="font-medium text-slate-900 dark:text-white mb-3">{title}</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400">No data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <h4 className="font-medium text-slate-900 dark:text-white mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={item.item_name}
            className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-sm font-medium flex-shrink-0 ${colorClass}`}>#{index + 1}</span>
              <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{item.item_name}</span>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {formatCurrency(item.revenue, numberFormat)}
              </p>
              <p className="text-xs text-slate-500">{item.quantity} sold</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DayDeepDiveContent({ date }: DayDeepDiveContentProps) {
  const { data, isLoading, error } = useDayBreakdown(date)
  const timeFormat = useSettingsStore((state) => state.timeFormat)
  const numberFormat = useSettingsStore((state) => state.numberFormat)

  const hourlyChartData = useMemo(() => {
    if (!data) return []
    return data.hourly.map((h) => ({
      hour: getHourLabelCompact(h.hour, timeFormat),
      revenue: h.revenue,
      transactions: h.transactions,
    }))
  }, [data, timeFormat])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 mt-3">Loading day breakdown...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">Failed to load data for {date}</p>
        <p className="text-sm text-slate-500 mt-2">Please try again later</p>
      </div>
    )
  }

  const formattedDate = format(parseISO(date), 'EEEE, MMMM d, yyyy')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{formattedDate}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Detailed breakdown of daily performance
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Revenue"
          value={formatCurrency(data.total_revenue, numberFormat)}
          change={data.comparison?.revenue_change_pct}
          changeLabel="vs last week"
        />
        <StatCard
          icon={Users}
          label="Transactions"
          value={data.total_transactions.toLocaleString()}
          change={data.comparison?.transactions_change_pct}
          changeLabel="vs last week"
        />
        <StatCard icon={Package} label="Items Sold" value={data.total_quantity.toLocaleString()} />
        <StatCard
          icon={Clock}
          label="Peak Hour"
          value={getHourLabelCompact(data.peak_hour, timeFormat)}
        />
      </div>

      {/* Hourly Breakdown Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <h4 className="font-medium text-slate-900 dark:text-white mb-4">Hourly Revenue Breakdown</h4>
        <BarChart
          data={hourlyChartData}
          xKey="hour"
          bars={[{ key: 'revenue', name: 'Revenue', color: chartColors[0] }]}
          height={250}
          layout="vertical"
          formatY={(v) => formatCurrency(v, numberFormat)}
        />
      </div>

      {/* Week-over-Week Comparison */}
      {data.comparison && (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h4 className="font-medium text-slate-900 dark:text-white mb-3">
            Compared to {format(parseISO(data.comparison.prior_date), 'MMM d')} (Last Week)
          </h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Revenue Change</p>
              <p
                className={`text-lg font-semibold ${
                  (data.comparison.revenue_change_pct ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {data.comparison.revenue_change_pct != null
                  ? `${data.comparison.revenue_change_pct >= 0 ? '+' : ''}${data.comparison.revenue_change_pct.toFixed(1)}%`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Transaction Change</p>
              <p
                className={`text-lg font-semibold ${
                  (data.comparison.transactions_change_pct ?? 0) >= 0
                    ? 'text-emerald-600'
                    : 'text-red-600'
                }`}
              >
                {data.comparison.transactions_change_pct != null
                  ? `${data.comparison.transactions_change_pct >= 0 ? '+' : ''}${data.comparison.transactions_change_pct.toFixed(1)}%`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Top Items Overlap</p>
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                {data.comparison.top_items_overlap}/10
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top and Bottom Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ItemsList title="Top 10 Items" items={data.top_items} variant="top" />
        <ItemsList title="Bottom 10 Items" items={data.bottom_items} variant="bottom" />
      </div>
    </div>
  )
}
